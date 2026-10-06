import { and, eq, inArray, sql } from "drizzle-orm";
import {
  contentItem,
  learningLayer,
  learningLayerApproval,
  learningLayerEducator,
  learningLayerRevision,
  learningLayerSubmission,
  reviewLink,
  reviewLinkAccess,
  revision,
} from "~db/schema";
import { recordAudit } from "./audit.server";
import type { Database } from "./db.server";
import { discardEvidence, scannedEvidence, storeEvidence } from "./evidence.server";
import type { EvidenceFile } from "./evidence-file";
import { layerFlags } from "./layer-review-rules";
import { type LearningLayerSnapshot, withDefaults } from "./learning-layer-fields";
import { type Actor, can } from "./permissions";
import {
  type KnowledgeHolderDetails,
  knowledgeHolderInserts,
  knowledgeHolderRefusal,
  LEARNING_LAYER_REVIEW,
  type ReviewActionResult,
  refuse,
  reviewAbilities,
  reviewCore,
  reviewQueue,
  submitDraft,
} from "./review.server";
import type { PublicationState } from "./review-names";

/**
 * What is Learning Layers' own in review (ADR-0001, ADR-0003, ADR-0006): loading a Learning Layer
 * Revision's review, who may submit it (its editors and assigned Educators), and a Knowledge
 * Holder Approval's Review Link and private evidence. Everything else (assigning, deciding,
 * carrying approvals forward, the reviewers' queue) is the one review module,
 * app/lib/review.server.ts, through its Learning Layer adapter. Publishing is
 * app/lib/publication.server.ts, and whether a Revision may be published or is public is
 * app/lib/visibility.server.ts.
 */

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
  const [core, educators] = await Promise.all([
    reviewCore(
      LEARNING_LAYER_REVIEW,
      db,
      {
        revisionId: row.revision.id,
        number: row.revision.number,
        parentId: row.layer.id,
        currentDraftRevisionId: row.layer.currentDraftRevisionId,
        submitted: row.submission !== null,
      },
      { flags, languageVariety },
      // The Language Variety is the Learning Layer's own, the same at every Revision.
      (earlier) => ({ flags: layerFlags(withDefaults(earlier as LearningLayerSnapshot)), languageVariety }),
    ),
    db
      .select({ userId: learningLayerEducator.userId })
      .from(learningLayerEducator)
      .where(eq(learningLayerEducator.learningLayerId, row.layer.id)),
  ]);
  // A Learning Layer's approvals also name the Review Link a Knowledge Holder saw it through.
  const linkIds = core.approvals
    .map((approval) => (approval as unknown as LayerApprovalRow).reviewLinkId)
    .filter((id) => id !== null);
  const links = linkIds.length
    ? await db
        .select({ id: reviewLink.id, recipient: reviewLink.recipient })
        .from(reviewLink)
        .where(inArray(reviewLink.id, linkIds))
    : [];
  return {
    ...core,
    snapshot,
    title: snapshot.title,
    layer: {
      id: row.layer.id,
      contentItemId: row.layer.contentItemId,
      languageVariety,
      publicationState: row.layer.publicationState as PublicationState,
      currentDraftRevisionId: row.layer.currentDraftRevisionId,
      currentPublishedRevisionId: row.layer.currentPublishedRevisionId,
    },
    flags,
    /** The Educators assigned to the Learning Layer, who may open, author and submit it. */
    educatorIds: educators.map((educator) => educator.userId),
    approvals: core.approvals.map((approval) => {
      const layerApproval = approval as unknown as typeof approval & LayerApprovalRow;
      return {
        ...layerApproval,
        reviewLinkRecipient: links.find((link) => link.id === layerApproval.reviewLinkId)?.recipient ?? null,
      };
    }),
  };
}

/** The columns a Learning Layer's approval has beyond a Content Item's. */
type LayerApprovalRow = Pick<
  typeof learningLayerApproval.$inferSelect,
  "reviewLinkId" | "evidenceAssetId" | "evidenceKey" | "evidenceName" | "evidenceType"
>;

export type LayerReview = NonNullable<Awaited<ReturnType<typeof loadLayerReview>>>;

/** Who may send a Learning Layer's draft for review: an editor, or an Educator assigned to it. */
const maySubmitLayer = (actor: Actor, review: Pick<LayerReview, "educatorIds">) =>
  can(actor, { action: "content.edit" }) ||
  can(actor, { action: "learningLayer.submit", learningLayer: { assignedEducatorIds: review.educatorIds } });

/** An editor, or an Educator assigned to the Learning Layer, sends its current draft for review. */
export async function submitLayerRevision(
  db: Database,
  actor: Actor,
  review: LayerReview,
): Promise<ReviewActionResult> {
  if (!maySubmitLayer(actor, review)) {
    return refuse("Only editors and the Educators assigned to this Learning Layer can submit it for review.");
  }
  return submitDraft(db, actor, review);
}

/**
 * What this person may do on a Learning Layer Revision's review: what every review offers, and
 * whether they may share it through Review Links and read Knowledge Holder approval evidence.
 */
export const layerReviewAbilities = (actor: Actor, review: LayerReview) => ({
  ...reviewAbilities(actor, review, maySubmitLayer(actor, review)),
  canShareLinks: can(actor, { action: "reviewLink.issue" }),
  canReadEvidence: can(actor, { action: "approvalEvidence.read" }),
});

/** Submitted Learning Layer Revisions waiting on this reviewer, for their review queue. */
export const layerReviewQueue = (db: Database, reviewerId: string) =>
  reviewQueue(LEARNING_LAYER_REVIEW, db, reviewerId, loadLayerReview);

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

export type KnowledgeHolderApproval = KnowledgeHolderDetails & {
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
  const refused = await knowledgeHolderRefusal(db, actor, review, approval);
  if (refused) return refused;
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
  try {
    await db.batch([
      ...knowledgeHolderInserts(db, actor, review, approval, {
        values: {
          reviewLinkId: link.id,
          evidenceAssetId: evidence?.id ?? null,
          evidenceKey: evidence?.destinationKey ?? null,
          evidenceName: approval.evidence?.name ?? null,
          evidenceType: approval.evidence?.type ?? null,
        },
        details: { reviewLinkId: link.id, evidence: evidence !== null },
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
