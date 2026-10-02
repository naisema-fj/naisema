import { eq, sql } from "drizzle-orm";
import { contentItem } from "~db/schema";
import { auditInsert, recordAudit } from "./audit.server";
import { activeHold } from "./content-holds.server";
import type { Database } from "./db.server";
import { readyDownload, readyEpisodeAudio } from "./media-delivery.server";
import { type Actor, can } from "./permissions";
import { loadReview, type Review, type ReviewActionResult } from "./review.server";
import { requirementName } from "./review-names";
import { mediaRightsFacts, rightsFactsFor } from "./rights.server";
import { assetRightsProblems, rightsProblems } from "./rights-rules";

export type Eligibility = { eligible: true } | { eligible: false; reasons: string[] };

/**
 * The one eligibility decision (ADR-0007): may this exact Revision be published, right now? It
 * must have been submitted, every review its Content Flags require must be approved on it, and its
 * rights must be current at this moment: a current Rights Record granting Publish, plus current
 * guardian permission when it shows identifiable children. Because it is evaluated on every call,
 * an expiry or withdrawal takes effect immediately. Each media library file the Revision uses
 * needs a current Rights Record of its own too; the item's record covers its words and anything
 * from other sites. An item hidden pending a Case's review is never eligible.
 */
export async function isEligible(db: Database, revisionId: string, now = new Date()): Promise<Eligibility> {
  const review = await loadReview(db, revisionId);
  if (!review) return { eligible: false, reasons: ["That revision doesn't exist."] };
  return eligibilityFor(db, review, now);
}

/** isEligible for a Revision whose review was loaded in this same request. */
export async function eligibilityFor(db: Database, review: Review, now = new Date()): Promise<Eligibility> {
  const reasons: string[] = [];
  if (await activeHold(db, review.contentItem.id)) {
    reasons.push("It is hidden while a Case about it is reviewed. The safeguarding lead can show it again.");
  }
  if (!review.submitted) reasons.push("It hasn't been submitted for review.");
  for (const { requirement, status } of review.progress) {
    if (status === "approved") continue;
    const name = requirementName(requirement);
    reasons.push(status === "rejected" ? `${name} was rejected.` : `${name} is still needed.`);
  }
  if (review.resourceAssetId && !(await readyDownload(db, review.resourceAssetId))) {
    reasons.push("Its file isn't in the media library as a PDF or audio file that has passed its virus scan.");
  }
  if (review.episode && !(await readyEpisodeAudio(db, review.episode.audioAssetId))) {
    reasons.push("Its audio isn't in the media library as an MP3 or M4A file that has passed its virus scan.");
  }
  if (review.episode && !review.episode.hasTranscript) {
    reasons.push("It has no transcript yet. Every Episode is published with a reviewed transcript.");
  }
  reasons.push(
    ...rightsProblems({
      records: await rightsFactsFor(db, { type: "content_item", id: review.contentItem.id }),
      needsGuardianPermission: review.flags.includes("identifiableChildren"),
      // Only parts this Revision lists can be held up by their own records.
      parts: review.episode?.parts ?? [],
      now,
    }),
  );
  if (review.creatorSampleId && !(await isPublicNow(db, review.creatorSampleId, now))) {
    reasons.push("Its free sample isn't published right now.");
  }
  reasons.push(...assetRightsProblems(await mediaRightsFacts(db, review.mediaAssetIds), now));
  return reasons.length ? { eligible: false, reasons } : { eligible: true };
}

/**
 * Whether a Content Item is public right now: published, and its published Revision eligible. It
 * mirrors `eligiblePublished`, which lives in public.server and imports this module. A Creator
 * Profile's sample can't itself be a Creator Profile, so this never recurses further.
 */
async function isPublicNow(db: Database, contentItemId: string, now: Date) {
  const item = await db.select().from(contentItem).where(eq(contentItem.id, contentItemId)).get();
  if (item?.publicationState !== "published" || !item.currentPublishedRevisionId) return false;
  return (await isEligible(db, item.currentPublishedRevisionId, now)).eligible;
}

const setState = (db: Database, contentItemId: string, values: Partial<typeof contentItem.$inferInsert>) =>
  db
    .update(contentItem)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(contentItem.id, contentItemId));

/**
 * Publishes this exact Revision, if it is the latest one and isEligible says so at the moment of
 * publishing. An earlier Revision comes back by restoring it, which carries its approvals forward.
 * A refused attempt is audited too.
 */
export async function publishRevision(db: Database, actor: Actor, review: Review): Promise<ReviewActionResult> {
  if (!can(actor, { action: "revision.publish" })) return { ok: false, error: "Only editors can publish." };
  const { contentItem: item } = review;
  if (item.publicationState === "archived") return { ok: false, error: "Archived items can't be published." };
  if (item.currentDraftRevisionId !== review.revisionId) {
    return { ok: false, error: "Only the latest revision can be published. Restore this one to publish it again." };
  }
  const eligibility = await isEligible(db, review.revisionId);
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
    db
      .update(contentItem)
      .set({
        publicationState: "published",
        currentPublishedRevisionId: review.revisionId,
        // Republishing keeps the first publication date; the last one moves on.
        firstPublishedAt: sql`coalesce(${contentItem.firstPublishedAt}, ${Date.now()})`,
        lastPublishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contentItem.id, item.id)),
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
