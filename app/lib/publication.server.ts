import { desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { contentItem, learningLayer } from "~db/schema";
import { auditInsert, recordAudit } from "./audit.server";
import type { Database } from "./db.server";
import { type LayerReview, loadLayerReview } from "./layer-review.server";
import { type Actor, can } from "./permissions";
import { type Review, type ReviewActionResult, refuse } from "./review.server";
import { type PublicationState, requirementName } from "./review-names";
import { videoItem } from "./video-items.server";
import { isEligible, layerRevisionEligibility, reasonTexts } from "./visibility.server";

/**
 * Publishing, withdrawing and archiving Content Items and Learning Layers, and the editors' queue of
 * what is ready to publish. Whether a Revision may be published is the eligibility decision
 * (app/lib/visibility.server.ts, ADR-0007), asked again at the moment of publishing.
 */

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
      details: { reasons: reasonTexts(eligibility) },
    });
    return {
      ok: false,
      error: `Revision ${review.number} can't be published yet. ${reasonTexts(eligibility).join(" ")}`,
    };
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

type LayerColumns = typeof learningLayer.$inferInsert;

const setLayerState = (
  db: Database,
  learningLayerId: string,
  values: { [Column in keyof LayerColumns]?: LayerColumns[Column] | SQL },
) =>
  db
    .update(learningLayer)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(learningLayer.id, learningLayerId));

/**
 * Publishes this exact Revision, if it is the latest and eligible at this moment. A refused attempt
 * is audited with its reasons (VAC-06).
 */
export async function publishLayerRevision(
  db: Database,
  actor: Actor,
  review: LayerReview,
): Promise<ReviewActionResult> {
  if (!can(actor, { action: "revision.publish" })) return refuse("Only editors can publish.");
  if (review.layer.publicationState === "archived") return refuse("Archived Learning Layers can't be published.");
  if (review.layer.currentDraftRevisionId !== review.revisionId) {
    return refuse("Only the latest revision can be published.");
  }
  // Asked again now, as for a Content Item: the review was loaded earlier in the request.
  const eligibility = await layerRevisionEligibility(db, review);
  if (!eligibility.eligible) {
    await recordAudit(db, {
      actorId: actor.userId,
      action: "learning_layer.publish_refused",
      objectType: "learning_layer_revision",
      objectId: review.revisionId,
      details: { reasons: reasonTexts(eligibility) },
    });
    return refuse(`Revision ${review.number} can't be published yet. ${reasonTexts(eligibility).join(" ")}`);
  }
  await db.batch([
    setLayerState(db, review.layer.id, {
      publicationState: "published",
      currentPublishedRevisionId: review.revisionId,
      // Republishing keeps the first publication date; the last one moves on.
      firstPublishedAt: sql`coalesce(${learningLayer.firstPublishedAt}, ${Date.now()})`,
      lastPublishedAt: new Date(),
    }),
    auditInsert(db, {
      actorId: actor.userId,
      action: "learning_layer.published",
      objectType: "learning_layer",
      objectId: review.layer.id,
      details: { revisionId: review.revisionId, number: review.number },
    }),
  ]);
  return { ok: true };
}

/** Takes a published Learning Layer down, leaving its Video as it is. */
export async function withdrawLayer(db: Database, actor: Actor, review: LayerReview): Promise<ReviewActionResult> {
  if (!can(actor, { action: "content.withdraw" })) return refuse("Only editors can withdraw.");
  if (review.layer.publicationState !== "published") return refuse("Only published Learning Layers can be withdrawn.");
  await db.batch([
    setLayerState(db, review.layer.id, { publicationState: "withdrawn" }),
    auditInsert(db, {
      actorId: actor.userId,
      action: "learning_layer.withdrawn",
      objectType: "learning_layer",
      objectId: review.layer.id,
    }),
  ]);
  return { ok: true };
}

/** Retires a Learning Layer that isn't published. It can't be published again. */
export async function archiveLayer(db: Database, actor: Actor, review: LayerReview): Promise<ReviewActionResult> {
  if (!can(actor, { action: "content.withdraw" })) return refuse("Only editors can archive.");
  const state = review.layer.publicationState;
  if (state === "published") return refuse("Withdraw the Learning Layer before archiving it.");
  if (state === "archived") return refuse("This Learning Layer is already archived.");
  await db.batch([
    setLayerState(db, review.layer.id, { publicationState: "archived" }),
    auditInsert(db, {
      actorId: actor.userId,
      action: "learning_layer.archived",
      objectType: "learning_layer",
      objectId: review.layer.id,
    }),
  ]);
  return { ok: true };
}

/**
 * The editors' queues for Learning Layers (VCMS-06): current drafts submitted but still missing a
 * review (or rejected), with anything else they still need; drafts approved but held up, with why;
 * drafts ready to publish; and Learning Layers whose video failed processing. Each shows its Video.
 * Evaluated live, like eligibility, so nothing goes stale; 1a has few enough Learning Layers to
 * work it out per request.
 */
export async function layerQueues(db: Database, now = new Date()) {
  const layers = await db
    .select({ id: learningLayer.id, revisionId: learningLayer.currentDraftRevisionId })
    .from(learningLayer)
    .where(inArray(learningLayer.publicationState, ["unpublished", "published", "withdrawn"]))
    .orderBy(desc(learningLayer.updatedAt));
  const missingReview: QueueEntry[] = [];
  const heldUp: QueueEntry[] = [];
  const readyToPublish: QueueEntry[] = [];
  const failedProcessing: QueueEntry[] = [];
  for (const { revisionId } of layers) {
    const review = revisionId ? await loadLayerReview(db, revisionId) : null;
    if (!review) continue;
    const video = await videoItem(db, review.layer.contentItemId);
    const waitingFor = review.progress
      .filter((item) => item.status !== "approved")
      .map((item) => `${requirementName(item.requirement)}${item.status === "rejected" ? " (rejected)" : ""}`);
    const eligibility = await layerRevisionEligibility(db, review, now, video);
    const entry: QueueEntry = {
      learningLayerId: review.layer.id,
      number: review.number,
      title: review.snapshot.title,
      videoTitle: video?.title ?? null,
      publicationState: review.layer.publicationState,
      waitingFor,
      // What it needs besides its reviews: readiness, processing and rights.
      blockers: eligibility.eligible
        ? []
        : eligibility.reasons
            .filter((reason) => reason.kind !== "unsubmitted" && reason.kind !== "review")
            .map((reason) => reason.text),
    };
    if (video?.video.state === "failed") failedProcessing.push({ ...entry, reason: video.video.stateReason });
    if (!review.submitted) continue;
    if (waitingFor.length) missingReview.push(entry);
    else if (!eligibility.eligible) heldUp.push(entry);
    // Ready unless this very revision is already out; a withdrawn one can be published again.
    const live =
      review.layer.publicationState === "published" && review.layer.currentPublishedRevisionId === review.revisionId;
    if (eligibility.eligible && !live) readyToPublish.push(entry);
  }
  return { missingReview, heldUp, readyToPublish, failedProcessing };
}

export type QueueEntry = {
  learningLayerId: string;
  number: number;
  title: string;
  videoTitle: string | null;
  publicationState: PublicationState;
  waitingFor: string[];
  blockers: string[];
  reason?: string | null;
};
