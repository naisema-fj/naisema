import { and, desc, eq, inArray, isNull, lte, ne, gte } from "drizzle-orm";
import { contentItem, review, revision, rightsRecord, submission } from "~db/schema";
import { fijiToday } from "./calendar";
import { REVIEW_TYPE_NAMES, requiredReviews, reviewStanding, type Place } from "./content-rules";
import { eligibilityOf, mayReview, type ItemRow, type RevisionRow } from "./content.server";
import type { Database } from "./db.server";
import { can, type Staff } from "./roles";
import { readableForms } from "./submissions.server";

/**
 * What needs each person's attention on the staff home: their reviews, what is ready to publish,
 * what is still waiting, Rights Records running out, and new messages. Worked out per request,
 * which v1's catalogue size allows.
 */
export async function attention(db: Database, actor: Staff) {
  const items = await db
    .select()
    .from(contentItem)
    .where(ne(contentItem.state, "archived"))
    .orderBy(desc(contentItem.updatedAt))
    .limit(200);
  const latest = items.length
    ? await db.select().from(revision).where(inArray(revision.itemId, items.map((item) => item.id)))
    : [];
  const newest = new Map<string, RevisionRow>();
  for (const rev of latest) if ((newest.get(rev.itemId)?.number ?? 0) < rev.number) newest.set(rev.itemId, rev);
  // Only items whose latest version isn't the one published, and has been started on.
  const pending = items
    .map((item) => ({ item, revision: newest.get(item.id) as RevisionRow }))
    .filter(({ item, revision: rev }) => rev && rev.id !== item.publishedRevisionId && rev.number > 1);
  const decided = await eligibilityOf(db, pending);
  const reviews = pending.length
    ? await db.select().from(review).where(inArray(review.revisionId, pending.map((row) => row.revision.id)))
    : [];

  const toReview: { item: ItemRow; types: string[] }[] = [];
  const ready: ItemRow[] = [];
  const waiting: { item: ItemRow; reasons: string[] }[] = [];
  for (const { item, revision: rev } of pending) {
    const standing = reviewStanding(
      requiredReviews({ place: item.area as Place, flags: rev.flags, hasLayer: rev.layer !== null }),
      reviews.filter((row) => row.revisionId === rev.id),
      rev.authorEmail,
    );
    const mine = standing.filter(
      (entry) => !entry.approved && entry.latest?.decision !== "changes-requested" && mayReview(actor, entry.type),
    );
    if (mine.length && rev.authorEmail !== actor.email)
      toReview.push({ item, types: mine.map((entry) => REVIEW_TYPE_NAMES[entry.type]) });
    const result = decided.get(rev.id);
    if (result?.eligible) ready.push(item);
    else waiting.push({ item, reasons: result?.reasons ?? [] });
  }

  const today = fijiToday();
  const inThirtyDays = new Date(Date.parse(`${today}T00:00:00Z`) + 30 * 86_400_000).toISOString().slice(0, 10);
  const expiring = can(actor, "rights.manage")
    ? await db
        .select()
        .from(rightsRecord)
        .where(
          and(isNull(rightsRecord.withdrawnAt), gte(rightsRecord.expiresOn, today), lte(rightsRecord.expiresOn, inThirtyDays)),
        )
    : [];
  const forms = readableForms(actor);
  const messages = forms.length
    ? await db
        .select({ id: submission.id })
        .from(submission)
        .where(and(eq(submission.done, false), inArray(submission.form, forms)))
    : [];
  return {
    toReview,
    ready: can(actor, "content.publish") ? ready : [],
    waiting: can(actor, "content.edit") || can(actor, "video.edit") ? waiting : [],
    expiring,
    newMessages: messages.length,
  };
}
