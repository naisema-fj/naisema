import { and, count, desc, eq, isNull, max } from "drizzle-orm";
import { learningLayerApproval, mediaAsset, reviewLink, reviewLinkAccess, user } from "~db/schema";
import { auditInsert, recordAudit } from "./audit.server";
import type { Database } from "./db.server";
import type { EvidenceFile } from "./evidence-file";
import type { LayerReview, ReviewActionResult } from "./layer-review.server";
import { reviewLinkExpiry, reviewLinkState } from "./layer-review-rules";
import { quarantineFile } from "./media.server";
import { type Actor, can } from "./permissions";
import { hashToken, randomToken } from "./signed-tokens.server";

/**
 * Review Links and Knowledge Holder Approvals for Learning Layers (ADR-0003, GOV-03). An editor
 * issues a Review Link to one exact Revision for someone without a staff account, such as a
 * Knowledge Holder: view-only, no sign-in, 14 days, revocable, and every opening logged. Only a
 * hash of its token is kept, so the address is shown once. The editor then records the Knowledge
 * Holder's approval, naming the link they saw it through, with any conditions and private evidence.
 */

/** The address a Review Link opens, on the public site. */
export const reviewLinkPath = (token: string) => `/review/${token}`;

/** An editor issues a Review Link to a submitted Revision; the token comes back once, to show. */
export async function issueReviewLink(
  db: Database,
  actor: Actor,
  review: LayerReview,
  recipient: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (!can(actor, { action: "reviewLink.issue" })) return { ok: false, error: "Only editors can issue Review Links." };
  if (!review.submitted) return { ok: false, error: "Submit this revision for review before sharing it." };
  const name = recipient.trim().slice(0, 200);
  if (!name) return { ok: false, error: "Say who the Review Link is for." };
  const id = crypto.randomUUID();
  const token = randomToken();
  const now = new Date();
  await db.batch([
    db.insert(reviewLink).values({
      id,
      revisionId: review.revisionId,
      tokenHash: await hashToken(token),
      recipient: name,
      createdBy: actor.userId,
      createdAt: now,
      expiresAt: reviewLinkExpiry(now),
    }),
    auditInsert(db, {
      actorId: actor.userId,
      action: "review_link.issued",
      objectType: "review_link",
      objectId: id,
      details: { revisionId: review.revisionId, recipient: name },
    }),
  ]);
  return { ok: true, token };
}

/** An editor revokes a Review Link to this Revision; it stops working at once. */
export async function revokeReviewLink(
  db: Database,
  actor: Actor,
  review: LayerReview,
  linkId: string,
): Promise<ReviewActionResult> {
  if (!can(actor, { action: "reviewLink.issue" })) return { ok: false, error: "Only editors can revoke Review Links." };
  const link = await db.select().from(reviewLink).where(eq(reviewLink.id, linkId)).get();
  if (link?.revisionId !== review.revisionId) return { ok: false, error: "That Review Link isn't for this revision." };
  if (link.revokedAt) return { ok: false, error: "That Review Link is already revoked." };
  await db.batch([
    db
      .update(reviewLink)
      .set({ revokedAt: new Date(), revokedBy: actor.userId })
      .where(and(eq(reviewLink.id, linkId), isNull(reviewLink.revokedAt))),
    auditInsert(db, {
      actorId: actor.userId,
      action: "review_link.revoked",
      objectType: "review_link",
      objectId: linkId,
    }),
  ]);
  return { ok: true };
}

/**
 * Opens a Review Link by its token, logging the opening whether or not it still works. Returns
 * the Revision it shows, or why not: an unknown token, an expired link or a revoked one.
 */
export async function openReviewLink(db: Database, token: string, now = new Date()) {
  if (!token || token.length > 100) return { ok: false as const, reason: "unknown" as const };
  const link = await db
    .select()
    .from(reviewLink)
    .where(eq(reviewLink.tokenHash, await hashToken(token)))
    .get();
  if (!link) return { ok: false as const, reason: "unknown" as const };
  const state = reviewLinkState(link, now);
  await db.insert(reviewLinkAccess).values({
    id: crypto.randomUUID(),
    reviewLinkId: link.id,
    outcome: state === "active" ? "viewed" : state,
    accessedAt: now,
  });
  if (state !== "active") return { ok: false as const, reason: state };
  return { ok: true as const, link };
}

/** Whether a Review Link is active right now, for playing its video while the page is open. */
export async function activeReviewLink(db: Database, token: string, now = new Date()) {
  if (!token || token.length > 100) return null;
  const link = await db
    .select()
    .from(reviewLink)
    .where(eq(reviewLink.tokenHash, await hashToken(token)))
    .get();
  return link && reviewLinkState(link, now) === "active" ? link : null;
}

/** The Review Links to a Revision, newest first, with their state and how often they were opened. */
export async function reviewLinksFor(db: Database, revisionId: string, now = new Date()) {
  const rows = await db
    .select({
      link: reviewLink,
      issuedBy: user.email,
      views: count(reviewLinkAccess.id),
      lastViewedAt: max(reviewLinkAccess.accessedAt),
    })
    .from(reviewLink)
    .leftJoin(user, eq(user.id, reviewLink.createdBy))
    .leftJoin(
      reviewLinkAccess,
      and(eq(reviewLinkAccess.reviewLinkId, reviewLink.id), eq(reviewLinkAccess.outcome, "viewed")),
    )
    .where(eq(reviewLink.revisionId, revisionId))
    .groupBy(reviewLink.id)
    .orderBy(desc(reviewLink.createdAt));
  return rows.map(({ link, issuedBy, views, lastViewedAt }) => ({
    id: link.id,
    recipient: link.recipient,
    issuedBy: issuedBy ?? "a former staff member",
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    state: reviewLinkState(link, now),
    views,
    lastViewedAt: lastViewedAt === null ? null : new Date(lastViewedAt),
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
 * any conditions, and optional private evidence, which is quarantined and scanned like every upload.
 */
export async function recordLayerKnowledgeHolderApproval(
  env: Env,
  db: Database,
  actor: Actor,
  review: LayerReview,
  approval: KnowledgeHolderApproval,
): Promise<ReviewActionResult> {
  if (!can(actor, { action: "knowledgeHolderApproval.record", revision: { authorIds: review.authorIds } })) {
    await recordAudit(db, {
      actorId: actor.userId,
      action: "learning_layer_approval.refused",
      objectType: "learning_layer_revision",
      objectId: review.revisionId,
      details: { reason: "knowledge holder approval not allowed" },
    });
    return {
      ok: false,
      error: "Only an editor who didn't write or edit this revision can record a Knowledge Holder Approval.",
    };
  }
  if (review.layer.currentDraftRevisionId !== review.revisionId || !review.submitted) {
    return { ok: false, error: "Only a submitted, latest revision can be reviewed." };
  }
  if (!review.requirements.some((requirement) => requirement.knowledgeHolder)) {
    return { ok: false, error: "This revision doesn't need a Knowledge Holder Approval." };
  }
  if (!approval.knowledgeHolderName || !approval.method) {
    return { ok: false, error: "Enter the Knowledge Holder's name and how they gave their approval." };
  }
  const link = await db.select().from(reviewLink).where(eq(reviewLink.id, approval.reviewLinkId)).get();
  if (link?.revisionId !== review.revisionId) {
    return { ok: false, error: `Choose the Review Link they saw revision ${review.number} through.` };
  }
  const opened = await db
    .select({ id: reviewLinkAccess.id })
    .from(reviewLinkAccess)
    .where(and(eq(reviewLinkAccess.reviewLinkId, link.id), eq(reviewLinkAccess.outcome, "viewed")))
    .get();
  if (!opened) {
    return { ok: false, error: "That Review Link has never been opened, so it can't be how they saw this revision." };
  }
  const evidence = approval.evidence
    ? await quarantineFile(env, db, actor.userId, approval.evidence, "evidence")
    : null;
  const id = crypto.randomUUID();
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
  return { ok: true };
}

/**
 * A Knowledge Holder Approval's private evidence, for an editor, once its scan has passed. The read
 * is audited.
 */
export async function readApprovalEvidence(env: Env, db: Database, actor: Actor, approvalId: string) {
  if (!can(actor, { action: "rightsEvidence.read" })) return null;
  const approval = await db.select().from(learningLayerApproval).where(eq(learningLayerApproval.id, approvalId)).get();
  if (!approval?.evidenceKey || !approval.evidenceAssetId) return null;
  const asset = await db.select().from(mediaAsset).where(eq(mediaAsset.id, approval.evidenceAssetId)).get();
  if (asset?.status !== "ready") {
    return {
      unavailable: asset?.statusReason ?? "This evidence is still being scanned for viruses. Try again shortly.",
    };
  }
  const object = await env.EVIDENCE.get(approval.evidenceKey);
  if (!object) return null;
  await recordAudit(db, {
    actorId: actor.userId,
    action: "approval_evidence.read",
    objectType: "learning_layer_approval",
    objectId: approvalId,
  });
  return {
    object,
    name: approval.evidenceName ?? "evidence",
    type: approval.evidenceType ?? "application/octet-stream",
  };
}
