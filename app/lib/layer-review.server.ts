import { and, desc, eq, gt, inArray, lt, lte, notExists, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import {
  auditEvent,
  contentItem,
  learningLayer,
  learningLayerApproval,
  learningLayerReviewAssignment,
  learningLayerRevision,
  learningLayerSubmission,
  reviewLink,
  reviewLinkAccess,
  revision,
  user,
} from "~db/schema";
import { auditInsert, recordAudit } from "./audit.server";
import { activeHold } from "./content-holds.server";
import type { Database } from "./db.server";
import { discardEvidence, scannedEvidence, storeEvidence } from "./evidence.server";
import type { EvidenceFile } from "./evidence-file";
import { layerFlags, layerReadinessProblems } from "./layer-review-rules";
import { type LearningLayerSnapshot, withDefaults } from "./learning-layer-fields";
import { type Actor, can, type ReviewType } from "./permissions";
import type { Eligibility } from "./publication.server";
import {
  decidableRequirement,
  onceOnly,
  type ReviewActionResult,
  refuse,
  reviewersFor,
  toRecordedDecision,
} from "./review.server";
import { type PublicationState, REVIEW_NAMES, requirementName } from "./review-names";
import {
  approvalsToCarryForward,
  type Fingerprints,
  requiredReviewsSince,
  reviewProgress,
  revisionState,
} from "./review-rules";
import { mediaRightsFacts, rightsFactsFor } from "./rights.server";
import { assetRightsProblems, teachingRightsProblems } from "./rights-rules";
import { videoItem } from "./video-items.server";

/**
 * Review and publishing for Learning Layers (ADR-0001, ADR-0003, ADR-0006, ADR-0007). A Learning
 * Layer's Revisions are reviewed like a Content Item's, by the same rules, in their own rows: an
 * editor or an assigned Educator submits the current draft, assigned reviewers approve or reject
 * it for their Review Type, an editor records a Knowledge Holder's approval, and approvals whose
 * fingerprint is unchanged carry forward to the next Revision. A Learning Layer is published and
 * withdrawn on its own, apart from its Video, and only when `layerEligibility` says so.
 */

/** Whoever added the Learning Layer and whoever saved it up to this Revision: their words are in it. */
async function layerAuthorIds(db: Database, learningLayerId: string, upToNumber: number) {
  const [layer, savers] = await Promise.all([
    db
      .select({ createdBy: learningLayer.createdBy })
      .from(learningLayer)
      .where(eq(learningLayer.id, learningLayerId))
      .get(),
    db
      .selectDistinct({ createdBy: learningLayerRevision.createdBy })
      .from(learningLayerRevision)
      .where(
        and(eq(learningLayerRevision.learningLayerId, learningLayerId), lte(learningLayerRevision.number, upToNumber)),
      ),
  ]);
  return [...new Set([...(layer ? [layer.createdBy] : []), ...savers.map((row) => row.createdBy)])];
}

/**
 * The inserts that carry approvals forward to a new Learning Layer Revision (ADR-0003), for the
 * same batch as the Revision: each approval on the base whose Review Type's fingerprint is
 * unchanged, unless its reviewer edited the new Revision, as an explicit Carried-forward Approval
 * pointing at the one it carries, audited. As for Content Items, the insert re-checks that no
 * newer decision for that Review Type landed since the approvals were read.
 */
export async function carryForwardLayerInserts(
  db: Database,
  carry: {
    learningLayerId: string;
    sourceRevisionId: string;
    newRevisionId: string;
    newNumber: number;
    newFingerprints: Fingerprints;
    savedBy: string;
  },
) {
  const [source, approvals, earlierAuthors] = await Promise.all([
    db
      .select({ fingerprints: learningLayerRevision.fingerprints })
      .from(learningLayerRevision)
      .where(eq(learningLayerRevision.id, carry.sourceRevisionId))
      .get(),
    db.select().from(learningLayerApproval).where(eq(learningLayerApproval.revisionId, carry.sourceRevisionId)),
    layerAuthorIds(db, carry.learningLayerId, carry.newNumber - 1),
  ]);
  const carried = approvalsToCarryForward({
    approvals: approvals.map(toRecordedDecision),
    baseFingerprints: (source?.fingerprints ?? {}) as Fingerprints,
    newFingerprints: carry.newFingerprints,
    newAuthorIds: [...earlierAuthors, carry.savedBy],
  });
  return carried.flatMap(({ id: originalId }) => {
    const id = crypto.randomUUID();
    const original = alias(learningLayerApproval, "original");
    const newer = alias(learningLayerApproval, "newer");
    return [
      db.insert(learningLayerApproval).select(
        db
          .select({
            id: sql<string>`${id}`.as("id"),
            revisionId: sql<string>`${carry.newRevisionId}`.as("revision_id"),
            reviewType: original.reviewType,
            languageVariety: original.languageVariety,
            decision: original.decision,
            reviewerId: original.reviewerId,
            scope: original.scope,
            notes: original.notes,
            knowledgeHolderName: original.knowledgeHolderName,
            knowledgeHolderMethod: original.knowledgeHolderMethod,
            conditions: original.conditions,
            reviewLinkId: original.reviewLinkId,
            evidenceAssetId: original.evidenceAssetId,
            evidenceKey: original.evidenceKey,
            evidenceName: original.evidenceName,
            evidenceType: original.evidenceType,
            carriedForwardFromId: original.id,
            decidedAt: original.decidedAt,
          })
          .from(original)
          .where(
            and(
              eq(original.id, originalId),
              notExists(
                db
                  .select({ id: newer.id })
                  .from(newer)
                  .where(
                    and(
                      eq(newer.revisionId, original.revisionId),
                      eq(newer.reviewType, original.reviewType),
                      gt(newer.decidedAt, original.decidedAt),
                    ),
                  ),
              ),
            ),
          ),
      ),
      db.insert(auditEvent).select(
        db
          .select({
            id: sql<string>`${crypto.randomUUID()}`.as("id"),
            actorId: sql<string>`${carry.savedBy}`.as("actor_id"),
            action: sql<string>`'learning_layer_approval.carried_forward'`.as("action"),
            objectType: sql<string>`'learning_layer_approval'`.as("object_type"),
            objectId: learningLayerApproval.id,
            details: sql<string>`${JSON.stringify({ revisionId: carry.newRevisionId, from: originalId })}`.as(
              "details",
            ),
            createdAt: sql<number>`${Date.now()}`.as("created_at"),
          })
          .from(learningLayerApproval)
          .where(eq(learningLayerApproval.id, id)),
      ),
    ];
  });
}

/** The reviewers assigned to a Learning Layer, by Review Type. */
function assignmentsOf(db: Database, learningLayerId: string) {
  return db
    .select({
      id: learningLayerReviewAssignment.id,
      reviewType: learningLayerReviewAssignment.reviewType,
      reviewerId: learningLayerReviewAssignment.reviewerId,
      email: user.email,
    })
    .from(learningLayerReviewAssignment)
    .leftJoin(user, eq(user.id, learningLayerReviewAssignment.reviewerId))
    .where(eq(learningLayerReviewAssignment.learningLayerId, learningLayerId))
    .orderBy(learningLayerReviewAssignment.reviewType, user.email);
}

/** The flags of the latest submitted Revision before this one, which a removed flag's review follows. */
async function lastSubmittedBefore(db: Database, learningLayerId: string, number: number, languageVariety: string) {
  const row = await db
    .select({ number: learningLayerRevision.number, snapshot: learningLayerRevision.snapshot })
    .from(learningLayerRevision)
    .innerJoin(learningLayerSubmission, eq(learningLayerSubmission.revisionId, learningLayerRevision.id))
    .where(and(eq(learningLayerRevision.learningLayerId, learningLayerId), lt(learningLayerRevision.number, number)))
    .orderBy(desc(learningLayerRevision.number))
    .get();
  if (!row) return null;
  return {
    number: row.number,
    flags: layerFlags(withDefaults(row.snapshot as LearningLayerSnapshot)),
    languageVariety,
  };
}

/** Everything about one Learning Layer Revision's review: what it needs, what is decided, its state. */
export async function loadLayerReview(db: Database, revisionId: string) {
  const row = await db
    .select({ revision: learningLayerRevision, layer: learningLayer, submission: learningLayerSubmission })
    .from(learningLayerRevision)
    .innerJoin(learningLayer, eq(learningLayer.id, learningLayerRevision.learningLayerId))
    .leftJoin(learningLayerSubmission, eq(learningLayerSubmission.revisionId, learningLayerRevision.id))
    .where(eq(learningLayerRevision.id, revisionId))
    .get();
  if (!row) return null;
  const snapshot = withDefaults(row.revision.snapshot as LearningLayerSnapshot);
  const flags = layerFlags(snapshot);
  const { languageVariety } = row.layer;
  const original = alias(learningLayerApproval, "original");
  const [approvals, assignments, authorIds, lastSubmitted] = await Promise.all([
    db
      .select({
        approval: learningLayerApproval,
        reviewerEmail: user.email,
        linkRecipient: reviewLink.recipient,
        carriedFromNumber: learningLayerRevision.number,
      })
      .from(learningLayerApproval)
      .leftJoin(user, eq(user.id, learningLayerApproval.reviewerId))
      .leftJoin(reviewLink, eq(reviewLink.id, learningLayerApproval.reviewLinkId))
      .leftJoin(original, eq(original.id, learningLayerApproval.carriedForwardFromId))
      .leftJoin(learningLayerRevision, eq(learningLayerRevision.id, original.revisionId))
      .where(eq(learningLayerApproval.revisionId, revisionId))
      .orderBy(desc(learningLayerApproval.decidedAt)),
    assignmentsOf(db, row.layer.id),
    layerAuthorIds(db, row.layer.id, row.revision.number),
    lastSubmittedBefore(db, row.layer.id, row.revision.number, languageVariety),
  ]);
  const requirements = requiredReviewsSince({ flags, languageVariety }, lastSubmitted);
  const progress = reviewProgress(
    requirements,
    approvals.map(({ approval }) => toRecordedDecision(approval)),
  );
  const submitted = row.submission !== null;
  return {
    revisionId: row.revision.id,
    number: row.revision.number,
    snapshot,
    layer: {
      id: row.layer.id,
      contentItemId: row.layer.contentItemId,
      languageVariety,
      publicationState: row.layer.publicationState as PublicationState,
      currentDraftRevisionId: row.layer.currentDraftRevisionId,
      currentPublishedRevisionId: row.layer.currentPublishedRevisionId,
    },
    flags,
    requirements,
    progress,
    submitted,
    state: revisionState({
      submitted,
      allApproved: progress.every((entry) => entry.status === "approved"),
      superseded: row.layer.currentDraftRevisionId !== row.revision.id,
    }),
    approvals: approvals.map(({ approval, reviewerEmail, linkRecipient, carriedFromNumber }) => ({
      ...approval,
      reviewerEmail: reviewerEmail ?? "a former staff member",
      reviewLinkRecipient: linkRecipient,
      carriedFromNumber: approval.carriedForwardFromId ? carriedFromNumber : null,
    })),
    assignments,
    authorIds,
  };
}

export type LayerReview = NonNullable<Awaited<ReturnType<typeof loadLayerReview>>>;

/** Only the latest Revision, the current draft, can be submitted or reviewed; older ones are superseded. */
const isLatest = (review: LayerReview) => review.layer.currentDraftRevisionId === review.revisionId;

/** An editor, or an Educator assigned to the Learning Layer, sends its current draft for review. */
export async function submitLayerRevision(
  db: Database,
  actor: Actor,
  review: LayerReview,
  assignedEducatorIds: string[],
): Promise<ReviewActionResult> {
  if (
    !can(actor, { action: "content.edit" }) &&
    !can(actor, { action: "learningLayer.submit", learningLayer: { assignedEducatorIds } })
  ) {
    return refuse("Only editors and the Educators assigned to this Learning Layer can submit it for review.");
  }
  if (!isLatest(review)) return refuse("Only the latest revision can be submitted.");
  if (review.submitted) return refuse("This revision has already been submitted.");
  return onceOnly(
    () =>
      db.batch([
        db
          .insert(learningLayerSubmission)
          .values({ revisionId: review.revisionId, submittedBy: actor.userId, submittedAt: new Date() }),
        auditInsert(db, {
          actorId: actor.userId,
          action: "learning_layer_revision.submitted",
          objectType: "learning_layer_revision",
          objectId: review.revisionId,
        }),
      ]),
    "This revision has already been submitted.",
  );
}

/** An editor asks a reviewer scoped to the Review Type to review the Learning Layer. */
export async function assignLayerReviewer(
  db: Database,
  actor: Actor,
  review: LayerReview,
  reviewType: ReviewType,
  reviewerId: string,
): Promise<ReviewActionResult> {
  if (!can(actor, { action: "content.edit" })) return refuse("Only editors can assign reviewers.");
  if (!(await reviewersFor(db, reviewType)).some((reviewer) => reviewer.id === reviewerId)) {
    return refuse(`Choose someone who does ${REVIEW_NAMES[reviewType].toLowerCase()}.`);
  }
  if (review.assignments.some((row) => row.reviewType === reviewType && row.reviewerId === reviewerId)) {
    return refuse("That reviewer is already assigned.");
  }
  const id = crypto.randomUUID();
  return onceOnly(
    () =>
      db.batch([
        db.insert(learningLayerReviewAssignment).values({
          id,
          learningLayerId: review.layer.id,
          reviewType,
          reviewerId,
          assignedBy: actor.userId,
          assignedAt: new Date(),
        }),
        auditInsert(db, {
          actorId: actor.userId,
          action: "learning_layer_review.assigned",
          objectType: "learning_layer_review_assignment",
          objectId: id,
          details: { learningLayerId: review.layer.id, reviewType, reviewerId },
        }),
      ]),
    "That reviewer is already assigned.",
  );
}

const auditRefusal = (db: Database, actor: Actor, review: LayerReview, reason: string, reviewType?: ReviewType) =>
  recordAudit(db, {
    actorId: actor.userId,
    action: "learning_layer_approval.refused",
    objectType: "learning_layer_revision",
    objectId: review.revisionId,
    details: { reason, ...(reviewType ? { reviewType } : {}) },
  });

/** A reviewer approves or rejects the exact Revision for one Review Type. Refusals are audited. */
export async function recordLayerDecision(
  db: Database,
  actor: Actor,
  review: LayerReview,
  decision: { reviewType: ReviewType; decision: "approved" | "rejected"; scope: string; notes: string },
): Promise<ReviewActionResult> {
  const { reviewType } = decision;
  const requirement = decidableRequirement(actor, review, reviewType);
  if (!requirement) {
    await auditRefusal(db, actor, review, "not allowed or not required", reviewType);
    return refuse("You can't review this revision for that Review Type.");
  }
  if (!isLatest(review) || !review.submitted) return refuse("Only a submitted, latest revision can be reviewed.");
  if (decision.decision === "rejected" && !decision.notes) return refuse("Say what needs to change.");
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(learningLayerApproval).values({
      id,
      revisionId: review.revisionId,
      reviewType,
      languageVariety: requirement.languageVariety ?? null,
      decision: decision.decision,
      reviewerId: actor.userId,
      scope: decision.scope || null,
      notes: decision.notes || null,
      decidedAt: new Date(),
    }),
    auditInsert(db, {
      actorId: actor.userId,
      action: decision.decision === "approved" ? "learning_layer_review.approved" : "learning_layer_review.rejected",
      objectType: "learning_layer_approval",
      objectId: id,
      details: { revisionId: review.revisionId, reviewType, languageVariety: requirement.languageVariety },
    }),
  ]);
  return { ok: true };
}

/** Submitted Learning Layer Revisions waiting on this reviewer, for their review queue. */
export async function layerReviewQueue(db: Database, reviewerId: string) {
  const assigned = await db
    .select({
      learningLayerId: learningLayerReviewAssignment.learningLayerId,
      reviewType: learningLayerReviewAssignment.reviewType,
    })
    .from(learningLayerReviewAssignment)
    .where(eq(learningLayerReviewAssignment.reviewerId, reviewerId));
  if (!assigned.length) return [];
  const rows = await db
    .select({ layerId: learningLayer.id, revisionId: learningLayerRevision.id })
    .from(learningLayer)
    .innerJoin(learningLayerRevision, eq(learningLayerRevision.id, learningLayer.currentDraftRevisionId))
    .innerJoin(learningLayerSubmission, eq(learningLayerSubmission.revisionId, learningLayerRevision.id))
    .where(
      inArray(
        learningLayer.id,
        assigned.map((row) => row.learningLayerId),
      ),
    );
  const queue = [];
  for (const row of rows) {
    const review = await loadLayerReview(db, row.revisionId);
    if (!review) continue;
    const types = assigned.filter((entry) => entry.learningLayerId === row.layerId).map((entry) => entry.reviewType);
    const waiting = review.progress.filter(
      (entry) => types.includes(entry.requirement.reviewType) && entry.status === "awaiting",
    );
    if (waiting.length) {
      queue.push({
        learningLayerId: row.layerId,
        number: review.number,
        title: review.snapshot.title,
        reviewTypes: waiting.map((entry) => entry.requirement.reviewType),
      });
    }
  }
  return queue;
}

/**
 * The eligibility decision for a Learning Layer Revision (ADR-0007), evaluated on every call: it
 * must be submitted with every required review approved and be ready for learners; its Video's
 * footage must have finished processing and have its own current Publish grant; the Video's rights
 * must grant Publish and the teaching uses (and Excerpt when it is on one); and a Video flagged as
 * culturally sensitive needs the Learning Layer flagged too, so a Knowledge Holder sees it. A
 * Learning Layer on a Video hidden pending a Case is never eligible. It doesn't need its Video
 * published: the learner player (#29) serves it only on an eligible Video's page.
 */
export async function layerEligibility(
  db: Database,
  review: LayerReview,
  now = new Date(),
  /** Its Video, when the caller has already loaded it. */
  loaded?: Awaited<ReturnType<typeof videoItem>>,
): Promise<Eligibility> {
  const reasons: string[] = [];
  const video = loaded === undefined ? await videoItem(db, review.layer.contentItemId) : loaded;
  if (!video) return { eligible: false, reasons: ["Its Video no longer shows a Video Asset."] };
  if (await activeHold(db, video.id)) {
    reasons.push("Its Video is hidden while a Case about it is reviewed. The safeguarding lead can show it again.");
  }
  if (!review.submitted) reasons.push("It hasn't been submitted for review.");
  for (const { requirement, status } of review.progress) {
    if (status === "approved") continue;
    const name = requirementName(requirement);
    reasons.push(status === "rejected" ? `${name} was rejected.` : `${name} is still needed.`);
  }
  reasons.push(...layerReadinessProblems(review.snapshot));
  if (video.video.state === "failed") {
    reasons.push(`Its video failed processing: ${video.video.stateReason ?? "no reason was given."}`);
  } else if (video.video.state !== "ready") {
    reasons.push("Its video hasn't finished processing.");
  }
  if (video.flags.includes("sensitiveCultural") && !review.flags.includes("sensitiveCultural")) {
    reasons.push(
      "Its Video is marked culturally sensitive, so the Learning Layer needs a Knowledge Holder's approval too. Tick Culturally sensitive in its editor.",
    );
  }
  reasons.push(
    ...teachingRightsProblems({
      records: await rightsFactsFor(db, { type: "content_item", id: video.id }),
      excerpt: review.snapshot.excerpt !== null,
      needsGuardianPermission: video.flags.includes("identifiableChildren"),
      now,
    }),
    ...assetRightsProblems(await mediaRightsFacts(db, [video.video.id]), now),
  );
  return reasons.length ? { eligible: false, reasons } : { eligible: true };
}

/** The eligibility decision for a Learning Layer Revision found by its ID, as the learner player will ask it. */
export async function isLayerEligible(db: Database, revisionId: string, now = new Date()): Promise<Eligibility> {
  const review = await loadLayerReview(db, revisionId);
  if (!review) return { eligible: false, reasons: ["That revision doesn't exist."] };
  return layerEligibility(db, review, now);
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
  if (!isLatest(review)) return refuse("Only the latest revision can be published.");
  const eligibility = await layerEligibility(db, review);
  if (!eligibility.eligible) {
    await recordAudit(db, {
      actorId: actor.userId,
      action: "learning_layer.publish_refused",
      objectType: "learning_layer_revision",
      objectId: review.revisionId,
      details: { reasons: eligibility.reasons },
    });
    return refuse(`Revision ${review.number} can't be published yet. ${eligibility.reasons.join(" ")}`);
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
    const eligibility = await layerEligibility(db, review, now, video);
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
        : eligibility.reasons.filter(
            (reason) =>
              reason !== "It hasn't been submitted for review." &&
              !reason.endsWith(" is still needed.") &&
              !reason.endsWith(" was rejected."),
          ),
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

/**
 * The Learning Layers that depend on a Video Asset: those on every Video whose current draft shows
 * it, with their publication state, for the video's page (VCMS-06).
 */
export async function layersUsingVideoAsset(db: Database, videoAssetId: string) {
  const rows = await db
    .select({
      id: learningLayer.id,
      contentItemId: learningLayer.contentItemId,
      publicationState: learningLayer.publicationState,
      snapshot: learningLayerRevision.snapshot,
      videoSnapshot: revision.snapshot,
    })
    .from(learningLayer)
    .innerJoin(learningLayerRevision, eq(learningLayerRevision.id, learningLayer.currentDraftRevisionId))
    .innerJoin(contentItem, eq(contentItem.id, learningLayer.contentItemId))
    .innerJoin(revision, eq(revision.id, contentItem.currentDraftRevisionId))
    .where(sql`json_extract(${revision.snapshot}, '$.video.videoAssetId') = ${videoAssetId}`);
  return rows.map((row) => ({
    id: row.id,
    title: (row.snapshot as LearningLayerSnapshot).title,
    videoId: row.contentItemId,
    videoTitle: (row.videoSnapshot as { title: string }).title,
    publicationState: row.publicationState as PublicationState,
  }));
}

export type KnowledgeHolderApproval = {
  knowledgeHolderName: string;
  method: string;
  conditions: string;
  scope: string;
  notes: string;
  reviewLinkId: string;
  evidence: EvidenceFile | null;
};

/**
 * An editor who didn't write or edit the Revision records a Knowledge Holder's approval of it: who
 * gave it, how, the Review Link they saw this exact Revision through (which must have been opened),
 * any conditions, and optional private evidence, which is quarantined and scanned like every upload
 * and refused if the approval can't be written.
 */
export async function recordLayerKnowledgeHolderApproval(
  env: Env,
  db: Database,
  actor: Actor,
  review: LayerReview,
  approval: KnowledgeHolderApproval,
): Promise<ReviewActionResult> {
  if (!can(actor, { action: "knowledgeHolderApproval.record", revision: { authorIds: review.authorIds } })) {
    await auditRefusal(db, actor, review, "knowledge holder approval not allowed");
    return refuse("Only an editor who didn't write or edit this revision can record a Knowledge Holder Approval.");
  }
  if (!isLatest(review) || !review.submitted) return refuse("Only a submitted, latest revision can be reviewed.");
  if (!review.requirements.some((requirement) => requirement.knowledgeHolder)) {
    return refuse("This revision doesn't need a Knowledge Holder Approval.");
  }
  if (!approval.knowledgeHolderName || !approval.method) {
    return refuse("Enter the Knowledge Holder's name and how they gave their approval.");
  }
  const link = await db.select().from(reviewLink).where(eq(reviewLink.id, approval.reviewLinkId)).get();
  if (link?.revisionId !== review.revisionId) {
    return refuse(`Choose the Review Link they saw revision ${review.number} through.`);
  }
  const opened = await db
    .select({ id: reviewLinkAccess.id })
    .from(reviewLinkAccess)
    .where(and(eq(reviewLinkAccess.reviewLinkId, link.id), eq(reviewLinkAccess.outcome, "viewed")))
    .get();
  if (!opened) return refuse("That Review Link has never been opened, so it can't be how they saw this revision.");
  const evidence = approval.evidence ? await storeEvidence(env, db, actor.userId, approval.evidence) : null;
  const id = crypto.randomUUID();
  try {
    await db.batch([
      db.insert(learningLayerApproval).values({
        id,
        revisionId: review.revisionId,
        reviewType: "cultural",
        decision: "approved",
        reviewerId: actor.userId,
        knowledgeHolderName: approval.knowledgeHolderName.slice(0, 200),
        knowledgeHolderMethod: approval.method.slice(0, 200),
        conditions: approval.conditions.slice(0, 2000) || null,
        scope: approval.scope.slice(0, 500) || null,
        notes: approval.notes.slice(0, 2000) || null,
        reviewLinkId: link.id,
        evidenceAssetId: evidence?.id ?? null,
        evidenceKey: evidence?.destinationKey ?? null,
        evidenceName: approval.evidence?.name ?? null,
        evidenceType: approval.evidence?.type ?? null,
        decidedAt: new Date(),
      }),
      auditInsert(db, {
        actorId: actor.userId,
        action: "knowledge_holder_approval.recorded",
        objectType: "learning_layer_approval",
        objectId: id,
        details: { revisionId: review.revisionId, reviewLinkId: link.id, evidence: evidence !== null },
      }),
    ]);
  } catch (error) {
    if (evidence) await discardEvidence(env, db, actor.userId, evidence, "Its Knowledge Holder Approval wasn't saved.");
    throw error;
  }
  return { ok: true };
}

/** A Knowledge Holder Approval's private evidence, for an editor, once its scan has passed. Each read is audited. */
export async function readApprovalEvidence(env: Env, db: Database, actor: Actor, approvalId: string) {
  if (!can(actor, { action: "approvalEvidence.read" })) return null;
  const approval = await db.select().from(learningLayerApproval).where(eq(learningLayerApproval.id, approvalId)).get();
  if (!approval?.evidenceKey) return null;
  const evidence = await scannedEvidence(env, db, approval.evidenceAssetId, approval.evidenceKey);
  if (!evidence || "unavailable" in evidence) return evidence;
  await recordAudit(db, {
    actorId: actor.userId,
    action: "approval_evidence.read",
    objectType: "learning_layer_approval",
    objectId: approvalId,
  });
  return {
    object: evidence.object,
    name: approval.evidenceName ?? "evidence",
    type: approval.evidenceType ?? "application/octet-stream",
  };
}
