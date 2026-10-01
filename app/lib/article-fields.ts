import type { ArticleBody } from "./article-body";
import type { EpisodeDetails, EpisodeField } from "./episode-fields";
import type { ReviewType } from "./permissions";
import type { ResourceDetails, ResourceField } from "./resource-fields";
import type { ContentFlag } from "./review-rules";

/**
 * Everything an editor writes on a Content Item; each save stores one of these as a Revision.
 * Every content type shares it (content-types.ts); a Resource also has `resource`, an Episode
 * `episode`.
 */
export type ArticleSnapshot = {
  title: string;
  summary: string;
  credit: string;
  topicIds: string[];
  body: ArticleBody;
  /** Where historical claims come from; required when the Revision is flagged for them. */
  sources: string;
  /** The Content Flags set on this Revision, which decide the reviews it needs. */
  flags: ContentFlag[];
  /** The Language Variety a language-instruction Article teaches; null when not flagged. */
  languageVariety: string | null;
  /** Related items, curated by hand across types and in order (docs/phase-1a-defaults.md §5). */
  relatedIds?: string[];
  /** A Resource's file or link and what a visitor reads before using it. */
  resource?: ResourceDetails;
  /** An Episode's recording, speakers, transcript and distribution links. */
  episode?: EpisodeDetails;
};

export type ArticleField = keyof ArticleSnapshot | "primaryArea" | "page" | ResourceField | EpisodeField;
export type FieldErrors = Partial<Record<ArticleField, string>>;

/** Maximum lengths of the article's text fields, shared by the form and the server check. */
export const ARTICLE_LIMITS = { title: 200, summary: 500, credit: 300, sources: 2000 } as const;

/**
 * The fields of an Article each Review Type covers, which its fingerprint is taken over
 * (ADR-0003). Everything a reader sees is text, so language, cultural and safeguarding review
 * all cover the words; cultural and editorial also cover the credit, topics and sources (source
 * and context), and accessibility covers the body's structure and image descriptions. Flags are
 * not covered: they decide which reviews are needed, not what a review approved.
 */
export function articleReviewFields(snapshot: ArticleSnapshot): Record<ReviewType, unknown> {
  const { title, summary, credit, body, languageVariety } = snapshot;
  const sources = snapshot.sources ?? "";
  const topicIds = [...snapshot.topicIds].sort();
  // Covered only when present, so items that have none keep the fingerprints their approvals had.
  // Related items are an editorial choice; a Resource's details are what a visitor relies on.
  const related = snapshot.relatedIds?.length ? { relatedIds: snapshot.relatedIds } : {};
  const resource = snapshot.resource ? { resource: snapshot.resource } : {};
  const resourceAccess = snapshot.resource ? { resourceAccessibility: snapshot.resource.accessibility } : {};
  // An Episode's recording and transcript are its words, so every review covers them; who speaks is
  // source and context; the date, length and distribution links are editorial facts.
  const episode = snapshot.episode;
  const recording = episode ? { audioAssetId: episode.audioAssetId, transcript: episode.transcript } : {};
  const speakers = episode ? { host: episode.host, guests: episode.guests } : {};
  const episodeFacts = episode
    ? { recordedOn: episode.recordedOn, durationSeconds: episode.durationSeconds, distribution: episode.distribution }
    : {};
  return {
    language: { title, summary, body, languageVariety, ...recording },
    cultural: { title, summary, body, credit, topicIds, sources, ...resource, ...recording, ...speakers },
    editorial: {
      title,
      summary,
      body,
      credit,
      topicIds,
      sources,
      ...related,
      ...resource,
      ...recording,
      ...speakers,
      ...episodeFacts,
    },
    accessibility: { title, body, ...resourceAccess, ...recording },
    safeguarding: { title, summary, body, ...recording, ...speakers },
  };
}
