import { and, desc, eq, inArray } from "drizzle-orm";
import type { EmbeddedItem } from "~/components/article-body-view";
import { contentItem, revision, slugRedirect, topic } from "~db/schema";
import { AREA_NAMES, type PrimaryArea } from "./areas";
import { type ArticleBody, embeddedItemIds } from "./article-body";
import type { ArticleSnapshot } from "./article-fields";
import type { Database } from "./db.server";
import { eligibilityFor } from "./publication.server";
import { loadReview } from "./review.server";
import { reviewLabels } from "./review-labels";

/**
 * What the public site may show (ADR-0007). Every item goes through the eligibility decision at
 * the moment of the request, so drafts, withdrawn items and items whose reviews or rights lapsed
 * never render, and nothing needs unpublishing.
 */

export const publicPath = (area: string, slug: string) => `/${area}/${slug}`;

type ItemRow = typeof contentItem.$inferSelect;

/** The published Revision of an item, if the item is published and eligible right now. */
async function eligiblePublished(db: Database, item: ItemRow, now: Date) {
  if (item.publicationState !== "published" || !item.currentPublishedRevisionId) return null;
  const review = await loadReview(db, item.currentPublishedRevisionId);
  if (!review) return null;
  const eligibility = await eligibilityFor(db, review, now);
  if (!eligibility.eligible) return null;
  const row = await db.select().from(revision).where(eq(revision.id, item.currentPublishedRevisionId)).get();
  return row ? { review, snapshot: row.snapshot as ArticleSnapshot } : null;
}

export type PublicArticle = {
  id: string;
  area: PrimaryArea;
  areaName: string;
  slug: string;
  format: "Article";
  title: string;
  summary: string;
  credit: string;
  sources: string;
  topics: string[];
  body: ArticleBody;
  embeds: Record<string, EmbeddedItem>;
  labels: string[];
  firstPublishedAt: Date | null;
  lastPublishedAt: Date | null;
};

export type PublicLookup =
  | { kind: "found"; article: PublicArticle }
  | { kind: "moved"; to: string }
  | { kind: "withdrawn" }
  | { kind: "missing" };

/**
 * The item at /{area}/{slug}: the published, eligible Article; a redirect from an old slug; a
 * withdrawn notice; or nothing. An ineligible item answers "missing", never its draft.
 */
export async function findPublicArticle(
  db: Database,
  area: PrimaryArea,
  slug: string,
  now = new Date(),
): Promise<PublicLookup> {
  const item = await db
    .select()
    .from(contentItem)
    .where(and(eq(contentItem.primaryArea, area), eq(contentItem.slug, slug), eq(contentItem.type, "article")))
    .get();

  if (!item) {
    const redirect = await db
      .select({ item: contentItem })
      .from(slugRedirect)
      .innerJoin(contentItem, eq(contentItem.id, slugRedirect.contentItemId))
      .where(and(eq(slugRedirect.primaryArea, area), eq(slugRedirect.slug, slug)))
      .get();
    if (redirect && (await eligiblePublished(db, redirect.item, now))) {
      return { kind: "moved", to: publicPath(redirect.item.primaryArea, redirect.item.slug) };
    }
    return { kind: "missing" };
  }

  if (item.publicationState === "withdrawn" || item.publicationState === "archived") return { kind: "withdrawn" };
  const published = await eligiblePublished(db, item, now);
  if (!published) return { kind: "missing" };
  const { snapshot, review } = published;

  const topicRows = snapshot.topicIds.length
    ? await db.select({ id: topic.id, name: topic.name }).from(topic).where(inArray(topic.id, snapshot.topicIds))
    : [];
  return {
    kind: "found",
    article: {
      id: item.id,
      area,
      areaName: AREA_NAMES[area],
      slug: item.slug,
      format: "Article",
      title: snapshot.title,
      summary: snapshot.summary,
      credit: snapshot.credit,
      sources: snapshot.sources ?? "",
      topics: snapshot.topicIds
        .map((id) => topicRows.find((row) => row.id === id)?.name)
        .filter((name): name is string => Boolean(name)),
      body: snapshot.body,
      embeds: await publicEmbeds(db, snapshot.body, now),
      labels: reviewLabels({ progress: review.progress, flags: review.flags }),
      firstPublishedAt: item.firstPublishedAt,
      lastPublishedAt: item.lastPublishedAt,
    },
  };
}

/** Embedded Content Items that are themselves public right now, linked to their public pages. */
async function publicEmbeds(db: Database, body: ArticleBody, now: Date) {
  const ids = embeddedItemIds(body);
  if (!ids.length) return {};
  const items = await db.select().from(contentItem).where(inArray(contentItem.id, ids));
  const entries = await Promise.all(
    items.map(async (item) => {
      const published = await eligiblePublished(db, item, now);
      return published
        ? ([item.id, { title: published.snapshot.title, href: publicPath(item.primaryArea, item.slug) }] as const)
        : null;
    }),
  );
  return Object.fromEntries(entries.filter((entry) => entry !== null));
}

export type PublicListing = {
  area: PrimaryArea;
  areaName: string;
  slug: string;
  path: string;
  title: string;
  summary: string;
  lastPublishedAt: Date | null;
};

/** Published, eligible items, newest first: in one area, or across the site. */
export async function listPublic(
  db: Database,
  { area, limit }: { area?: PrimaryArea; limit?: number } = {},
  now = new Date(),
): Promise<PublicListing[]> {
  const items = await db
    .select()
    .from(contentItem)
    .where(and(eq(contentItem.publicationState, "published"), area ? eq(contentItem.primaryArea, area) : undefined))
    .orderBy(desc(contentItem.lastPublishedAt));
  const listings: PublicListing[] = [];
  for (const item of items) {
    if (limit && listings.length >= limit) break;
    const published = await eligiblePublished(db, item, now);
    if (!published) continue;
    const itemArea = item.primaryArea as PrimaryArea;
    listings.push({
      area: itemArea,
      areaName: AREA_NAMES[itemArea],
      slug: item.slug,
      path: publicPath(itemArea, item.slug),
      title: published.snapshot.title,
      summary: published.snapshot.summary,
      lastPublishedAt: item.lastPublishedAt,
    });
  }
  return listings;
}
