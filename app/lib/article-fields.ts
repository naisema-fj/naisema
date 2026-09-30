import type { ArticleBody } from "./article-body";

/** Everything an editor writes on an Article; each save stores one of these as a Revision. */
export type ArticleSnapshot = {
  title: string;
  summary: string;
  credit: string;
  topicIds: string[];
  body: ArticleBody;
};

export type ArticleField = keyof ArticleSnapshot | "primaryArea";
export type FieldErrors = Partial<Record<ArticleField, string>>;

/** Maximum lengths of the article's text fields, shared by the form and the server check. */
export const ARTICLE_LIMITS = { title: 200, summary: 500, credit: 300 } as const;
