import { and, asc, eq, inArray } from "drizzle-orm";
import type { EmbeddedItem } from "~/components/article-body-view";
import { contentItem, learningLayer, mediaAsset, revision, slugRedirect, topic } from "~db/schema";
import { AREA_NAMES, isPrimaryArea, type PrimaryArea } from "./areas";
import { type ArticleBody, embeddedItemIds } from "./article-body";
import { type ArticleSnapshot, footageOf } from "./article-fields";
import { CONTENT_TYPE_NAMES, type ContentType, PAGE_AREA } from "./content-types";
import { type CreatorDetails, MEDIA_TYPES } from "./creator-fields";
import type { Database } from "./db.server";
import {
  type EpisodeDetails,
  episodeSpeakers,
  formatDuration,
  isoDuration,
  transcriptParagraphs,
} from "./episode-fields";
import { itemPath } from "./item-paths";
import { layerEligibility, loadLayerReview } from "./layer-review.server";
import { LAYER_LEVELS, type LearningLayerSnapshot, layerSpan } from "./learning-layer-fields";
import { imagePath } from "./media-delivery.server";
import { eligibilityFor } from "./publication.server";
import { AGE_GUIDANCE, linkHost, type ResourceDetails } from "./resource-fields";
import { loadReview } from "./review.server";
import { reviewLabels } from "./review-labels";
import { formatBytes, UPLOAD_TYPE_NAMES } from "./upload-rules";
import { readyVideo } from "./video-assets.server";
import type { Orientation } from "./video-rules";

/**
 * What the public site may show (ADR-0007). Every item goes through the eligibility decision at
 * the moment of the request, so drafts, withdrawn items and items whose reviews or rights lapsed
 * never render, and nothing needs unpublishing.
 */

export { creatorPath, itemPath, publicPath } from "./item-paths";

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

/**
 * An Episode as a visitor sees it: the player's source (none for a video Episode, which plays as a
 * Video does), who speaks, and the full transcript.
 */
export type PublicEpisode = {
  audioPath: string | null;
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

/** A Creator Profile as visitors see it: their portrait, where they are, what they make, a free sample. */
export type PublicCreator = {
  portrait: { src: string; srcSet: string; alt: string };
  location: string;
  languages: string[];
  mediaTypes: string[];
  sample: RelatedItem | null;
};

export type RelatedItem = { title: string; path: string; typeName: string; summary: string };

/** A Learning Layer a visitor can open from its Video's page: "Explore the language". */
export type PublicLayerCard = { id: string; title: string; level: string; span: string; path: string };

/**
 * A Video as visitors see it: its footage's shape (kept, never cropped), where a short-lived address
 * to play it comes from, and the Learning Layers that are public on it right now.
 */
export type PublicVideo = {
  playbackPath: string;
  width: number;
  height: number;
  orientation: Orientation;
  durationMs: number;
  layers: PublicLayerCard[];
};

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
  creator: PublicCreator | null;
  video: PublicVideo | null;
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
const AREA_TYPES = ["article", "resource", "episode", "video"] as const;

/**
 * The item at /{area}/{slug}: the published, eligible Article, Resource or Episode; a redirect from an old
 * slug; a withdrawn notice; or nothing. An ineligible item answers "missing", never its draft.
 */
export async function findPublicArticle(
  db: Database,
  area: PrimaryArea,
  slug: string,
  now = new Date(),
  types: readonly ContentType[] = AREA_TYPES,
): Promise<PublicLookup> {
  const item = await db
    .select()
    .from(contentItem)
    .where(and(eq(contentItem.primaryArea, area), eq(contentItem.slug, slug), inArray(contentItem.type, [...types])))
    .get();

  if (!item) {
    const redirect = await db
      .select({ item: contentItem })
      .from(slugRedirect)
      .innerJoin(contentItem, eq(contentItem.id, slugRedirect.contentItemId))
      .where(and(eq(slugRedirect.primaryArea, area), eq(slugRedirect.slug, slug)))
      .get();
    // An old address answers only where that type lives (a Creator's old slug under /connect/creators).
    if (!redirect || !(types as readonly string[]).includes(redirect.item.type)) return { kind: "missing" };
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
    creator: snapshot.creator ? await publicCreator(db, snapshot.title, snapshot.creator, now) : null,
    video: await (async () => {
      const footage = footageOf(snapshot);
      return footage ? publicVideo(db, item, footage, now) : null;
    })(),
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
  const asset = details.audioAssetId
    ? await db.select({ type: mediaAsset.type }).from(mediaAsset).where(eq(mediaAsset.id, details.audioAssetId)).get()
    : undefined;
  return {
    audioPath: details.videoAssetId ? null : episodeAudioPath(itemId),
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

async function publicCreator(db: Database, name: string, details: CreatorDetails, now: Date): Promise<PublicCreator> {
  const portrait = await db
    .select({ altText: mediaAsset.altText })
    .from(mediaAsset)
    .where(eq(mediaAsset.id, details.portraitAssetId))
    .get();
  const [sample] = await relatedItems(db, [details.sampleItemId], now);
  return {
    portrait: {
      src: imagePath(details.portraitAssetId, 640),
      srcSet: [320, 640, 960].map((width) => `${imagePath(details.portraitAssetId, width)} ${width}w`).join(", "),
      alt: portrait?.altText || `Portrait of ${name}`,
    },
    location: details.location,
    languages: details.languages,
    mediaTypes: details.mediaTypes.map((type) => MEDIA_TYPES[type]),
    sample: sample ?? null,
  };
}

/** Where a Video's short-lived playback address comes from: through the Video, so eligibility is decided each time. */
export const videoPlaybackPath = (itemId: string) => `/videos/${itemId}/playback`;

/** A Learning Layer's player, under its Video's address. */
export const layerPath = (item: ItemRow, layerId: string) => `${itemPath(item)}/language/${layerId}`;

async function publicVideo(db: Database, item: ItemRow, videoAssetId: string, now: Date): Promise<PublicVideo | null> {
  const asset = await readyVideo(db, videoAssetId);
  if (!asset) return null;
  return {
    playbackPath: videoPlaybackPath(item.id),
    width: asset.width,
    height: asset.height,
    orientation: asset.orientation,
    durationMs: asset.durationMs,
    layers: (await publicLayers(db, item.id, now)).map(({ id, snapshot }) => ({
      id,
      title: snapshot.title,
      level: LAYER_LEVELS[snapshot.level],
      span: layerSpan(snapshot.excerpt),
      path: layerPath(item, id),
    })),
  };
}

/**
 * The Learning Layers public on a Video right now: published, and their published Revision eligible
 * (ADR-0007). The Video itself is public, since only its public page asks (#28's serving rule).
 */
export async function publicLayers(db: Database, contentItemId: string, now = new Date()) {
  const rows = await db
    .select({ id: learningLayer.id, revisionId: learningLayer.currentPublishedRevisionId })
    .from(learningLayer)
    .where(and(eq(learningLayer.contentItemId, contentItemId), eq(learningLayer.publicationState, "published")))
    .orderBy(asc(learningLayer.createdAt));
  const shown = await Promise.all(
    rows.map(async ({ id, revisionId }) => {
      if (!revisionId) return null;
      const review = await loadLayerReview(db, revisionId);
      if (!review || !(await layerEligibility(db, review, now)).eligible) return null;
      return { id, revisionId, snapshot: review.snapshot, languageVariety: review.layer.languageVariety };
    }),
  );
  return shown.filter((layer) => layer !== null);
}

export type PublicLayerLookup =
  | {
      kind: "found";
      video: PublicArticle;
      layer: { id: string; revisionId: string; snapshot: LearningLayerSnapshot; languageVariety: string };
    }
  | Exclude<PublicLookup, { kind: "found" }>;

/**
 * A Learning Layer's player at /{area}/{slug}/language/{id}: found only while both its Video and the
 * Learning Layer itself are public right now. An old Video address redirects to the new one.
 */
export async function findPublicLayer(
  db: Database,
  area: PrimaryArea,
  slug: string,
  layerId: string,
  now = new Date(),
): Promise<PublicLayerLookup> {
  const found = await findPublicArticle(db, area, slug, now, ["video"]);
  if (found.kind === "moved") return { kind: "moved", to: `${found.to}/language/${layerId}` };
  if (found.kind !== "found") return found;
  // The Video's page has just decided which of its Learning Layers are public.
  if (!found.article.video?.layers.some((card) => card.id === layerId)) return { kind: "missing" };
  const row = await db
    .select({ revisionId: learningLayer.currentPublishedRevisionId })
    .from(learningLayer)
    .where(eq(learningLayer.id, layerId))
    .get();
  const review = row?.revisionId ? await loadLayerReview(db, row.revisionId) : null;
  if (!review) return { kind: "missing" };
  return {
    kind: "found",
    video: found.article,
    layer: {
      id: layerId,
      revisionId: review.revisionId,
      snapshot: review.snapshot,
      languageVariety: review.layer.languageVariety,
    },
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
