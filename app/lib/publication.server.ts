import { eq } from "drizzle-orm";
import { contentItem } from "~db/schema";
import { auditInsert, recordAudit } from "./audit.server";
import type { Database } from "./db.server";
import { type Actor, can } from "./permissions";
import { loadReview, type Review, type ReviewActionResult } from "./review.server";
import { REVIEW_NAMES } from "./review-names";

export type Eligibility = { eligible: true } | { eligible: false; reasons: string[] };

/**
 * The one eligibility decision (ADR-0007): may this exact Revision be published? It must have been
 * submitted, every review its Content Flags require must be approved on it, and its rights must be
 * current. Publication calls this now; public pages will call it on every request.
 */
export async function isEligible(db: Database, revisionId: string): Promise<Eligibility> {
  const review = await loadReview(db, revisionId);
  if (!review) return { eligible: false, reasons: ["That revision doesn't exist."] };
  return eligibilityOf(review);
}

export function eligibilityOf(review: Review): Eligibility {
  const reasons: string[] = [];
  if (!review.submitted) reasons.push("It hasn't been submitted for review.");
  for (const { requirement, status } of review.progress) {
    if (status === "approved") continue;
    const name = requirement.knowledgeHolder
      ? "Knowledge Holder Approval"
      : `${REVIEW_NAMES[requirement.reviewType]}${requirement.languageVariety ? ` (${requirement.languageVariety})` : ""}`;
    reasons.push(status === "rejected" ? `${name} was rejected.` : `${name} is still needed.`);
  }
  if (!rightsAreCurrent(review)) reasons.push("Its rights are not current.");
  return reasons.length ? { eligible: false, reasons } : { eligible: true };
}

/** Rights Records and Permitted Uses arrive with 1a-06 (#17); until then nothing is refused on rights. */
function rightsAreCurrent(_review: Review): boolean {
  return true;
}

const setState = (db: Database, contentItemId: string, values: Partial<typeof contentItem.$inferInsert>) =>
  db
    .update(contentItem)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(contentItem.id, contentItemId));

/** Publishes this exact Revision, if it is eligible. A refused attempt is audited too. */
export async function publishRevision(db: Database, actor: Actor, review: Review): Promise<ReviewActionResult> {
  if (!can(actor, { action: "revision.publish" })) return { ok: false, error: "Only editors can publish." };
  const { contentItem: item } = review;
  if (item.publicationState === "archived") return { ok: false, error: "Archived items can't be published." };
  const eligibility = eligibilityOf(review);
  if (!eligibility.eligible) {
    await recordAudit(db, {
      actorId: actor.userId,
      action: "publish.refused",
      objectType: "revision",
      objectId: review.revisionId,
      details: { reasons: eligibility.reasons },
    });
    return { ok: false, error: `Revision ${review.number} can't be published yet. ${eligibility.reasons.join(" ")}` };
  }
  await db.batch([
    setState(db, item.id, { publicationState: "published", currentPublishedRevisionId: review.revisionId }),
    auditInsert(db, {
      actorId: actor.userId,
      action: "content_item.published",
      objectType: "content_item",
      objectId: item.id,
      details: { revisionId: review.revisionId, number: review.number },
    }),
  ]);
  return { ok: true };
}

/** Takes a published item down. Its published Revision is kept on record; nothing is served. */
export async function withdraw(db: Database, actor: Actor, review: Review): Promise<ReviewActionResult> {
  if (!can(actor, { action: "content.withdraw" })) return { ok: false, error: "Only editors can withdraw." };
  if (review.contentItem.publicationState !== "published")
    return { ok: false, error: "Only published items can be withdrawn." };
  await db.batch([
    setState(db, review.contentItem.id, { publicationState: "withdrawn" }),
    auditInsert(db, {
      actorId: actor.userId,
      action: "content_item.withdrawn",
      objectType: "content_item",
      objectId: review.contentItem.id,
    }),
  ]);
  return { ok: true };
}

/** Retires an item that isn't published. Archived items can't be published again. */
export async function archive(db: Database, actor: Actor, review: Review): Promise<ReviewActionResult> {
  if (!can(actor, { action: "content.withdraw" })) return { ok: false, error: "Only editors can archive." };
  const state = review.contentItem.publicationState;
  if (state === "published") return { ok: false, error: "Withdraw the item before archiving it." };
  if (state === "archived") return { ok: false, error: "This item is already archived." };
  await db.batch([
    setState(db, review.contentItem.id, { publicationState: "archived" }),
    auditInsert(db, {
      actorId: actor.userId,
      action: "content_item.archived",
      objectType: "content_item",
      objectId: review.contentItem.id,
    }),
  ]);
  return { ok: true };
}
