import { and, desc, eq, inArray } from "drizzle-orm";
import { contentItem, revision } from "~db/schema";
import { AREA_NAMES, isPrimaryArea, type PrimaryArea } from "./areas";
import { type ArticleBody, EMPTY_ARTICLE_BODY, embeddedItemIds, parseArticleBody } from "./article-body";
import { ARTICLE_LIMITS, type ArticleSnapshot, articleReviewFields, type FieldErrors } from "./article-fields";
import { CONTENT_TYPE_NAMES, type ContentType, PAGE_AREA } from "./content-types";
import { readCreatorFields } from "./creator-fields";
import type { Database } from "./db.server";
import { readEpisodeFields } from "./episode-fields";
import { INFO_PAGES } from "./info-pages";
import { toLanguageVariety } from "./language-variety";
import { readyDownload, readyEpisodeAudio, readyImage } from "./media-delivery.server";
import { readResourceFields } from "./resource-fields";
import { CONTENT_FLAGS, fingerprintsOf } from "./review-rules";
import { getContentItem } from "./revisions.server";
import { existingTopicIds } from "./topics.server";

export type ArticleFormResult =
  | { ok: true; snapshot: ArticleSnapshot }
  /** On failure, `values` holds what was submitted, so the form can be shown again as it was. */
  | { ok: false; errors: FieldErrors; values: ArticleSnapshot };

/** At most this many related items, chosen by hand (docs/phase-1a-defaults.md §5). */
export const RELATED_LIMIT = 6;

/**
 * Reads the content form. Title, summary, credit and at least one Topic are required on every
 * save, the body must pass the allowlist, and flagging language instruction needs the Language
 * Variety taught. A Resource also needs its file or link and what visitors read before using it;
 * an Episode needs its audio, host, recording date and length (its transcript can follow).
 */
export async function readArticleForm(
  db: Database,
  form: FormData,
  { type, itemId }: { type: ContentType; itemId?: string } = { type: "article" },
): Promise<ArticleFormResult> {
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

  // Site Pages sit outside the Topics, as they do outside the areas.
  const topicIds = type === "page" ? [] : [...new Set(form.getAll("topicId").map(String))];
  const known = await existingTopicIds(db, topicIds);
  if (!topicIds.length && type !== "page") errors.topicIds = "Choose at least one topic.";
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

  const relatedIds = [...new Set(form.getAll("relatedId").map(String))].filter((id) => id && id !== itemId);
  if (relatedIds.length > RELATED_LIMIT) errors.relatedIds = `Choose at most ${RELATED_LIMIT} related items.`;
  else if (await anyMissing(db, relatedIds)) errors.relatedIds = "One of those related items no longer exists.";

  let resource: ArticleSnapshot["resource"];
  if (type === "resource") {
    const read = readResourceFields(form);
    if (!read.ok) {
      Object.assign(errors, read.errors);
      resource = read.values as ArticleSnapshot["resource"];
    } else {
      resource = read.details;
      if (read.details.source.kind === "file" && !(await readyDownload(db, read.details.source.assetId))) {
        errors.resourceAssetId = "Choose a PDF or audio file that has passed its virus scan.";
      }
    }
  }
  let episode: ArticleSnapshot["episode"];
  if (type === "episode") {
    const read = readEpisodeFields(form);
    if (!read.ok) {
      Object.assign(errors, read.errors);
      episode = read.values as ArticleSnapshot["episode"];
    } else {
      episode = read.details;
      if (!(await readyEpisodeAudio(db, read.details.audioAssetId))) {
        errors.episodeAudioAssetId = "Choose an MP3 or M4A file that has passed its virus scan.";
      }
    }
  }
  let creator: ArticleSnapshot["creator"];
  if (type === "creator") {
    const read = readCreatorFields(form);
    if (!read.ok) Object.assign(errors, read.errors);
    creator = (read.ok ? read.details : read.values) as ArticleSnapshot["creator"];
    // What was chosen is checked even when other fields need fixing, so every problem shows at once.
    if (creator?.portraitAssetId && !(await readyImage(db, creator.portraitAssetId))) {
      errors.creatorPortraitAssetId = "Choose an image that has passed its virus scan.";
    }
    if (creator?.sampleItemId) {
      const sample = await db
        .select({ id: contentItem.id, type: contentItem.type })
        .from(contentItem)
        .where(eq(contentItem.id, creator.sampleItemId))
        .get();
      if (!sample || sample.id === itemId || sample.type === "creator" || sample.type === "page") {
        errors.creatorSampleItemId = "Choose an Article, Resource or Episode that shows their work.";
      }
    }
  }
  const extras = {
    ...(relatedIds.length ? { relatedIds } : {}),
    ...(resource ? { resource } : {}),
    ...(episode ? { episode } : {}),
    ...(creator ? { creator } : {}),
  };

  if (!parsed.ok || Object.keys(errors).length) {
    // A body the allowlist refused goes back as sent, so the writer can fix it rather than lose it;
    // it is only ever loaded into the editor, never rendered as HTML.
    const body = parsed.ok ? parsed.body : isDoc(submittedBody) ? (submittedBody as ArticleBody) : EMPTY_ARTICLE_BODY;
    return {
      ok: false,
      errors,
      values: { title, summary, credit, topicIds, body, sources, flags, languageVariety, ...extras },
    };
  }
  return {
    ok: true,
    snapshot: { title, summary, credit, topicIds, body: parsed.body, sources, flags, languageVariety, ...extras },
  };
}

/** The footer pages (info-pages.ts) that have no Page yet, for creating one. */
export async function availablePages(db: Database) {
  const existing = await db
    .select({ slug: contentItem.slug })
    .from(contentItem)
    .where(and(eq(contentItem.type, "page"), eq(contentItem.primaryArea, PAGE_AREA)));
  const taken = new Set(existing.map((row) => row.slug));
  return INFO_PAGES.filter((page) => !taken.has(page.path)).map(({ path, title }) => ({ path, title }));
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

/** Any Content Item with its current draft; the staff content pages handle every type. */
export const getArticle = (db: Database, id: string) => getContentItem<ArticleSnapshot>(db, id);

/** Every Content Item, newest change first, for the staff content list and item choosers. */
export async function listArticles(db: Database) {
  const rows = await db
    .select({
      id: contentItem.id,
      type: contentItem.type,
      primaryArea: contentItem.primaryArea,
      publicationState: contentItem.publicationState,
      snapshot: revision.snapshot,
      number: revision.number,
    })
    .from(contentItem)
    .innerJoin(revision, eq(revision.id, contentItem.currentDraftRevisionId))
    .orderBy(desc(contentItem.updatedAt));
  return rows.map(({ snapshot, ...row }) => ({
    ...row,
    type: row.type as ContentType,
    typeName: CONTENT_TYPE_NAMES[row.type as ContentType] ?? row.type,
    title: (snapshot as ArticleSnapshot).title,
    topicIds: (snapshot as ArticleSnapshot).topicIds ?? [],
    areaName: isPrimaryArea(row.primaryArea) ? AREA_NAMES[row.primaryArea] : "Site page",
  }));
}

/** Content Items another item may embed or name as related: every one except itself. */
export async function embeddableArticles(db: Database, exceptId?: string) {
  const items = await listArticles(db);
  return items.filter(({ id }) => id !== exceptId).map(({ id, title, typeName }) => ({ id, title, typeName }));
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
