import { and, eq, inArray, like, sql } from "drizzle-orm";
import { expression, expressionReview } from "~db/schema";
import type { Database } from "./db.server";
import { LAYER_LANGUAGE_VARIETY } from "./learning-layer-fields";
import {
  type ExpressionKind,
  type ExpressionReviewFacts,
  type ExpressionWording,
  headKey,
  reviewStanding,
  searchKey,
  vosaSlug,
  wordingFingerprint,
} from "./vosa";
import wordPlayData from "./vosa-data/word-play.json";

/** D1 takes at most 100 bound values in one query, so long lists are asked for in parts. */
async function inChunks<T>(values: string[], read: (chunk: string[]) => Promise<T[]>) {
  const results: T[] = [];
  for (let start = 0; start < values.length; start += 90)
    results.push(...(await read(values.slice(start, start + 90))));
  return results;
}

/** Vosa is the Standard Fijian library (change note 0002). */
export const VOSA_VARIETY = LAYER_LANGUAGE_VARIETY;

export const VOSA_PAGE_SIZE = 60;

type ExpressionRow = typeof expression.$inferSelect;

export const wordingOf = (row: ExpressionRow): ExpressionWording => ({
  kind: row.kind,
  headword: row.headword,
  partOfSpeech: row.partOfSpeech,
  generalMeaning: row.generalMeaning,
  literalMeaning: row.literalMeaning,
  grammarNote: row.grammarNote,
  pronunciation: row.pronunciation,
  notes: row.notes,
  details: row.details,
  citations: row.citations,
  themes: row.themes,
});

/**
 * The approval that holds for each of these Expressions now, by id: only those whose current
 * wording a Language Reviewer approved. Only Expressions with any approval are read in full.
 */
export async function currentApprovals(db: Database, ids?: string[]) {
  const reviews = ids
    ? await inChunks(ids, (chunk) =>
        db.select().from(expressionReview).where(inArray(expressionReview.expressionId, chunk)),
      )
    : await db.select().from(expressionReview);
  const byExpression = new Map<string, ExpressionReviewFacts[]>();
  for (const review of reviews) {
    byExpression.set(review.expressionId, [...(byExpression.get(review.expressionId) ?? []), review]);
  }
  const approvals = new Map<string, ExpressionReviewFacts>();
  if (!byExpression.size) return approvals;
  const rows = await inChunks([...byExpression.keys()], (chunk) =>
    db.select().from(expression).where(inArray(expression.id, chunk)),
  );
  for (const row of rows) {
    const standing = reviewStanding(await wordingFingerprint(wordingOf(row)), byExpression.get(row.id) ?? []);
    if (standing) approvals.set(row.id, standing);
  }
  return approvals;
}

export type VosaListingFilter = {
  q?: string;
  kind?: ExpressionKind;
  theme?: string;
  grammarGroup?: string;
  page?: number;
};

export type VosaHeadword = {
  slug: string;
  headword: string;
  meaning: string;
  partOfSpeech: string;
  kind: ExpressionKind;
  senses: number;
  reviewed: boolean;
};

const alphabet = new Intl.Collator("en", { sensitivity: "base" });

/**
 * Headwords for a listing or a search: one line per headword, reviewed headwords first (the
 * founder's decision in change note 0002), then A to Z. Every word searched for must match.
 */
export async function vosaListing(db: Database, filter: VosaListingFilter) {
  const words = searchKey(filter.q ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 8);
  const rows = await db
    .select({
      id: expression.id,
      slug: expression.slug,
      headword: expression.headword,
      kind: expression.kind,
      partOfSpeech: expression.partOfSpeech,
      generalMeaning: expression.generalMeaning,
    })
    .from(expression)
    .where(
      and(
        eq(expression.variety, VOSA_VARIETY),
        filter.kind ? eq(expression.kind, filter.kind) : undefined,
        filter.theme
          ? sql`exists (select 1 from json_each(${expression.themes}) where json_each.value = ${filter.theme})`
          : undefined,
        filter.grammarGroup
          ? sql`json_extract(${expression.details}, '$.grammarGroup') = ${filter.grammarGroup}`
          : undefined,
        ...words.map((word) => like(expression.searchText, `%${word.replace(/[%_]/g, "")}%`)),
      ),
    );
  const approvals = await currentApprovals(db);
  const groups = new Map<string, VosaHeadword>();
  for (const row of rows) {
    const group = groups.get(row.slug);
    if (group) {
      group.senses += 1;
      group.reviewed ||= approvals.has(row.id);
      if (!group.meaning) group.meaning = row.generalMeaning;
      continue;
    }
    groups.set(row.slug, {
      slug: row.slug,
      headword: row.headword,
      meaning: row.generalMeaning,
      partOfSpeech: row.partOfSpeech,
      kind: row.kind,
      senses: 1,
      reviewed: approvals.has(row.id),
    });
  }
  const sorted = [...groups.values()].sort(
    (a, b) => Number(b.reviewed) - Number(a.reviewed) || alphabet.compare(a.headword, b.headword),
  );
  const pages = Math.max(1, Math.ceil(sorted.length / VOSA_PAGE_SIZE));
  const page = Math.min(Math.max(1, filter.page ?? 1), pages);
  return {
    headwords: sorted.slice((page - 1) * VOSA_PAGE_SIZE, page * VOSA_PAGE_SIZE),
    total: sorted.length,
    reviewed: sorted.filter((group) => group.reviewed).length,
    page,
    pages,
  };
}

export type WordPlayCard = {
  word?: string;
  question: string;
  answer: string;
  options?: string[];
  correct?: string;
  incorrectHint?: string;
  clues?: string[];
  parts?: { text: string; role: string }[];
  linkWord?: string;
  sayingId?: string;
  cultureTerm?: string;
};

export type WordPlayActivity = {
  title: string;
  intro: string;
  hint?: string;
  after?: string;
  cards: WordPlayCard[];
  link?: { label: string; href: string };
};

const WORD_PLAY = wordPlayData as unknown as Record<string, WordPlayActivity[]>;

/** The quizzes for a headword, kept as the apps site wrote them (change note 0002). */
export const wordPlayFor = (headword: string) => WORD_PLAY[headKey(headword)] ?? [];

/**
 * One headword's page: every Expression at the address, each with the approval that holds for its
 * current wording, and the addresses of the other words and sayings it links to.
 */
export async function vosaEntry(db: Database, slug: string) {
  const rows = await db
    .select()
    .from(expression)
    .where(and(eq(expression.variety, VOSA_VARIETY), eq(expression.slug, slug)));
  if (!rows.length) return null;
  const order = { word: 0, "grammar-term": 1, saying: 2 } as const;
  rows.sort((a, b) => order[a.kind] - order[b.kind]);
  const approvals = await currentApprovals(
    db,
    rows.map((row) => row.id),
  );
  const quiz = rows.some((row) => row.details.quiz) ? wordPlayFor(rows[0].headword) : [];

  // Words this page may link to: related words, and the words and sayings the quiz points at.
  const mentioned = new Set<string>();
  for (const row of rows) for (const word of row.details.relatedWords ?? []) mentioned.add(vosaSlug(word));
  const sayingIds = new Set<string>();
  for (const activity of quiz) {
    for (const card of activity.cards) {
      for (const word of [card.linkWord ?? card.word, ...(card.clues ?? [])]) if (word) mentioned.add(vosaSlug(word));
      for (const part of card.parts ?? []) {
        mentioned.add(vosaSlug(part.text));
        mentioned.add(vosaSlug(part.text.replace(/^-+|-+$/g, "")));
      }
      if (card.sayingId) sayingIds.add(card.sayingId);
    }
  }
  mentioned.delete(slug);
  const linked = await inChunks([...mentioned], (chunk) =>
    db
      .selectDistinct({ slug: expression.slug, headword: expression.headword })
      .from(expression)
      .where(and(eq(expression.variety, VOSA_VARIETY), inArray(expression.slug, chunk))),
  );
  const sayings = await inChunks([...sayingIds], (chunk) =>
    db
      .select({ id: expression.id, slug: expression.slug, headword: expression.headword })
      .from(expression)
      .where(inArray(expression.id, chunk)),
  );
  return {
    slug,
    headword: rows[0].headword,
    expressions: rows.map((row) => ({ ...row, approval: approvals.get(row.id) ?? null })),
    quiz,
    linked: Object.fromEntries(linked.map((word) => [word.slug, word.headword])),
    sayings: Object.fromEntries(sayings.map((saying) => [saying.id, saying])),
  };
}

/** The grammar terms, by the name they're written with, for linking Tuvavosa words in any text. */
export async function grammarTermSlugs(db: Database) {
  const terms = await db
    .select({ headword: expression.headword, slug: expression.slug })
    .from(expression)
    .where(and(eq(expression.variety, VOSA_VARIETY), eq(expression.kind, "grammar-term")));
  return Object.fromEntries(terms.map((term) => [searchKey(term.headword), term.slug]));
}

/** Every headword's address, for the sitemap. */
export async function vosaSlugs(db: Database) {
  const rows = await db
    .selectDistinct({ slug: expression.slug })
    .from(expression)
    .where(eq(expression.variety, VOSA_VARIETY));
  return rows.map((row) => row.slug).filter(Boolean);
}
