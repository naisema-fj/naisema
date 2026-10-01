import { and, eq, inArray } from "drizzle-orm";
import type { EmbeddedItem } from "~/components/article-body-view";
import { contentItem, mediaAsset, revision, slugRedirect, topic } from "~db/schema";
import { AREA_NAMES, isPrimaryArea, type PrimaryArea } from "./areas";
import { type ArticleBody, embeddedItemIds } from "./article-body";
import type { ArticleSnapshot } from "./article-fields";
import { CONTENT_TYPE_NAMES, type ContentType, PAGE_AREA } from "./content-types";
import type { Database } from "./db.server";
import {
  type EpisodeDetails,
  episodeSpeakers,
  formatDuration,
  isoDuration,
  transcriptParagraphs,
} from "./episode-fields";
import { eligibilityFor } from "./publication.server";
import { AGE_GUIDANCE, linkHost, type ResourceDetails } from "./resource-fields";
import { loadReview } from "./review.server";
import { reviewLabels } from "./review-labels";
import { formatBytes, UPLOAD_TYPE_NAMES } from "./upload-rules";

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

/** A content type's public address: /{area}/{slug}, or /{slug} for a Page. */
export const itemPath = (item: { type: string; primaryArea: string; slug: string }) =>
  item.type === "page" ? `/${item.slug}` : publicPath(item.primaryArea, item.slug);

/** A Resource as a visitor sees it before downloading the file or following the link. */
export type PublicResource = {
  language: string;
  ageGuidance: string;
  accessibility: string;
  usageTerms: string;
} & (
  | { kind: "file"; fileType: string; size: string; downloadPath: string }
  | { kind: "link"; url: string; host: string; checkedOn: string }
);

/** An Episode as a visitor sees it: the player's source, who speaks, and the full transcript. */
export type PublicEpisode = {
  audioPath: string;
  audioType: string;
  host: string;
  guests: string[];
  music: string[];
  archiveClips: string[];
  recordedOn: string;
  duration: string;
  isoDuration: string;
  transcript: { speaker: string | null; text: string }[];
  distribution: { label: string; url: string; host: string }[];
};

export type RelatedItem = { title: string; path: string; typeName: string; summary: string };

export type PublicArticle = {
  id: string;
  type: ContentType;
  area: PrimaryArea | null;
  areaName: string | null;
  slug: string;
  format: string;
  title: string;
  summary: string;
  credit: string;
  sources: string;
  topics: { name: string; slug: string }[];
  body: ArticleBody;
  embeds: Record<string, EmbeddedItem>;
  labels: string[];
  resource: PublicResource | null;
  episode: PublicEpisode | null;
  related: RelatedItem[];
  firstPublishedAt: Date | null;
  lastPublishedAt: Date | null;
};

export type PublicLookup =
  | { kind: "found"; article: PublicArticle }
  | { kind: "moved"; to: string }
  | { kind: "withdrawn" }
  | { kind: "missing" };

/** Types that live at /{area}/{slug}. */
const AREA_TYPES = ["article", "resource", "episode"] as const;

/**
 * The item at /{area}/{slug}: the published, eligible Article, Resource or Episode; a redirect from an old
 * slug; a withdrawn notice; or nothing. An ineligible item answers "missing", never its draft.
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
    .where(
      and(eq(contentItem.primaryArea, area), eq(contentItem.slug, slug), inArray(contentItem.type, [...AREA_TYPES])),
    )
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
    return { kind: "moved", to: itemPath(redirect.item) };
  }

  if (isTakenDown(item)) return { kind: "withdrawn" };
  const published = await eligiblePublished(db, item, now);
  if (!published) return { kind: "missing" };
  return { kind: "found", article: await publicView(db, item, published, now) };
}

/** The published, eligible Page at /{slug}, if there is one: About, Privacy and the other site pages. */
export async function findPublicPage(db: Database, slug: string, now = new Date()): Promise<PublicArticle | null> {
  const item = await db
    .select()
    .from(contentItem)
    .where(and(eq(contentItem.type, "page"), eq(contentItem.primaryArea, PAGE_AREA), eq(contentItem.slug, slug)))
    .get();
  if (!item) return null;
  const published = await eligiblePublished(db, item, now);
  return published ? publicView(db, item, published, now) : null;
}

/** Everything a public page shows of a published Revision. */
async function publicView(
  db: Database,
  item: ItemRow,
  { snapshot, review }: NonNullable<Awaited<ReturnType<typeof eligiblePublished>>>,
  now: Date,
): Promise<PublicArticle> {
  const type = item.type as ContentType;
  const area = isPrimaryArea(item.primaryArea) ? item.primaryArea : null;
  const topicRows = snapshot.topicIds.length
    ? await db
        .select({ id: topic.id, name: topic.name, slug: topic.slug })
        .from(topic)
        .where(inArray(topic.id, snapshot.topicIds))
    : [];
  return {
    id: item.id,
    type,
    area,
    areaName: area ? AREA_NAMES[area] : null,
    slug: item.slug,
    format: CONTENT_TYPE_NAMES[type],
    title: snapshot.title,
    summary: snapshot.summary,
    credit: snapshot.credit,
    sources: snapshot.sources ?? "",
    topics: snapshot.topicIds
      .map((id) => topicRows.find((row) => row.id === id))
      .filter((row) => row !== undefined)
      .map(({ name, slug }) => ({ name, slug })),
    body: snapshot.body,
    embeds: await publicEmbeds(db, snapshot.body, now),
    labels: reviewLabels({ progress: review.progress, flags: review.flags }),
    resource: snapshot.resource ? await publicResource(db, item.id, snapshot.resource) : null,
    episode: snapshot.episode ? await publicEpisode(db, item.id, snapshot.episode) : null,
    related: await relatedItems(db, snapshot.relatedIds ?? [], now),
    firstPublishedAt: item.firstPublishedAt,
    lastPublishedAt: item.lastPublishedAt,
  };
}

async function publicResource(db: Database, itemId: string, details: ResourceDetails): Promise<PublicResource> {
  const common = {
    language: details.language,
    ageGuidance: AGE_GUIDANCE[details.ageGuidance],
    accessibility: details.accessibility,
    usageTerms: details.usageTerms,
  };
  if (details.source.kind === "link") {
    const { url, checkedOn } = details.source;
    return { ...common, kind: "link", url, host: linkHost(url), checkedOn };
  }
  const asset = await db.select().from(mediaAsset).where(eq(mediaAsset.id, details.source.assetId)).get();
  return {
    ...common,
    kind: "file",
    fileType: asset ? UPLOAD_TYPE_NAMES[asset.type] : "File",
    size: asset ? formatBytes(asset.size) : "",
    downloadPath: `/resources/${itemId}/download`,
  };
}

async function publicEpisode(db: Database, itemId: string, details: EpisodeDetails): Promise<PublicEpisode> {
  const asset = await db
    .select({ type: mediaAsset.type })
    .from(mediaAsset)
    .where(eq(mediaAsset.id, details.audioAssetId))
    .get();
  return {
    audioPath: episodeAudioPath(itemId),
    audioType: asset?.type ?? "audio/mpeg",
    host: details.host,
    guests: details.guests,
    music: details.music ?? [],
    archiveClips: details.archiveClips ?? [],
    recordedOn: details.recordedOn,
    duration: formatDuration(details.durationSeconds),
    isoDuration: isoDuration(details.durationSeconds),
    transcript: transcriptParagraphs(details.transcript, episodeSpeakers(details)),
    distribution: details.distribution.map((link) => ({ ...link, host: linkHost(link.url) })),
  };
}

/** Where an Episode's audio streams from: through the Episode, so eligibility is decided each time. */
export const episodeAudioPath = (itemId: string) => `/episodes/${itemId}/audio`;

/** The curated related items that are public right now, in the order chosen. */
async function relatedItems(db: Database, ids: string[], now: Date): Promise<RelatedItem[]> {
  if (!ids.length) return [];
  const items = await db.select().from(contentItem).where(inArray(contentItem.id, ids));
  const shown = await Promise.all(
    ids.map(async (id) => {
      const item = items.find((candidate) => candidate.id === id);
      const published = item ? await eligiblePublished(db, item, now) : null;
      if (!item || !published) return null;
      return {
        title: published.snapshot.title,
        summary: published.snapshot.summary,
        path: itemPath(item),
        typeName: CONTENT_TYPE_NAMES[item.type as ContentType] ?? item.type,
      };
    }),
  );
  return shown.filter((entry) => entry !== null);
}

/** Embedded Content Items that are themselves public right now, linked to their public pages. */
async function publicEmbeds(db: Database, body: ArticleBody, now: Date) {
  const ids = embeddedItemIds(body);
  if (!ids.length) return {};
  const items = await db.select().from(contentItem).where(inArray(contentItem.id, ids));
  const entries = await Promise.all(
    items.map(async (item) => {
      const published = await eligiblePublished(db, item, now);
      return published ? ([item.id, { title: published.snapshot.title, href: itemPath(item) }] as const) : null;
    }),
  );
  return Object.fromEntries(entries.filter((entry) => entry !== null));
}
