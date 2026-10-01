import { and, eq, inArray } from "drizzle-orm";
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

/**
 * The public decision of ADR-0007: the item is published and its published Revision is eligible
 * right now. `eligibilityFor` leaves out the publication state because publishing itself asks it;
 * public code asks this instead, never `eligibilityFor` alone.
 */
export async function eligiblePublished(db: Database, item: ItemRow, now: Date) {
  if (item.publicationState !== "published" || !item.currentPublishedRevisionId) return null;
  const review = await loadReview(db, item.currentPublishedRevisionId);
  if (!review) return null;
  const eligibility = await eligibilityFor(db, review, now);
  if (!eligibility.eligible) return null;
  const row = await db.select().from(revision).where(eq(revision.id, item.currentPublishedRevisionId)).get();
  return row ? { review, snapshot: row.snapshot as ArticleSnapshot } : null;
}

/** Withdrawn or archived after being published; an item never published stays unknown to visitors. */
const isTakenDown = (item: ItemRow) =>
  (item.publicationState === "withdrawn" || item.publicationState === "archived") && item.firstPublishedAt !== null;

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
    if (!redirect) return { kind: "missing" };
    // An old address answers as the item's own address would.
    if (isTakenDown(redirect.item)) return { kind: "withdrawn" };
    if (!(await eligiblePublished(db, redirect.item, now))) return { kind: "missing" };
    return { kind: "moved", to: publicPath(redirect.item.primaryArea, redirect.item.slug) };
  }

  if (isTakenDown(item)) return { kind: "withdrawn" };
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
