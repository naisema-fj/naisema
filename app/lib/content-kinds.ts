import type { ArticleSnapshot } from "./article-fields";
import { episodeParts, episodeRecording } from "./episode-fields";
import type { ReviewType } from "./permissions";
import type { RightsPart } from "./rights-rules";

/**
 * What each kind of Content Item adds to what every Content Item has (content-types.ts): an
 * Article and a Page are words only; a Resource offers a file or link, an Episode a recording, a
 * Creator Profile a portrait and a free sample, and a Video its footage. Each kind says, in one
 * place, which media library files it offers (its main one first), what footage it plays, what
 * each review covers of its own parts, and which parts need Rights Records of their own; shared
 * code asks the kind instead of looking for each part. What each kind needs before it can be
 * public is in app/lib/visibility.server.ts, by the same kinds.
 */

export type ContentKind = {
  /** The media library files it offers of its own, its main one first; its body's are counted for every kind. */
  media(snapshot: ArticleSnapshot): string[];
  /** The footage it plays, if any. */
  footage(snapshot: ArticleSnapshot): string | null;
  /** What each Review Type covers of its own parts, beyond what every Content Item's covers (ADR-0003). */
  reviewFields(snapshot: ArticleSnapshot): Partial<Record<ReviewType, Record<string, unknown>>>;
  /** Its parts that need Rights Records of their own, beyond the item's. */
  rightsParts(snapshot: ArticleSnapshot): RightsPart[];
};

export type ContentKindName = "text" | "resource" | "episode" | "creator" | "video";

const none = (): string[] => [];
const noFootage = () => null;
const noParts = (): RightsPart[] => [];

const TEXT: ContentKind = { media: none, footage: noFootage, reviewFields: () => ({}), rightsParts: noParts };

export const CONTENT_KINDS: Record<ContentKindName, ContentKind> = {
  text: TEXT,
  resource: {
    media: ({ resource }) => (resource?.source.kind === "file" ? [resource.source.assetId] : []),
    footage: noFootage,
    // Its details are what a visitor relies on: source and context, and how accessible it is.
    reviewFields: ({ resource }) =>
      resource
        ? {
            cultural: { resource },
            editorial: { resource },
            accessibility: { resourceAccessibility: resource.accessibility },
          }
        : {},
    rightsParts: noParts,
  },
  episode: {
    media: ({ episode }) => (episode ? [episodeRecording(episode).assetId] : []),
    footage: ({ episode }) => {
      const recording = episode ? episodeRecording(episode) : null;
      return recording?.kind === "video" ? recording.assetId : null;
    },
    // Its recording and transcript are its words, so every review covers them; who speaks and the
    // music and clips it uses are source and context; the date, length and distribution links are
    // editorial facts.
    reviewFields: ({ episode }) => {
      if (!episode) return {};
      const recording = {
        audioAssetId: episode.audioAssetId,
        videoAssetId: episode.videoAssetId,
        transcript: episode.transcript,
      };
      const speakers = { host: episode.host, guests: episode.guests };
      const sourcesUsed = { music: episode.music ?? [], archiveClips: episode.archiveClips ?? [] };
      return {
        language: recording,
        cultural: { ...recording, ...speakers, ...sourcesUsed },
        editorial: {
          ...recording,
          ...speakers,
          ...sourcesUsed,
          recordedOn: episode.recordedOn,
          durationSeconds: episode.durationSeconds,
          distribution: episode.distribution,
        },
        accessibility: recording,
        safeguarding: { ...recording, ...speakers },
      };
    },
    rightsParts: ({ episode }) => (episode ? episodeParts(episode) : []),
  },
  creator: {
    media: ({ creator }) => (creator ? [creator.portraitAssetId] : []),
    footage: noFootage,
    // Its portrait shows a person, so safeguarding covers it with the editorial facts.
    reviewFields: ({ creator }) =>
      creator ? { editorial: { creator }, safeguarding: { portraitAssetId: creator.portraitAssetId } } : {},
    rightsParts: noParts,
  },
  video: {
    media: ({ video }) => (video ? [video.videoAssetId] : []),
    footage: ({ video }) => video?.videoAssetId ?? null,
    // Its footage is what it says and shows, so every review covers which video it is.
    reviewFields: ({ video }) => {
      if (!video) return {};
      const recording = { videoAssetId: video.videoAssetId };
      return {
        language: recording,
        cultural: recording,
        editorial: recording,
        accessibility: recording,
        safeguarding: recording,
      };
    },
    rightsParts: noParts,
  },
};

/** The kind a Revision's snapshot is, by the part it carries; a snapshot carries at most one. */
export function kindOf(snapshot: Pick<ArticleSnapshot, "resource" | "episode" | "creator" | "video">): ContentKindName {
  if (snapshot.resource) return "resource";
  if (snapshot.episode) return "episode";
  if (snapshot.creator) return "creator";
  if (snapshot.video) return "video";
  return "text";
}

export const contentKind = (snapshot: ArticleSnapshot) => CONTENT_KINDS[kindOf(snapshot)];

/** The media library file a Revision is mainly about (a Resource's file, an Episode's recording…), if any. */
export const mainMedia = (snapshot: ArticleSnapshot) => contentKind(snapshot).media(snapshot)[0] ?? null;
