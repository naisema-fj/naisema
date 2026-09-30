import { desc, eq, inArray } from "drizzle-orm";
import { contentItem, revision } from "~db/schema";
import { AREA_NAMES, isPrimaryArea, type PrimaryArea } from "./areas";
import { type ArticleBody, EMPTY_ARTICLE_BODY, embeddedItemIds, parseArticleBody } from "./article-body";
import { ARTICLE_LIMITS, type ArticleSnapshot, articleReviewFields, type FieldErrors } from "./article-fields";
import type { Database } from "./db.server";
import { toLanguageVariety } from "./language-variety";
import { CONTENT_FLAGS, fingerprintsOf } from "./review-rules";
import { getContentItem } from "./revisions.server";
import { existingTopicIds } from "./topics.server";

export type ArticleFormResult =
  | { ok: true; snapshot: ArticleSnapshot }
  /** On failure, `values` holds what was submitted, so the form can be shown again as it was. */
  | { ok: false; errors: FieldErrors; values: ArticleSnapshot };

/**
 * Reads the article form. Title, summary, credit and at least one Topic are required on every
 * save, the body must pass the allowlist, and flagging language instruction needs the Language
 * Variety taught.
 */
export async function readArticleForm(db: Database, form: FormData): Promise<ArticleFormResult> {
  const errors: FieldErrors = {};
  const text = (field: keyof typeof ARTICLE_LIMITS, label: string) => {
    const value = String(form.get(field) ?? "").trim();
    const limit = ARTICLE_LIMITS[field];
    if (!value) errors[field] = `Enter the ${label}.`;
    else if (value.length > limit) errors[field] = `The ${label} can be at most ${limit} characters.`;
    return value;
  };
  const title = text("title", "title");
  const summary = text("summary", "summary");
  const credit = text("credit", "credit");

  const flags = CONTENT_FLAGS.filter((flag) => form.getAll("flag").includes(flag));
  let languageVariety: string | null = null;
  if (flags.includes("languageInstruction")) {
    const entered = String(form.get("languageVariety") ?? "");
    languageVariety = toLanguageVariety(entered);
    if (!entered.trim()) errors.languageVariety = "Enter the Language Variety this article teaches.";
    else if (!languageVariety) {
      errors.languageVariety = "Write the Language Variety in letters, digits and hyphens, like standard-fijian.";
    }
  }
  const sources = String(form.get("sources") ?? "").trim();
  if (sources.length > ARTICLE_LIMITS.sources) {
    errors.sources = `The sources can be at most ${ARTICLE_LIMITS.sources} characters.`;
  } else if (flags.includes("historicalClaims") && !sources) {
    errors.sources = "List the sources for the historical claims.";
  }

  const topicIds = [...new Set(form.getAll("topicId").map(String))];
  const known = await existingTopicIds(db, topicIds);
  if (!topicIds.length) errors.topicIds = "Choose at least one topic.";
  else if (topicIds.some((id) => !known.has(id))) errors.topicIds = "One of those topics no longer exists.";

  let submittedBody: unknown;
  try {
    submittedBody = JSON.parse(String(form.get("body") ?? ""));
  } catch {
    submittedBody = undefined;
  }
  const parsed = parseArticleBody(submittedBody);
  if (!parsed.ok) errors.body = parsed.error;
  else if (await anyMissing(db, embeddedItemIds(parsed.body))) {
    errors.body = "The body embeds a Content Item that doesn't exist.";
  }

  if (!parsed.ok || Object.keys(errors).length) {
    // A body the allowlist refused goes back as sent, so the writer can fix it rather than lose it;
    // it is only ever loaded into the editor, never rendered as HTML.
    const body = parsed.ok ? parsed.body : isDoc(submittedBody) ? (submittedBody as ArticleBody) : EMPTY_ARTICLE_BODY;
    return { ok: false, errors, values: { title, summary, credit, topicIds, body, sources, flags, languageVariety } };
  }
  return {
    ok: true,
    snapshot: { title, summary, credit, topicIds, body: parsed.body, sources, flags, languageVariety },
  };
}

/** The primary area chosen when an Article is created, or null if none of the six was chosen. */
export function readPrimaryArea(form: FormData): PrimaryArea | null {
  const area = String(form.get("primaryArea") ?? "");
  return isPrimaryArea(area) ? area : null;
}

const isDoc = (value: unknown) =>
  typeof value === "object" && value !== null && (value as { type?: unknown }).type === "doc";

async function anyMissing(db: Database, contentItemIds: string[]): Promise<boolean> {
  if (!contentItemIds.length) return false;
  const rows = await db.select({ id: contentItem.id }).from(contentItem).where(inArray(contentItem.id, contentItemIds));
  return rows.length !== new Set(contentItemIds).size;
}

/** An Article snapshot's fingerprints, one per Review Type, for storing with its Revision. */
export const articleFingerprints = (snapshot: ArticleSnapshot) => fingerprintsOf(articleReviewFields(snapshot));

export const getArticle = (db: Database, id: string) => getContentItem<ArticleSnapshot>(db, id, "article");

export async function listArticles(db: Database) {
  const rows = await db
    .select({
      id: contentItem.id,
      primaryArea: contentItem.primaryArea,
      publicationState: contentItem.publicationState,
      snapshot: revision.snapshot,
      number: revision.number,
    })
    .from(contentItem)
    .innerJoin(revision, eq(revision.id, contentItem.currentDraftRevisionId))
    .where(eq(contentItem.type, "article"))
    .orderBy(desc(contentItem.updatedAt));
  return rows.map(({ snapshot, ...row }) => ({
    ...row,
    title: (snapshot as ArticleSnapshot).title,
    areaName: AREA_NAMES[row.primaryArea as PrimaryArea],
  }));
}

/** Articles another article's body may embed: every one except itself. */
export async function embeddableArticles(db: Database, exceptId?: string) {
  const articles = await listArticles(db);
  return articles.filter(({ id }) => id !== exceptId).map(({ id, title }) => ({ id, title }));
}

/** Titles and admin links for the Content Items a body embeds, keyed by ID, for the renderer. */
export async function embedsFor(db: Database, body: ArticleBody) {
  const ids = embeddedItemIds(body);
  if (!ids.length) return {};
  const articles = await listArticles(db);
  return Object.fromEntries(
    articles
      .filter((article) => ids.includes(article.id))
      .map((article) => [article.id, { title: article.title, href: `/admin/articles/${article.id}` }]),
  );
}
