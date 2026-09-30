import type { ArticleBody } from "./article-body";
import type { ReviewType } from "./permissions";
import type { ContentFlag } from "./review-rules";

/** Everything an editor writes on an Article; each save stores one of these as a Revision. */
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
};

export type ArticleField = keyof ArticleSnapshot | "primaryArea";
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
  return {
    language: { title, summary, body, languageVariety },
    cultural: { title, summary, body, credit, topicIds, sources },
    editorial: { title, summary, body, credit, topicIds, sources },
    accessibility: { title, body },
    safeguarding: { title, summary, body },
  };
}
