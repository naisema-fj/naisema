import { and, asc, count, desc, eq, gt, inArray, lte, ne, sql } from "drizzle-orm";
import { type AnySQLiteColumn, integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { contentItem, revision, rightsRecord, searchEntry, searchEntryTopic, topic } from "~db/schema";
import { AREA_NAMES, isPrimaryArea, type PrimaryArea } from "./areas";
import { MEDIA_TYPES, type MediaType } from "./creator-fields";
import type { Database } from "./db.server";
import { formatDuration } from "./episode-fields";
import { FORMAT_NAMES, isContentFormat } from "./formats";
import { itemsMentioning } from "./mentions.server";
import { eligiblePublished, itemPath } from "./public.server";
import { matchExpression, type SearchFilters } from "./search-query";

/**
 * The public index (PUB-03, ADR-0007): search, area listings and the sitemap all read it. It holds
 * items whose published Revision was eligible when last indexed. An item is reindexed whenever its
 * public state may change, and daily when its rights expire (the only change that comes with time);
 * every item shown is checked again first, so one that lapsed in between never appears.
 */

/** The FTS5 table from migrations/0006, declared here (not in db/schema.ts) so drizzle-kit leaves it alone. */
const searchFts = sqliteTable("search_fts", { rowid: integer("rowid").notNull() });

export const SEARCH_PAGE_SIZE = 20;

/** Brings an item's search entry in line with what is public now: indexed if eligible, removed if not. */
export async function indexItem(db: Database, contentItemId: string, now = new Date()) {
  const item = await db.select().from(contentItem).where(eq(contentItem.id, contentItemId)).get();
  const published = item ? await eligiblePublished(db, item, now) : null;
  const removal = [
    db.delete(searchEntryTopic).where(eq(searchEntryTopic.contentItemId, contentItemId)),
    db.delete(searchEntry).where(eq(searchEntry.contentItemId, contentItemId)),
  ] as const;
  if (!item || !published || !isContentFormat(item.type)) {
    await db.batch(removal);
    return;
  }

  const { snapshot } = published;
  const topics = snapshot.topicIds.length
    ? await db.select().from(topic).where(inArray(topic.id, snapshot.topicIds))
    : [];
  await db.batch([
    ...removal,
    db.insert(searchEntry).values({
      contentItemId,
      primaryArea: item.primaryArea,
      format: item.type,
      title: snapshot.title,
      summary: snapshot.summary,
      topicNames: topics.map((row) => row.name).join(", "),
      publishedAt: item.lastPublishedAt,
    }),
    ...topics.map((row) => db.insert(searchEntryTopic).values({ contentItemId, topicId: row.id })),
  ]);
}

/**
 * A cheap pre-filter, in SQL, for the commonest way an indexed item stops being public: its Rights
 * Records granting Publish expired or were withdrawn. It keeps counts, the Topic list and the
 * sitemap honest without running the full eligibility decision on every row; that decision still
 * runs on every item shown (ADR-0007).
 */
const hasPublishRights = (contentItemId: AnySQLiteColumn, now: Date) => sql`exists (
  select 1 from ${rightsRecord}
  where ${rightsRecord.subjectType} = 'content_item' and ${rightsRecord.subjectId} = ${contentItemId}
    and ${rightsRecord.withdrawnAt} is null
    and (${rightsRecord.expiresAt} is null or ${rightsRecord.expiresAt} > ${now.getTime()})
    and ${rightsRecord.permittedUses} like '%"publish"%'
)`;

/** Indexed items with their Content Items, matched against the words searched for when there are any. */
function indexedItems(db: Database, match: string | null) {
  const query = db
    .select({ item: contentItem, format: searchEntry.format })
    .from(searchEntry)
    .innerJoin(contentItem, eq(contentItem.id, searchEntry.contentItemId));
  return match ? query.innerJoin(searchFts, eq(searchFts.rowid, searchEntry.id)) : query;
}

function countIndexed(db: Database, match: string | null) {
  const query = db.select({ total: count() }).from(searchEntry);
  return match ? query.innerJoin(searchFts, eq(searchFts.rowid, searchEntry.id)) : query;
}

export type SearchResult = {
  id: string;
  /** Null for a Page, which sits outside the six areas. */
  area: PrimaryArea | null;
  path: string;
  title: string;
  summary: string;
  areaName: string;
  /** What kind of item it is, with an Episode's length: "Article", "Episode · 32 min". */
  formatName: string;
  publishedAt: Date | null;
};

export type SearchOutcome = {
  results: SearchResult[];
  /** Matches in the index; the items shown are re-checked, so a page can show fewer. */
  total: number;
  pageCount: number;
  topics: { id: string; name: string }[];
};

export async function searchPublic(db: Database, filters: SearchFilters, now = new Date()): Promise<SearchOutcome> {
  const match = matchExpression(filters.q);
  const conditions = and(
    hasPublishRights(searchEntry.contentItemId, now),
    match ? sql`${searchFts} MATCH ${match}` : undefined,
    filters.area ? eq(searchEntry.primaryArea, filters.area) : undefined,
    filters.format ? eq(searchEntry.format, filters.format) : undefined,
    filters.topic
      ? inArray(
          searchEntry.contentItemId,
          db
            .select({ id: searchEntryTopic.contentItemId })
            .from(searchEntryTopic)
            .where(eq(searchEntryTopic.topicId, filters.topic)),
        )
      : undefined,
  );

  const [rows, [{ total }], topics] = await Promise.all([
    indexedItems(db, match)
      .where(conditions)
      // Titles weigh most, then summaries, then Topic names; without words, newest first.
      .orderBy(...(match ? [sql`bm25(search_fts, 10.0, 4.0, 2.0)`] : [desc(searchEntry.publishedAt)]))
      .limit(SEARCH_PAGE_SIZE)
      .offset((filters.page - 1) * SEARCH_PAGE_SIZE),
    countIndexed(db, match).where(conditions),
    db
      .selectDistinct({ id: topic.id, name: topic.name })
      .from(searchEntryTopic)
      .innerJoin(topic, eq(topic.id, searchEntryTopic.topicId))
      .where(hasPublishRights(searchEntryTopic.contentItemId, now))
      .orderBy(asc(topic.name)),
  ]);

  return {
    results: await recheckHits(db, rows, now),
    total,
    pageCount: Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE)),
    topics,
  };
}

/**
 * Runs the eligibility decision on each hit and returns those still public, as results. A hit
 * that lapsed since it was indexed is also dropped from the index there and then, so this writes.
 */
async function recheckHits(
  db: Database,
  rows: { item: typeof contentItem.$inferSelect; format: string }[],
  now: Date,
): Promise<SearchResult[]> {
  const checked = await Promise.all(
    rows.map(async ({ item, format }) => {
      const published = await eligiblePublished(db, item, now);
      if (!published) {
        await indexItem(db, item.id, now);
        return null;
      }
      const area = isPrimaryArea(item.primaryArea) ? item.primaryArea : null;
      return {
        id: item.id,
        area,
        path: itemPath(item),
        title: published.snapshot.title,
        summary: published.snapshot.summary,
        areaName: area ? AREA_NAMES[area] : "NAISEMA",
        // An Episode's listing says how long it is: "Episode · 32 min".
        formatName: published.snapshot.episode
          ? `${FORMAT_NAMES.episode} · ${formatDuration(published.snapshot.episode.durationSeconds)}`
          : isContentFormat(format)
            ? FORMAT_NAMES[format]
            : format,
        publishedAt: item.lastPublishedAt,
      } satisfies SearchResult;
    }),
  );
  return checked.filter((result) => result !== null);
}

/** A few extra candidates, so a listing stays full when one of its newest items has just lapsed. */
const LISTING_SPARES = 5;

/** The newest public items, in one area or across the site, and how many the index holds in all. */
export async function listPublic(
  db: Database,
  { area, limit }: { area?: PrimaryArea; limit: number },
  now = new Date(),
) {
  const where = and(
    hasPublishRights(searchEntry.contentItemId, now),
    // Listings show what was published in an area; site pages (About, Privacy...) aren't news.
    area ? eq(searchEntry.primaryArea, area) : ne(searchEntry.format, "page"),
  );
  const [rows, [{ total }]] = await Promise.all([
    indexedItems(db, null)
      .where(where)
      .orderBy(desc(searchEntry.publishedAt))
      .limit(limit + LISTING_SPARES),
    countIndexed(db, null).where(where),
  ]);
  return { listings: (await recheckHits(db, rows, now)).slice(0, limit), total };
}

/**
 * The newest public items in any of these Topics, for a Topic's page, and how many there are; site
 * Pages aren't listed, and `exceptId` (the lead feature, shown on its own) is left out.
 */
export async function listByTopics(
  db: Database,
  { topicIds, exceptId, limit }: { topicIds: string[]; exceptId: string | null; limit: number },
  now = new Date(),
) {
  if (!topicIds.length) return { listings: [], total: 0 };
  const where = and(
    hasPublishRights(searchEntry.contentItemId, now),
    ne(searchEntry.format, "page"),
    exceptId ? ne(searchEntry.contentItemId, exceptId) : undefined,
    inArray(
      searchEntry.contentItemId,
      db
        .select({ id: searchEntryTopic.contentItemId })
        .from(searchEntryTopic)
        .where(inArray(searchEntryTopic.topicId, topicIds)),
    ),
  );
  const [rows, [{ total }]] = await Promise.all([
    indexedItems(db, null)
      .where(where)
      .orderBy(desc(searchEntry.publishedAt))
      .limit(limit + LISTING_SPARES),
    countIndexed(db, null).where(where),
  ]);
  return { listings: (await recheckHits(db, rows, now)).slice(0, limit), total };
}

/**
 * The public Creator Profiles, A to Z, with what they make, narrowed to one kind of media when
 * asked. Like every listing, each is checked again before it is shown.
 */
export async function listCreators(db: Database, mediaType: MediaType | null, now = new Date()) {
  // The kind of work is matched in SQL, in the published Revision, so the limit applies after it.
  const worksIn = mediaType
    ? sql`exists (
        select 1 from ${revision}, json_each(${revision.snapshot}, '$.creator.mediaTypes')
        where ${revision.id} = ${contentItem.currentPublishedRevisionId} and json_each.value = ${mediaType}
      )`
    : undefined;
  const rows = await indexedItems(db, null)
    .where(and(hasPublishRights(searchEntry.contentItemId, now), eq(searchEntry.format, "creator"), worksIn))
    .orderBy(asc(searchEntry.title))
    .limit(CREATOR_LIST_LIMIT);
  const checked = await Promise.all(
    rows.map(async ({ item }) => {
      const published = await eligiblePublished(db, item, now);
      const creator = published?.snapshot.creator;
      if (!published || !creator) {
        await indexItem(db, item.id, now);
        return null;
      }
      return {
        name: published.snapshot.title,
        summary: published.snapshot.summary,
        path: itemPath(item),
        location: creator.location,
        mediaTypes: creator.mediaTypes.map((type) => MEDIA_TYPES[type]),
      };
    }),
  );
  return checked.filter((creator) => creator !== null);
}

/** Connect lists this many Creators; search pages through the rest. */
const CREATOR_LIST_LIMIT = 200;

/** One item as a card, if it is public right now: a Topic's lead feature. */
export async function publicCard(db: Database, itemId: string, now = new Date()) {
  const rows = await indexedItems(db, null).where(eq(searchEntry.contentItemId, itemId));
  return (await recheckHits(db, rows, now))[0] ?? null;
}

/**
 * Every indexed item with current Publish rights, for the sitemap. Items aren't put through the
 * full decision one by one: a sitemap only suggests addresses, each page decides eligibility when
 * requested, and every other change to an item reindexes it at once.
 */
export function sitemapEntries(db: Database, now = new Date()) {
  return db
    .select({
      type: contentItem.type,
      primaryArea: contentItem.primaryArea,
      slug: contentItem.slug,
      publishedAt: searchEntry.publishedAt,
    })
    .from(searchEntry)
    .innerJoin(contentItem, eq(contentItem.id, searchEntry.contentItemId))
    .where(hasPublishRights(searchEntry.contentItemId, now))
    .orderBy(desc(searchEntry.publishedAt));
}

/**
 * The daily job's part: reindex items whose Rights Records expired in the window, so expiries the
 * SQL pre-filter doesn't cover (guardian permission, a part's or a media file's record) leave the
 * index too, with the items that show them (using a file, or offering an item as a Creator's
 * sample). The caller's window overlaps the previous run's.
 */
export async function reindexExpiredRights(db: Database, since: Date, now: Date) {
  const expired = await db
    .selectDistinct({ type: rightsRecord.subjectType, id: rightsRecord.subjectId })
    .from(rightsRecord)
    .where(and(gt(rightsRecord.expiresAt, since), lte(rightsRecord.expiresAt, now)));
  for (const { type, id } of expired) {
    // An item that lapses takes down those that show it (a Creator's sample); a file, those using it.
    const mentioning = await itemsMentioning(db, id);
    const items = type === "media_asset" ? mentioning : [id, ...mentioning.filter((other) => other !== id)];
    for (const itemId of items) await indexItem(db, itemId, now);
  }
}
