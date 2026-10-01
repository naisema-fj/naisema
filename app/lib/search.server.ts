import { and, asc, count, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { contentItem, rightsRecord, searchEntry, searchEntryTopic, topic } from "~db/schema";
import { AREA_NAMES, type PrimaryArea } from "./areas";
import type { Database } from "./db.server";
import { FORMAT_NAMES, isContentFormat } from "./formats";
import { eligiblePublished, publicPath } from "./public.server";
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
      tags: topics.map((row) => row.name).join(", "),
      publishedAt: item.lastPublishedAt,
    }),
    ...topics.map((row) => db.insert(searchEntryTopic).values({ contentItemId, topicId: row.id })),
  ]);
}

export type SearchResult = {
  id: string;
  area: PrimaryArea;
  path: string;
  title: string;
  summary: string;
  areaName: string;
  formatName: string;
  publishedAt: Date | null;
};

export type SearchOutcome = {
  results: SearchResult[];
  total: number;
  pageCount: number;
  topics: { id: string; name: string }[];
};

export async function searchPublic(db: Database, filters: SearchFilters, now = new Date()): Promise<SearchOutcome> {
  const match = matchExpression(filters.q);
  const conditions = and(
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
  const base = db
    .select({ item: contentItem, format: searchEntry.format })
    .from(searchEntry)
    .innerJoin(contentItem, eq(contentItem.id, searchEntry.contentItemId));
  const counted = db.select({ total: count() }).from(searchEntry);

  const [rows, [{ total }], topics] = await Promise.all([
    (match ? base.innerJoin(searchFts, eq(searchFts.rowid, searchEntry.id)) : base)
      .where(conditions)
      // Titles weigh most, then summaries, then Topic names; without words, newest first.
      .orderBy(...(match ? [sql`bm25(search_fts, 10.0, 4.0, 2.0)`] : [desc(searchEntry.publishedAt)]))
      .limit(SEARCH_PAGE_SIZE)
      .offset((filters.page - 1) * SEARCH_PAGE_SIZE),
    (match ? counted.innerJoin(searchFts, eq(searchFts.rowid, searchEntry.id)) : counted).where(conditions),
    db
      .selectDistinct({ id: topic.id, name: topic.name })
      .from(searchEntryTopic)
      .innerJoin(topic, eq(topic.id, searchEntryTopic.topicId))
      .orderBy(asc(topic.name)),
  ]);

  const results = await stillEligible(db, rows, now);
  return {
    results,
    total: total - (rows.length - results.length),
    pageCount: Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE)),
    topics,
  };
}

/**
 * The hits that are still eligible, as results. A hit that lapsed since it was indexed (its rights
 * expired today, say) is left out and dropped from the index there and then.
 */
async function stillEligible(
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
      const area = item.primaryArea as PrimaryArea;
      return {
        id: item.id,
        area,
        path: publicPath(area, item.slug),
        title: published.snapshot.title,
        summary: published.snapshot.summary,
        areaName: AREA_NAMES[area],
        formatName: isContentFormat(format) ? FORMAT_NAMES[format] : format,
        publishedAt: item.lastPublishedAt,
      } satisfies SearchResult;
    }),
  );
  return checked.filter((result) => result !== null);
}

/** The newest public items, in one area or across the site, and how many there are in all. */
export async function listPublic(
  db: Database,
  { area, limit }: { area?: PrimaryArea; limit: number },
  now = new Date(),
) {
  const where = area ? eq(searchEntry.primaryArea, area) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ item: contentItem, format: searchEntry.format })
      .from(searchEntry)
      .innerJoin(contentItem, eq(contentItem.id, searchEntry.contentItemId))
      .where(where)
      .orderBy(desc(searchEntry.publishedAt))
      .limit(limit),
    db.select({ total: count() }).from(searchEntry).where(where),
  ]);
  const listings = await stillEligible(db, rows, now);
  return { listings, total: total - (rows.length - listings.length) };
}

/**
 * Every indexed item's address for the sitemap, without re-checking each one: a sitemap only
 * suggests addresses, and each page decides eligibility when it is requested.
 */
export function sitemapEntries(db: Database) {
  return db
    .select({ area: contentItem.primaryArea, slug: contentItem.slug, publishedAt: searchEntry.publishedAt })
    .from(searchEntry)
    .innerJoin(contentItem, eq(contentItem.id, searchEntry.contentItemId))
    .orderBy(desc(searchEntry.publishedAt));
}

/**
 * The daily job's part: items whose Rights Records expired in the window stop being public with
 * nothing else happening, so reindex them. The window overlaps the previous run's.
 */
export async function reindexExpiredRights(db: Database, since: Date, now: Date) {
  const expired = await db
    .selectDistinct({ id: rightsRecord.subjectId })
    .from(rightsRecord)
    .where(
      and(
        eq(rightsRecord.subjectType, "content_item"),
        gt(rightsRecord.expiresAt, since),
        lte(rightsRecord.expiresAt, now),
      ),
    );
  for (const { id } of expired) await indexItem(db, id, now);
}
