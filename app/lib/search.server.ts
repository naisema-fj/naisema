import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { contentItem, searchEntry, searchEntryTopic, topic } from "~db/schema";
import { AREA_NAMES, type PrimaryArea } from "./areas";
import type { Database } from "./db.server";
import { FORMAT_NAMES, isContentFormat } from "./formats";
import { eligiblePublished, publicPath } from "./public.server";
import { matchExpression, type SearchFilters } from "./search-query";

/**
 * Public search (PUB-03, ADR-0007). The index holds items whose published Revision was eligible
 * when last indexed; it is rebuilt for an item whenever its public state may change, and every hit
 * is checked again before it is shown, so an item that lapsed since then never appears.
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

  const checked = await Promise.all(
    rows.map(async ({ item, format }) => {
      const published = await eligiblePublished(db, item, now);
      if (!published) {
        // It lapsed since it was indexed (a rights expiry, say): drop it from the index now.
        await indexItem(db, item.id, now);
        return null;
      }
      const area = item.primaryArea as PrimaryArea;
      return {
        id: item.id,
        path: publicPath(area, item.slug),
        title: published.snapshot.title,
        summary: published.snapshot.summary,
        areaName: AREA_NAMES[area],
        formatName: isContentFormat(format) ? FORMAT_NAMES[format] : format,
        publishedAt: item.lastPublishedAt,
      } satisfies SearchResult;
    }),
  );
  const results = checked.filter((result) => result !== null);
  return {
    results,
    total: total - (rows.length - results.length),
    pageCount: Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE)),
    topics,
  };
}
