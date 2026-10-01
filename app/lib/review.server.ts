import { and, desc, eq, gt, inArray, isNull, lt, lte, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import {
  auditEvent,
  contentItem,
  reviewApproval,
  reviewAssignment,
  revision,
  revisionSubmission,
  roleAssignment,
  user,
} from "~db/schema";
import type { ArticleSnapshot } from "./article-fields";
import { auditInsert, recordAudit } from "./audit.server";
import type { Database } from "./db.server";
import { type EpisodeDetails, episodeParts } from "./episode-fields";
import { mediaAssetIdsIn } from "./media-in-use";
import { type Actor, can, type ReviewType } from "./permissions";
import { type PublicationState, REVIEW_NAMES } from "./review-names";
import {
  approvalsToCarryForward,
  type ContentFlag,
  type Fingerprints,
  type RecordedDecision,
  type ReviewRequirement,
  requiredReviewsSince,
  reviewProgress,
  revisionState,
} from "./review-rules";

/** What every content type's snapshot carries for review: its Content Flags and Language Variety. */
export type Reviewable = {
  flags?: ContentFlag[];
  languageVariety?: string | null;
  /** A Resource's download, which must have passed its scan for the Revision to be public. */
  resource?: { source: { kind: "file"; assetId: string } | { kind: "link" } };
  /** An Episode's recording, whose transcript is reviewed for accessibility and needed to publish. */
  episode?: EpisodeDetails;
};

type ApprovalRow = typeof reviewApproval.$inferSelect;

function toRecordedDecision(row: ApprovalRow): RecordedDecision {
  return {
    id: row.id,
    reviewType: row.reviewType as ReviewType,
    languageVariety: row.languageVariety,
    decision: row.decision as RecordedDecision["decision"],
    knowledgeHolder: row.knowledgeHolderName !== null,
    reviewerId: row.reviewerId,
    decidedAt: row.decidedAt,
  };
}

/**
 * Everyone who authored or edited a Revision: whoever created the Content Item and whoever
 * saved it or any earlier Revision, since their words are still in it.
 */
export async function authorIdsOf(db: Database, contentItemId: string, upToNumber: number): Promise<string[]> {
  const [item, savers] = await Promise.all([
    db.select({ createdBy: contentItem.createdBy }).from(contentItem).where(eq(contentItem.id, contentItemId)).get(),
    db
      .selectDistinct({ createdBy: revision.createdBy })
      .from(revision)
      .where(and(eq(revision.contentItemId, contentItemId), lte(revision.number, upToNumber))),
  ]);
  return [...new Set([...(item ? [item.createdBy] : []), ...savers.map((row) => row.createdBy)])];
}

/**
 * The inserts that carry approvals forward to a new Revision (ADR-0003), for running in the same
 * batch as the new Revision. They come from the Revision the new one's content came from: the base
 * for an edit, the restored Revision for a restore. Each is an explicit Carried-forward Approval
 * pointing at the approval it carries, keeping its original decision date, and is audited. The
 * insert re-checks that no newer decision for that Review Type landed since the approvals were read,
 * so a rejection recorded at the same moment is never carried past.
 */
export async function carryForwardInserts(
  db: Database,
  carry: {
    contentItemId: string;
    /** The Revision whose content and approvals the new one takes up. */
    sourceRevisionId: string;
    newRevisionId: string;
    newNumber: number;
    newFingerprints: Fingerprints;
    savedBy: string;
  },
) {
  const [source, approvals, earlierAuthors] = await Promise.all([
    db
      .select({ fingerprints: revision.fingerprints })
      .from(revision)
      .where(eq(revision.id, carry.sourceRevisionId))
      .get(),
    db.select().from(reviewApproval).where(eq(reviewApproval.revisionId, carry.sourceRevisionId)),
    authorIdsOf(db, carry.contentItemId, carry.newNumber - 1),
  ]);
  const carried = approvalsToCarryForward({
    approvals: approvals.map(toRecordedDecision),
    baseFingerprints: (source?.fingerprints ?? {}) as Fingerprints,
    newFingerprints: carry.newFingerprints,
    newAuthorIds: [...earlierAuthors, carry.savedBy],
  });
  return carried.flatMap(({ id: originalId }) => {
    const id = crypto.randomUUID();
    const original = alias(reviewApproval, "original");
    const newer = alias(reviewApproval, "newer");
    return [
      db.insert(reviewApproval).select(
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
            action: sql<string>`'review_approval.carried_forward'`.as("action"),
            objectType: sql<string>`'review_approval'`.as("object_type"),
            objectId: reviewApproval.id,
            details: sql<string>`${JSON.stringify({ revisionId: carry.newRevisionId, from: originalId })}`.as(
              "details",
            ),
            createdAt: sql<number>`${Date.now()}`.as("created_at"),
          })
          .from(reviewApproval)
          .where(eq(reviewApproval.id, id)),
      ),
    ];
  });
}

/** The reviewers assigned to a Content Item, by Review Type. */
async function assignmentsOf(db: Database, contentItemId: string) {
  return db
    .select({
      id: reviewAssignment.id,
      reviewType: reviewAssignment.reviewType,
      reviewerId: reviewAssignment.reviewerId,
      email: user.email,
    })
    .from(reviewAssignment)
    .leftJoin(user, eq(user.id, reviewAssignment.reviewerId))
    .where(eq(reviewAssignment.contentItemId, contentItemId))
    .orderBy(reviewAssignment.reviewType, user.email);
}

/** Every user assigned to review any Review Type of a Content Item. */
export async function assignedReviewerIds(db: Database, contentItemId: string): Promise<string[]> {
  return [...new Set((await assignmentsOf(db, contentItemId)).map((row) => row.reviewerId))];
}

/** Everything about one Revision's review: what it needs, what has been decided, and its state. */
export async function loadReview(db: Database, revisionId: string) {
  const row = await db
    .select({ revision, item: contentItem, submission: revisionSubmission })
    .from(revision)
    .innerJoin(contentItem, eq(contentItem.id, revision.contentItemId))
    .leftJoin(revisionSubmission, eq(revisionSubmission.revisionId, revision.id))
    .where(eq(revision.id, revisionId))
    .get();
  if (!row) return null;

  const content = row.revision.snapshot as ArticleSnapshot;
  const snapshot: Reviewable = content;
  const flags = snapshot.flags ?? [];
  const languageVariety = snapshot.languageVariety ?? null;
  const [approvals, assignments, authorIds] = await Promise.all([
    db
      .select({ approval: reviewApproval, reviewerEmail: user.email })
      .from(reviewApproval)
      .leftJoin(user, eq(user.id, reviewApproval.reviewerId))
      .where(eq(reviewApproval.revisionId, revisionId))
      .orderBy(desc(reviewApproval.decidedAt)),
    assignmentsOf(db, row.item.id),
    authorIdsOf(db, row.item.id, row.revision.number),
  ]);
  const lastSubmitted = await lastSubmittedBefore(db, row.item.id, row.revision.number);
  const carriedFrom = await carriedFromNumbers(
    db,
    approvals.map(({ approval }) => approval.carriedForwardFromId).filter((id): id is string => id !== null),
  );

  const requirements = requiredReviewsSince({ flags, languageVariety, episode: !!snapshot.episode }, lastSubmitted);
  const progress = reviewProgress(
    requirements,
    approvals.map(({ approval }) => toRecordedDecision(approval)),
  );
  const submitted = row.submission !== null;
  const allApproved = progress.every((entry) => entry.status === "approved");
  return {
    revisionId: row.revision.id,
    number: row.revision.number,
    contentItem: {
      id: row.item.id,
      publicationState: row.item.publicationState as PublicationState,
      currentDraftRevisionId: row.item.currentDraftRevisionId,
      currentPublishedRevisionId: row.item.currentPublishedRevisionId,
    },
    flags,
    languageVariety,
    resourceAssetId: snapshot.resource?.source.kind === "file" ? snapshot.resource.source.assetId : null,
    /** The media library files the Revision shows or offers; each needs rights of its own. */
    mediaAssetIds: mediaAssetIdsIn(content),
    episode: snapshot.episode
      ? {
          audioAssetId: snapshot.episode.audioAssetId,
          hasTranscript: snapshot.episode.transcript.trim() !== "",
          parts: episodeParts(snapshot.episode),
        }
      : null,
    requirements,
    progress,
    submitted,
    state: revisionState({
      submitted,
      allApproved,
      superseded: row.item.currentDraftRevisionId !== row.revision.id,
    }),
    approvals: approvals.map(({ approval, reviewerEmail }) => ({
      ...approval,
      reviewerEmail: reviewerEmail ?? "a former staff member",
      carriedFromNumber: approval.carriedForwardFromId
        ? (carriedFrom.get(approval.carriedForwardFromId) ?? null)
        : null,
    })),
    assignments,
    authorIds,
  };
}

/** The flags of the latest submitted Revision before this one, which a removed flag's review follows. */
async function lastSubmittedBefore(db: Database, contentItemId: string, number: number) {
  const row = await db
    .select({ number: revision.number, snapshot: revision.snapshot })
    .from(revision)
    .innerJoin(revisionSubmission, eq(revisionSubmission.revisionId, revision.id))
    .where(and(eq(revision.contentItemId, contentItemId), lt(revision.number, number)))
    .orderBy(desc(revision.number))
    .get();
  if (!row) return null;
  const snapshot = row.snapshot as Reviewable;
  return {
    number: row.number,
    flags: snapshot.flags ?? [],
    languageVariety: snapshot.languageVariety ?? null,
    episode: !!snapshot.episode,
  };
}

/** The Revision number each carried approval was first given on, keyed by approval ID. */
async function carriedFromNumbers(db: Database, approvalIds: string[]) {
  if (!approvalIds.length) return new Map<string, number>();
  const rows = await db
    .select({ id: reviewApproval.id, number: revision.number })
    .from(reviewApproval)
    .innerJoin(revision, eq(revision.id, reviewApproval.revisionId))
    .where(inArray(reviewApproval.id, approvalIds));
  return new Map(rows.map((row) => [row.id, row.number]));
}

export type Review = NonNullable<Awaited<ReturnType<typeof loadReview>>>;

export type ReviewActionResult = { ok: true } | { ok: false; error: string };

const refuse = (error: string): ReviewActionResult => ({ ok: false, error });

/** Only the current draft can be submitted or reviewed; older Revisions are superseded. */
const isCurrent = (review: Review) => review.contentItem.currentDraftRevisionId === review.revisionId;

/** An editor sends the current draft for review. */
/** Runs a write, turning a unique-index clash (a second click racing the first) into a refusal. */
async function onceOnly(write: () => Promise<unknown>, message: string): Promise<ReviewActionResult> {
  try {
    await write();
    return { ok: true };
  } catch (error) {
    if (String(error).includes("UNIQUE") || String(error).includes("PRIMARY KEY")) return refuse(message);
    throw error;
  }
}

export async function submitRevision(db: Database, actor: Actor, review: Review): Promise<ReviewActionResult> {
  if (!can(actor, { action: "content.edit" })) return refuse("Only editors can submit for review.");
  if (!isCurrent(review)) return refuse("Only the latest revision can be submitted.");
  if (review.submitted) return refuse("This revision has already been submitted.");
  if (review.languageVariety === null && review.flags.includes("languageInstruction")) {
    return refuse("Language instruction needs its Language Variety before it can be submitted.");
  }
  return onceOnly(
    () =>
      db.batch([
        db
          .insert(revisionSubmission)
          .values({ revisionId: review.revisionId, submittedBy: actor.userId, submittedAt: new Date() }),
        auditInsert(db, {
          actorId: actor.userId,
          action: "revision.submitted",
          objectType: "revision",
          objectId: review.revisionId,
        }),
      ]),
    "This revision has already been submitted.",
  );
}

/** The staff who may be assigned a Review Type: active reviewers scoped to it. */
export async function reviewersFor(db: Database, reviewType: ReviewType) {
  return db
    .selectDistinct({ id: user.id, email: user.email, languageVariety: roleAssignment.languageVariety })
    .from(roleAssignment)
    .innerJoin(user, eq(user.id, roleAssignment.userId))
    .where(
      and(
        eq(roleAssignment.role, "reviewer"),
        eq(roleAssignment.reviewType, reviewType),
        isNull(roleAssignment.revokedAt),
      ),
    )
    .orderBy(user.email);
}

/** An editor asks a reviewer scoped to the Review Type to review the Content Item. */
export async function assignReviewer(
  db: Database,
  actor: Actor,
  review: Review,
  reviewType: ReviewType,
  reviewerId: string,
): Promise<ReviewActionResult> {
  if (!can(actor, { action: "content.edit" })) return refuse("Only editors can assign reviewers.");
  const eligible = await reviewersFor(db, reviewType);
  if (!eligible.some((reviewer) => reviewer.id === reviewerId)) {
    return refuse(`Choose someone who does ${REVIEW_NAMES[reviewType].toLowerCase()}.`);
  }
  if (review.assignments.some((row) => row.reviewType === reviewType && row.reviewerId === reviewerId)) {
    return refuse("That reviewer is already assigned.");
  }
  const id = crypto.randomUUID();
  return onceOnly(
    () =>
      db.batch([
        db.insert(reviewAssignment).values({
          id,
          contentItemId: review.contentItem.id,
          reviewType,
          reviewerId,
          assignedBy: actor.userId,
          assignedAt: new Date(),
        }),
        auditInsert(db, {
          actorId: actor.userId,
          action: "review.assigned",
          objectType: "review_assignment",
          objectId: id,
          details: { contentItemId: review.contentItem.id, reviewType, reviewerId },
        }),
      ]),
    "That reviewer is already assigned.",
  );
}

/**
 * The requirement a reviewer would be deciding for this Review Type, if they may decide it: the
 * Revision must need that review (Knowledge Holder Approvals are recorded by editors instead), and
 * can() must allow this reviewer, which rules out anyone who authored or edited the Revision.
 */
export function decidableRequirement(actor: Actor, review: Review, reviewType: ReviewType): ReviewRequirement | null {
  const requirement = review.requirements.find(
    (candidate) => candidate.reviewType === reviewType && !candidate.knowledgeHolder,
  );
  if (!requirement) return null;
  const allowed = can(actor, {
    action: "revision.review",
    revision: {
      authorIds: review.authorIds,
      assignedReviewerIds: review.assignments
        .filter((row) => row.reviewType === reviewType)
        .map((row) => row.reviewerId),
      reviewType,
      languageVariety: requirement.languageVariety,
    },
  });
  return allowed ? requirement : null;
}

const auditRefusal = (db: Database, actor: Actor, review: Review, reason: string, reviewType?: ReviewType) =>
  recordAudit(db, {
    actorId: actor.userId,
    action: "review_approval.refused",
    objectType: "revision",
    objectId: review.revisionId,
    details: { reason, ...(reviewType ? { reviewType } : {}) },
  });

/** A reviewer approves or rejects the exact Revision for one Review Type. Refusals are audited. */
export async function recordDecision(
  db: Database,
  actor: Actor,
  review: Review,
  decision: { reviewType: ReviewType; decision: "approved" | "rejected"; scope: string; notes: string },
): Promise<ReviewActionResult> {
  const { reviewType } = decision;
  const requirement = decidableRequirement(actor, review, reviewType);
  if (!requirement) {
    await auditRefusal(db, actor, review, "not allowed or not required", reviewType);
    return refuse("You can't review this revision for that Review Type.");
  }
  if (!isCurrent(review) || !review.submitted) return refuse("Only a submitted, latest revision can be reviewed.");
  if (decision.decision === "rejected" && !decision.notes) return refuse("Say what needs to change.");

  const id = crypto.randomUUID();
  await db.batch([
    db.insert(reviewApproval).values({
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
      action: decision.decision === "approved" ? "review.approved" : "review.rejected",
      objectType: "review_approval",
      objectId: id,
      details: { revisionId: review.revisionId, reviewType, languageVariety: requirement.languageVariety },
    }),
  ]);
  return { ok: true };
}

/**
 * An editor records a Knowledge Holder Approval: a cultural approval given by a Knowledge Holder,
 * with how it was given, the exact Revision seen and any conditions.
 */
export async function recordKnowledgeHolderApproval(
  db: Database,
  actor: Actor,
  review: Review,
  approval: { knowledgeHolderName: string; method: string; conditions: string; scope: string; notes: string },
): Promise<ReviewActionResult> {
  if (!can(actor, { action: "knowledgeHolderApproval.record", revision: { authorIds: review.authorIds } })) {
    await auditRefusal(db, actor, review, "knowledge holder approval not allowed");
    return refuse("Only an editor who didn't write or edit this revision can record a Knowledge Holder Approval.");
  }
  if (!isCurrent(review) || !review.submitted) return refuse("Only a submitted, latest revision can be reviewed.");
  if (!review.requirements.some((requirement) => requirement.knowledgeHolder)) {
    return refuse("This revision doesn't need a Knowledge Holder Approval.");
  }
  if (!approval.knowledgeHolderName || !approval.method) {
    return refuse("Enter the Knowledge Holder's name and how they gave their approval.");
  }
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(reviewApproval).values({
      id,
      revisionId: review.revisionId,
      reviewType: "cultural",
      decision: "approved",
      reviewerId: actor.userId,
      knowledgeHolderName: approval.knowledgeHolderName,
      knowledgeHolderMethod: approval.method,
      conditions: approval.conditions || null,
      scope: approval.scope || null,
      notes: approval.notes || null,
      decidedAt: new Date(),
    }),
    auditInsert(db, {
      actorId: actor.userId,
      action: "knowledge_holder_approval.recorded",
      objectType: "review_approval",
      objectId: id,
      details: { revisionId: review.revisionId },
    }),
  ]);
  return { ok: true };
}

/** Submitted Revisions waiting on this reviewer: the current drafts of items they are assigned to. */
export async function reviewQueue(db: Database, reviewerId: string) {
  const assigned = await db
    .select({ contentItemId: reviewAssignment.contentItemId, reviewType: reviewAssignment.reviewType })
    .from(reviewAssignment)
    .where(eq(reviewAssignment.reviewerId, reviewerId));
  if (!assigned.length) return [];
  const rows = await db
    .select({ item: contentItem, revision })
    .from(contentItem)
    .innerJoin(revision, eq(revision.id, contentItem.currentDraftRevisionId))
    .innerJoin(revisionSubmission, eq(revisionSubmission.revisionId, revision.id))
    .where(
      inArray(
        contentItem.id,
        assigned.map((row) => row.contentItemId),
      ),
    );
  const queue = [];
  for (const row of rows) {
    const review = await loadReview(db, row.revision.id);
    if (!review) continue;
    const types = assigned.filter((entry) => entry.contentItemId === row.item.id).map((entry) => entry.reviewType);
    const waiting = review.progress.filter(
      (entry) => types.includes(entry.requirement.reviewType) && entry.status === "awaiting",
    );
    if (waiting.length) {
      queue.push({
        contentItemId: row.item.id,
        number: row.revision.number,
        title: (row.revision.snapshot as { title?: string }).title ?? "Untitled",
        reviewTypes: waiting.map((entry) => entry.requirement.reviewType),
      });
    }
  }
  return queue;
}
