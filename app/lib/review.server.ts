import { and, desc, eq, inArray, isNull, lte } from "drizzle-orm";
import {
  contentItem,
  reviewApproval,
  reviewAssignment,
  revision,
  revisionSubmission,
  roleAssignment,
  user,
} from "~db/schema";
import { auditInsert } from "./audit.server";
import type { Database } from "./db.server";
import { type Actor, can, type ReviewType } from "./permissions";
import type { PublicationState } from "./review-names";
import {
  approvalsToCarryForward,
  type ContentFlag,
  type Fingerprints,
  type RecordedDecision,
  requiredReviews,
  reviewProgress,
  revisionState,
} from "./review-rules";

/** What every content type's snapshot carries for review: its Content Flags and Language Variety. */
export type Reviewable = { flags?: ContentFlag[]; languageVariety?: string | null };

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
 * The inserts that carry a base Revision's approvals forward to a new one (ADR-0003), for running
 * in the same batch as the new Revision. Each is an explicit Carried-forward Approval pointing at
 * the approval it carries, and is audited.
 */
export async function carryForwardInserts(
  db: Database,
  carry: {
    contentItemId: string;
    baseRevisionId: string;
    newRevisionId: string;
    newNumber: number;
    newFingerprints: Fingerprints;
    savedBy: string;
  },
) {
  const [base, approvals, earlierAuthors] = await Promise.all([
    db
      .select({ fingerprints: revision.fingerprints })
      .from(revision)
      .where(eq(revision.id, carry.baseRevisionId))
      .get(),
    db.select().from(reviewApproval).where(eq(reviewApproval.revisionId, carry.baseRevisionId)),
    authorIdsOf(db, carry.contentItemId, carry.newNumber - 1),
  ]);
  const carried = approvalsToCarryForward({
    approvals: approvals.map(toRecordedDecision),
    baseFingerprints: (base?.fingerprints ?? {}) as Fingerprints,
    newFingerprints: carry.newFingerprints,
    newAuthorIds: [...earlierAuthors, carry.savedBy],
  });
  const rows = new Map(approvals.map((row) => [row.id, row]));
  const now = new Date();
  return carried.flatMap((decision) => {
    const original = rows.get(decision.id) as ApprovalRow;
    const id = crypto.randomUUID();
    return [
      db.insert(reviewApproval).values({
        ...original,
        id,
        revisionId: carry.newRevisionId,
        carriedForwardFromId: original.id,
        decidedAt: now,
      }),
      auditInsert(db, {
        actorId: carry.savedBy,
        action: "review_approval.carried_forward",
        objectType: "review_approval",
        objectId: id,
        details: { revisionId: carry.newRevisionId, reviewType: original.reviewType, from: original.id },
      }),
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

  const snapshot = row.revision.snapshot as Reviewable;
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
  const carriedFrom = await carriedFromNumbers(
    db,
    approvals.map(({ approval }) => approval.carriedForwardFromId).filter((id): id is string => id !== null),
  );

  const requirements = requiredReviews(flags, languageVariety);
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
export async function submitRevision(db: Database, actor: Actor, review: Review): Promise<ReviewActionResult> {
  if (!can(actor, { action: "content.edit" })) return refuse("Only editors can submit for review.");
  if (!isCurrent(review)) return refuse("Only the latest revision can be submitted.");
  if (review.submitted) return refuse("This revision has already been submitted.");
  if (review.languageVariety === null && review.flags.includes("languageInstruction")) {
    return refuse("Language instruction needs its Language Variety before it can be submitted.");
  }
  await db.batch([
    db
      .insert(revisionSubmission)
      .values({ revisionId: review.revisionId, submittedBy: actor.userId, submittedAt: new Date() }),
    auditInsert(db, {
      actorId: actor.userId,
      action: "revision.submitted",
      objectType: "revision",
      objectId: review.revisionId,
    }),
  ]);
  return { ok: true };
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
    return refuse(`Choose someone who reviews ${reviewType}.`);
  }
  if (review.assignments.some((row) => row.reviewType === reviewType && row.reviewerId === reviewerId)) {
    return refuse("That reviewer is already assigned.");
  }
  const id = crypto.randomUUID();
  await db.batch([
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
  ]);
  return { ok: true };
}

/** A reviewer approves or rejects the exact Revision for one Review Type. */
export async function recordDecision(
  db: Database,
  actor: Actor,
  review: Review,
  decision: { reviewType: ReviewType; decision: "approved" | "rejected"; scope: string; notes: string },
): Promise<ReviewActionResult> {
  const { reviewType } = decision;
  const languageVariety = reviewType === "language" ? (review.languageVariety ?? undefined) : undefined;
  const allowed = can(actor, {
    action: "revision.review",
    revision: {
      authorIds: review.authorIds,
      assignedReviewerIds: review.assignments
        .filter((row) => row.reviewType === reviewType)
        .map((row) => row.reviewerId),
      reviewType,
      languageVariety,
    },
  });
  if (!allowed) return refuse("You can't review this revision for that Review Type.");
  if (!isCurrent(review) || !review.submitted) return refuse("Only a submitted, latest revision can be reviewed.");
  if (decision.decision === "rejected" && !decision.notes) return refuse("Say what needs to change.");

  const id = crypto.randomUUID();
  await db.batch([
    db.insert(reviewApproval).values({
      id,
      revisionId: review.revisionId,
      reviewType,
      languageVariety: languageVariety ?? null,
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
      details: { revisionId: review.revisionId, reviewType, languageVariety },
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
    return refuse("Only an editor who didn't write or edit this revision can record a Knowledge Holder Approval.");
  }
  if (!isCurrent(review) || !review.submitted) return refuse("Only a submitted, latest revision can be reviewed.");
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
