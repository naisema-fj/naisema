/**
 * Vosa, the public Fijian dictionary, built on the Standard Fijian Expression library (change note
 * 0002, ADR-0017). An Expression carries its own language review: a Language Reviewer approves its
 * exact current wording, recorded against a fingerprint of that wording, and any change to the
 * wording leaves it a draft until it is approved again.
 */

import themesData from "./vosa-data/themes.json";

/** Vosa's themes (Fish of Fiji, Calendar and so on): groupings of words, not Topics. */
export const VOSA_THEMES = themesData as { id: string; title: string; description: string }[];

export const EXPRESSION_KINDS = ["word", "grammar-term", "saying"] as const;
export type ExpressionKind = (typeof EXPRESSION_KINDS)[number];
export const isExpressionKind = (value: string): value is ExpressionKind =>
  (EXPRESSION_KINDS as readonly string[]).includes(value);

export const EXPRESSION_KIND_NAMES: Record<ExpressionKind, string> = {
  word: "Word or phrase",
  "grammar-term": "Tuvavosa grammar term",
  saying: "Saying (Vosavosavakaviti)",
};

/** Where a meaning or saying was found: a source in the citation list, and a page or section in it. */
export type Citation = { sourceId: string; page?: number | null; section?: string | null };

/** A Fijian phrase that shows the word in use, with the words to pick out if the source marks them. */
export type UsageExample = {
  fijian: string;
  english: string;
  words?: { text: string; focus?: boolean }[];
  punctuation?: string;
};

/** A Tuvavosa reference table (pronouns, possession, matavu and so on), as Vosa showed it. */
export type GrammarTable = { title: string; columns: string[]; rows: string[][]; note: string };

/**
 * What Vosa adds to an Expression beyond the library's own fields. Everything here is shown on the
 * public page, so it is part of the wording a Language Reviewer approves.
 */
export type ExpressionDetails = {
  /** The Tuvavosa phrase role, in Fijian and English, where the entry shows one. */
  role?: { fijian: string; english: string } | null;
  usageExamples?: UsageExample[];
  relatedWords?: string[];
  comparison?: string;
  learnerComment?: string;
  curiosityQuestion?: string;
  scientificName?: string;
  identificationNote?: string;
  variants?: string[];
  imageLinks?: { label: string; url: string }[];
  searchKeywords?: string[];
  /** For a grammar term: its code (MNR, ds and so on), its function in a few words, and its topic. */
  grammarCode?: string;
  grammarFunction?: string;
  grammarGroup?: string;
  grammarExample?: string;
  marker?: { kind: string; forms: string; position?: string; note?: string } | null;
  tables?: GrammarTable[];
  /** An editorial starting point for exploring the word. */
  exploration?: {
    title?: string;
    text?: string;
    question?: string;
    example?: { fijian: string; english: string };
  } | null;
  /** Where to read more, outside NAISEMA. */
  furtherLink?: { label: string; href: string } | null;
  /** Whether this Expression carries its headword's quiz (one per headword, as Vosa showed it). */
  quiz?: boolean;
  /** A written mark (punctuation) rather than a word, whose role is told in English only. */
  writingTerm?: boolean;
  /** For a saying: how the apps site labelled it (a proverb or an idiom, and its number). */
  sayingLabel?: string;
  /**
   * What the apps site recorded before NAISEMA's own review: whether its English had been checked
   * there, and its own working notes. Shown to staff, never presented as a NAISEMA review.
   */
  appsSite?: { englishChecked: boolean; status: string; notes: string };
};

/** The fields of an Expression that make up its wording, as a reviewer sees them. */
export type ExpressionWording = {
  kind: ExpressionKind;
  headword: string;
  partOfSpeech: string;
  generalMeaning: string;
  literalMeaning: string;
  grammarNote: string;
  pronunciation: string;
  notes: string;
  details: ExpressionDetails;
  citations: Citation[];
  themes: string[];
};

/** Everything but the apps site's own record, which is about history, not wording. */
function wordingForReview(wording: ExpressionWording) {
  const { appsSite: _appsSite, ...details } = wording.details;
  return { ...wording, details };
}

/** JSON with object keys in a fixed order, so the same wording always gives the same text. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** A fingerprint of an Expression's exact wording: an approval holds only while this is unchanged. */
export async function wordingFingerprint(wording: ExpressionWording) {
  const bytes = new TextEncoder().encode(canonical(wordingForReview(wording)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The headword as Vosa groups it: one page holds every Expression with the same headword. */
export const headKey = (headword: string) => headword.normalize("NFC").toLocaleLowerCase("en").trim();

/**
 * A headword's address under /vosa/. Macrons and a trailing hyphen are kept, because Fijian
 * distinguishes vutu from vūtū and the prefix vaka- from the word vaka.
 */
export function vosaSlug(headword: string) {
  return headKey(headword)
    .replace(/[\s/]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "");
}

export const vosaPath = (headword: string) => `/vosa/${encodeURIComponent(vosaSlug(headword))}`;

/** Text for searching: lower case, with marks taken off letters, so "vutu" finds "vūtū". */
export const searchKey = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("en").replace(/\s+/g, " ").trim();

/** Everything a visitor's search can match: the headword, meanings and Vosa's search words. */
export const searchText = (wording: ExpressionWording) =>
  searchKey(
    [
      wording.headword,
      wording.generalMeaning,
      wording.literalMeaning,
      wording.grammarNote,
      ...(wording.details.searchKeywords ?? []),
      ...(wording.details.variants ?? []),
    ].join(" | "),
  );

export type ExpressionReviewFacts = { fingerprint: string; reviewerEmail: string; createdAt: Date };

/**
 * Whether an Expression is reviewed now: the latest approval whose fingerprint matches its current
 * wording. An approval of an earlier wording no longer counts.
 */
export function reviewStanding(fingerprint: string, reviews: ExpressionReviewFacts[]) {
  const matching = reviews
    .filter((review) => review.fingerprint === fingerprint)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return matching[0] ?? null;
}

/**
 * Why a staff member may not approve this wording, or null when they may: they need language
 * review for the Expression's Language Variety, and nobody approves wording they wrote.
 */
export function approvalRefusal(
  reviewer: { email: string; mayReviewLanguage: boolean; languageVariety: string | null },
  expression: { variety: string; updatedBy: string },
) {
  if (!reviewer.mayReviewLanguage) return "Your roles don't include language review.";
  if (reviewer.languageVariety !== expression.variety) return "Your staff record doesn't say you review this variety.";
  if (expression.updatedBy.toLowerCase() === reviewer.email.toLowerCase())
    return "You wrote this wording, so someone else has to review it.";
  return null;
}
