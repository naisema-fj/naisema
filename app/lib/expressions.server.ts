import { and, desc, eq, like } from "drizzle-orm";
import { expression, expressionReview, submission } from "~db/schema";
import { audit } from "./audit.server";
import type { Database } from "./db.server";
import { can, type Staff } from "./roles";
import {
  approvalRefusal,
  type ExpressionDetails,
  type ExpressionKind,
  type ExpressionWording,
  isExpressionKind,
  reviewStanding,
  searchKey,
  searchText,
  VOSA_THEMES,
  vosaSlug,
  wordingFingerprint,
} from "./vosa";
import { currentApprovals, VOSA_VARIETY, wordingOf } from "./vosa.server";

/**
 * The staff side of the Expression library (change note 0002, ADR-0017): editors write an
 * Expression's wording, and a Language Reviewer for its variety approves that exact wording.
 */

export const STAFF_PAGE_SIZE = 100;

export class ExpressionRefused extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Who may open the library: editors, who write Expressions, and Language Reviewers, who approve them. */
export const mayUseLibrary = (person: Staff) => can(person, "content.edit") || can(person, "review.language");

export type ReviewFilter = "all" | "draft" | "reviewed";

/** The library for staff, drafts and reviewed alike, searched and filtered by review state. */
export async function staffList(
  db: Database,
  filter: { q: string; kind: ExpressionKind | null; state: ReviewFilter; page: number },
) {
  const words = searchKey(filter.q).split(" ").filter(Boolean).slice(0, 8);
  const rows = await db
    .select({
      id: expression.id,
      headword: expression.headword,
      kind: expression.kind,
      generalMeaning: expression.generalMeaning,
      slug: expression.slug,
      updatedAt: expression.updatedAt,
    })
    .from(expression)
    .where(
      and(
        eq(expression.variety, VOSA_VARIETY),
        filter.kind ? eq(expression.kind, filter.kind) : undefined,
        ...words.map((word) => like(expression.searchText, `%${word.replace(/[%_]/g, "")}%`)),
      ),
    )
    .orderBy(expression.headword);
  const approvals = await currentApprovals(db);
  const shown = rows
    .map((row) => ({ ...row, approval: approvals.get(row.id) ?? null }))
    .filter((row) => filter.state === "all" || (filter.state === "reviewed") === Boolean(row.approval));
  const pages = Math.max(1, Math.ceil(shown.length / STAFF_PAGE_SIZE));
  const page = Math.min(Math.max(1, filter.page), pages);
  return {
    rows: shown.slice((page - 1) * STAFF_PAGE_SIZE, page * STAFF_PAGE_SIZE),
    total: shown.length,
    reviewed: approvals.size,
    page,
    pages,
  };
}

/** One Expression for staff: its wording, its fingerprint now, and every approval it has had. */
export async function staffExpression(db: Database, id: string) {
  const row = await db.query.expression.findFirst({ where: eq(expression.id, id) });
  if (!row) return null;
  const reviews = await db
    .select()
    .from(expressionReview)
    .where(eq(expressionReview.expressionId, id))
    .orderBy(desc(expressionReview.createdAt));
  const fingerprint = await wordingFingerprint(wordingOf(row));
  return { row, fingerprint, reviews, approval: reviewStanding(fingerprint, reviews) };
}

const text = (form: FormData, name: string, limit: number) =>
  String(form.get(name) ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, limit);

const list = (value: string) => [
  ...new Set(
    value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
  ),
];

/** The wording a staff form sends, on top of what the Expression already carries that the form doesn't edit. */
export function readWording(form: FormData, current: ExpressionWording | null): ExpressionWording {
  const kindValue = String(form.get("kind") ?? "word");
  const kind: ExpressionKind = isExpressionKind(kindValue) ? kindValue : "word";
  const headword = text(form, "headword", 250);
  if (!headword) throw new ExpressionRefused("Enter the word, phrase or saying.");
  const exampleFijian = text(form, "exampleFijian", 500);
  const exampleEnglish = text(form, "exampleEnglish", 500);
  if (Boolean(exampleFijian) !== Boolean(exampleEnglish))
    throw new ExpressionRefused("Give the example in Fijian and in English, or leave both empty.");
  const before = current?.details ?? {};
  const firstExample = before.usageExamples?.[0];
  // An example kept word for word keeps the words the source picked out; a changed one is plain text.
  const example =
    exampleFijian && firstExample?.fijian === exampleFijian && firstExample.english === exampleEnglish
      ? firstExample
      : exampleFijian
        ? { fijian: exampleFijian, english: exampleEnglish }
        : null;
  const details: ExpressionDetails = {
    ...before,
    usageExamples: example ? [example, ...(before.usageExamples ?? []).slice(1)] : [],
    comparison: text(form, "comparison", 1500),
    learnerComment: text(form, "learnerComment", 1000),
    relatedWords: list(text(form, "relatedWords", 1000)),
    searchKeywords: list(text(form, "searchKeywords", 1000)),
  };
  for (const key of ["usageExamples", "relatedWords", "searchKeywords"] as const)
    if (!details[key]?.length) delete details[key];
  for (const key of ["comparison", "learnerComment"] as const) if (!details[key]) delete details[key];
  const themes = form
    .getAll("themes")
    .map(String)
    .filter((id) => VOSA_THEMES.some((theme) => theme.id === id));
  return {
    kind,
    headword,
    partOfSpeech: text(form, "partOfSpeech", 100),
    generalMeaning: text(form, "generalMeaning", 2000),
    literalMeaning: text(form, "literalMeaning", 1000),
    grammarNote: text(form, "grammarNote", 4000),
    pronunciation: text(form, "pronunciation", 500),
    notes: text(form, "notes", 2000),
    details,
    citations: current?.citations ?? [],
    themes,
  };
}

/** Writes an Expression's wording. A change of wording leaves it a draft until approved again (ADR-0017). */
export async function saveExpression(
  db: Database,
  actor: Staff,
  id: string | null,
  wording: ExpressionWording,
  from: { submissionId?: string } = {},
) {
  if (!can(actor, "content.edit")) throw new ExpressionRefused("Your roles don't include editing the library.", 403);
  const values = {
    ...wording,
    slug: vosaSlug(wording.headword),
    searchText: searchText(wording),
    updatedBy: actor.email,
    updatedAt: new Date(),
  };
  if (!id) {
    const newId = crypto.randomUUID();
    await db.batch([
      db.insert(expression).values({ id: newId, variety: VOSA_VARIETY, createdBy: actor.email, ...values }),
      audit(db, actor.email, "expression.added", { type: "expression", id: newId }, from),
    ]);
    return { id: newId, changed: true };
  }
  const found = await staffExpression(db, id);
  if (!found) throw new ExpressionRefused("That Expression doesn't exist.", 404);
  if ((await wordingFingerprint(wording)) === found.fingerprint) return { id, changed: false };
  await db.batch([
    db.update(expression).set(values).where(eq(expression.id, id)),
    audit(db, actor.email, "expression.changed", { type: "expression", id }, { wasReviewed: Boolean(found.approval) }),
  ]);
  return { id, changed: true };
}

/**
 * A Language Reviewer approves the wording they were shown. If it changed since they opened it,
 * nothing is approved: they read the new wording first.
 */
export async function approveExpression(db: Database, actor: Staff, id: string, seenFingerprint: string) {
  const found = await staffExpression(db, id);
  if (!found) throw new ExpressionRefused("That Expression doesn't exist.", 404);
  const refusal = approvalRefusal(
    { email: actor.email, mayReviewLanguage: can(actor, "review.language"), languageVariety: actor.languageVariety },
    { variety: found.row.variety, updatedBy: found.row.updatedBy },
  );
  if (refusal) throw new ExpressionRefused(refusal, 403);
  if (found.fingerprint !== seenFingerprint)
    throw new ExpressionRefused("Someone changed this wording since you opened it. Read it again, then approve it.");
  if (found.approval) return;
  const reviewId = crypto.randomUUID();
  await db.batch([
    db.insert(expressionReview).values({
      id: reviewId,
      expressionId: id,
      variety: found.row.variety,
      fingerprint: found.fingerprint,
      reviewerEmail: actor.email,
    }),
    audit(db, actor.email, "expression.approved", { type: "expression", id }, { review: reviewId }),
  ]);
}

/** What a "suggest a word" Submission offers a new draft: the word and its meaning, as sent. */
export async function suggestionDraft(db: Database, submissionId: string) {
  const row = await db.query.submission.findFirst({ where: eq(submission.id, submissionId) });
  if (row?.form !== "suggest-word") return null;
  return { submissionId: row.id, headword: row.fields.word ?? "", generalMeaning: row.fields.meaning ?? "" };
}
