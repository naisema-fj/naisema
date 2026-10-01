/**
 * The kinds of Content Item (docs/decision-log.md, content types in 1a). Each shares the
 * Content Item / Revision model and the review and rights gates (ADR-0006, ADR-0007); a
 * Resource adds a file or link, an Episode its recording and transcript, a Creator Profile the
 * Creator's portrait and free sample, and a Page lives at a fixed address instead of an area.
 */
export const CONTENT_TYPES = ["article", "resource", "episode", "creator", "page"] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_TYPE_NAMES: Record<ContentType, string> = {
  article: "Article",
  resource: "Resource",
  episode: "Episode",
  creator: "Creator Profile",
  page: "Page",
};

export const isContentType = (value: string): value is ContentType =>
  (CONTENT_TYPES as readonly string[]).includes(value);

/** Pages sit outside the six areas, at /{slug}: About, Privacy and the other footer pages. */
export const PAGE_AREA = "site";

/** Episodes are Na iSema Voices: they always sit in the Voices area, whose page lists them. */
export const EPISODE_AREA = "voices";

/** Creator Profiles sit in Connect, at /connect/creators/{slug}, beside Providers and Offerings. */
export const CREATOR_AREA = "connect";

/** Types that always sit in one area, chosen for them rather than by the editor. */
export const FIXED_AREAS: Partial<Record<ContentType, typeof EPISODE_AREA | typeof CREATOR_AREA>> = {
  episode: EPISODE_AREA,
  creator: CREATOR_AREA,
};
