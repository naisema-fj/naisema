import { and, desc, eq, getTableColumns, gt, inArray, isNull, lt, lte, notExists, type SQL, sql } from "drizzle-orm";
import { alias, type SQLiteColumn } from "drizzle-orm/sqlite-core";
import {
  auditEvent,
  contentItem,
  learningLayer,
  learningLayerApproval,
  learningLayerReviewAssignment,
  learningLayerRevision,
  learningLayerSubmission,
  reviewApproval,
  reviewAssignment,
  revision,
  revisionSubmission,
  roleAssignment,
  user,
} from "~db/schema";
import type { ArticleSnapshot } from "./article-fields";
import { auditInsert, recordAudit } from "./audit.server";
import type { ContentType } from "./content-types";
import type { Database } from "./db.server";
import type { EpisodeDetails } from "./episode-fields";
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

/**
 * Review of exact Revisions (ADR-0003, ADR-0006), for Content Items and Learning Layers alike: an
 * editor (or, for a Learning Layer, an assigned Educator) submits the current draft, editors assign
 * reviewers, assigned reviewers approve or reject it for their Review Type, an editor records a
 * Knowledge Holder's approval, and approvals whose fingerprint is unchanged carry forward to the
 * next Revision. One module does all of it; a `ReviewSubject` adapter says which tables a kind of
 * thing is reviewed in and what its audit records are called. Learning Layers' own loader and the
 * Review Link and evidence on their Knowledge Holder Approvals are in app/lib/layer-review.server.ts.
 * Whether a Revision may be published is app/lib/visibility.server.ts; publishing is
 * app/lib/publication.server.ts.
 */

// --- What differs between the two kinds of review ---

/**
 * A kind of thing whose Revisions are reviewed. Content Items and Learning Layers keep their
 * Revisions, submissions, assignments and approvals in tables of their own with the same columns
 * (db/schema.ts), apart from the column naming their parent; so one adapter per kind says which
 * tables, which parent column, and what its audit records are called.
 */
export type ReviewSubject = {
  kind: "contentItem" | "learningLayer";
  parent: { table: typeof contentItem; id: SQLiteColumn; createdBy: SQLiteColumn; draftId: SQLiteColumn };
  revision: typeof revision;
  revisionParent: SQLiteColumn;
  /** The Revision's parent column, as a value to insert. */
  revisionParentKey: "contentItemId" | "learningLayerId";
  /** What a save made from an outdated Revision is told. */
  staleSave: string;
  submission: typeof revisionSubmission;
  assignment: typeof reviewAssignment;
  assignmentParent: SQLiteColumn;
  /** The assignment's parent column, as a value to insert. */
  assignmentParentKey: "contentItemId" | "learningLayerId";
  approval: typeof reviewApproval;
  audit: {
    saved: string;
    restored: string;
    revisionType: string;
    approvalType: string;
    assignmentType: string;
    submitted: string;
    assigned: string;
    approved: string;
    rejected: string;
    refused: string;
    carried: string;
  };
};

// The Learning Layer tables have every column the Content Item tables have, under the same names
// (the approval table adds the Review Link and evidence), apart from the parent column, which each
// adapter names. So they are used through the Content Item tables' types.
const same = <Table>(table: unknown) => table as Table;

export const CONTENT_ITEM_REVIEW: ReviewSubject = {
  kind: "contentItem",
  parent: {
    table: contentItem,
    id: contentItem.id,
    createdBy: contentItem.createdBy,
    draftId: contentItem.currentDraftRevisionId,
  },
  revision,
  revisionParent: revision.contentItemId,
  revisionParentKey: "contentItemId",
  staleSave: "Someone else saved this while you were editing. Open it again to see their changes, then make yours.",
  submission: revisionSubmission,
  assignment: reviewAssignment,
  assignmentParent: reviewAssignment.contentItemId,
  assignmentParentKey: "contentItemId",
  approval: reviewApproval,
  audit: {
    saved: "revision.saved",
    restored: "revision.restored",
    revisionType: "revision",
    approvalType: "review_approval",
    assignmentType: "review_assignment",
    submitted: "revision.submitted",
    assigned: "review.assigned",
    approved: "review.approved",
    rejected: "review.rejected",
    refused: "review_approval.refused",
    carried: "review_approval.carried_forward",
  },
};

export const LEARNING_LAYER_REVIEW: ReviewSubject = {
  kind: "learningLayer",
  parent: {
    table: same(learningLayer),
    id: learningLayer.id,
    createdBy: learningLayer.createdBy,
    draftId: learningLayer.currentDraftRevisionId,
  },
  revision: same(learningLayerRevision),
  revisionParent: learningLayerRevision.learningLayerId,
  revisionParentKey: "learningLayerId",
  staleSave:
    "Someone else saved this Learning Layer while you were editing. Open it again to see their changes, then make yours.",
  submission: same(learningLayerSubmission),
  assignment: same(learningLayerReviewAssignment),
  assignmentParent: learningLayerReviewAssignment.learningLayerId,
  assignmentParentKey: "learningLayerId",
  approval: same(learningLayerApproval),
  audit: {
    saved: "learning_layer_revision.saved",
    restored: "learning_layer_revision.restored",
    revisionType: "learning_layer_revision",
    approvalType: "learning_layer_approval",
    assignmentType: "learning_layer_review_assignment",
    submitted: "learning_layer_revision.submitted",
    assigned: "learning_layer_review.assigned",
    approved: "learning_layer_review.approved",
    rejected: "learning_layer_review.rejected",
    refused: "learning_layer_approval.refused",
    carried: "learning_layer_approval.carried_forward",
  },
};

// --- Reading a Revision's review ---

/** A stored Review Approval, a Content Item's or a Learning Layer's, as the review rules see it. */
export function toRecordedDecision(
  row: Pick<
    typeof reviewApproval.$inferSelect,
    "id" | "reviewType" | "languageVariety" | "decision" | "knowledgeHolderName" | "reviewerId" | "decidedAt"
  >,
): RecordedDecision {
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
 * Everyone who authored or edited a Revision: whoever created its Content Item or Learning Layer
 * and whoever saved it or any earlier Revision, since their words are still in it.
 */
export async function authorIdsOf(subject: ReviewSubject, db: Database, parentId: string, upToNumber: number) {
  const [parent, savers] = await Promise.all([
    db
      .select({ createdBy: sql<string>`${subject.parent.createdBy}` })
      .from(subject.parent.table)
      .where(eq(subject.parent.id, parentId))
      .get(),
    db
      .selectDistinct({ createdBy: subject.revision.createdBy })
      .from(subject.revision)
      .where(and(eq(subject.revisionParent, parentId), lte(subject.revision.number, upToNumber))),
  ]);
  return [...new Set([...(parent ? [parent.createdBy] : []), ...savers.map((row) => row.createdBy)])];
}

/** The reviewers assigned to a Content Item or Learning Layer, by Review Type. */
function assignmentsOf(subject: ReviewSubject, db: Database, parentId: string) {
  const { assignment } = subject;
  return db
    .select({
      id: assignment.id,
      reviewType: assignment.reviewType,
      reviewerId: assignment.reviewerId,
      email: user.email,
    })
    .from(assignment)
    .leftJoin(user, eq(user.id, assignment.reviewerId))
    .where(eq(subject.assignmentParent, parentId))
    .orderBy(assignment.reviewType, user.email);
}

/** Every user assigned to review any Review Type of a Content Item or Learning Layer. */
export async function assignedReviewerIds(subject: ReviewSubject, db: Database, parentId: string) {
  return [...new Set((await assignmentsOf(subject, db, parentId)).map((row) => row.reviewerId))];
}

/** The latest submitted Revision before this one, whose flags a removed flag's review follows. */
async function lastSubmittedBefore(subject: ReviewSubject, db: Database, parentId: string, number: number) {
  const { revision: table } = subject;
  return (
    (await db
      .select({ number: table.number, snapshot: table.snapshot })
      .from(table)
      .innerJoin(subject.submission, eq(subject.submission.revisionId, table.id))
      .where(and(eq(subject.revisionParent, parentId), lt(table.number, number)))
      .orderBy(desc(table.number))
      .get()) ?? null
  );
}

/** A Revision's approvals, newest first, with who decided and the Revision any carried one was first given on. */
async function approvalsOn(subject: ReviewSubject, db: Database, revisionId: string) {
  const { approval, revision: table } = subject;
  const original = alias(approval, "original");
  const rows = await db
    .select({ approval, reviewerEmail: user.email, carriedFromNumber: table.number })
    .from(approval)
    .leftJoin(user, eq(user.id, approval.reviewerId))
    .leftJoin(original, eq(original.id, approval.carriedForwardFromId))
    .leftJoin(table, eq(table.id, original.revisionId))
    .where(eq(approval.revisionId, revisionId))
    .orderBy(desc(approval.decidedAt));
  return rows.map(({ approval: row, reviewerEmail, carriedFromNumber }) => ({
    ...row,
    reviewerEmail: reviewerEmail ?? "a former staff member",
    carriedFromNumber: row.carriedForwardFromId ? carriedFromNumber : null,
  }));
}

/** Flags, Language Variety and whether an Episode needs a transcript review, at one Revision. */
type ReviewFacts = Parameters<typeof requiredReviewsSince>[0];

/**
 * What every review shares: what the Revision needs, what has been decided on it, who may not
 * review it, and its state. Each kind's loader adds what is its own.
 */
export async function reviewCore(
  subject: ReviewSubject,
  db: Database,
  found: {
    revisionId: string;
    number: number;
    parentId: string;
    currentDraftRevisionId: string | null;
    submitted: boolean;
  },
  facts: ReviewFacts,
  /** The same facts at the latest Revision submitted before this one. */
  factsAt: (snapshot: unknown) => ReviewFacts,
) {
  const [approvals, assignments, authorIds, last] = await Promise.all([
    approvalsOn(subject, db, found.revisionId),
    assignmentsOf(subject, db, found.parentId),
    authorIdsOf(subject, db, found.parentId, found.number),
    lastSubmittedBefore(subject, db, found.parentId, found.number),
  ]);
  const requirements = requiredReviewsSince(facts, last && { number: last.number, ...factsAt(last.snapshot) });
  const progress = reviewProgress(requirements, approvals.map(toRecordedDecision));
  return {
    subject,
    revisionId: found.revisionId,
    number: found.number,
    parentId: found.parentId,
    currentDraftRevisionId: found.currentDraftRevisionId,
    requirements,
    progress,
    submitted: found.submitted,
    state: revisionState({
      submitted: found.submitted,
      allApproved: progress.every((entry) => entry.status === "approved"),
      superseded: found.currentDraftRevisionId !== found.revisionId,
    }),
    approvals,
    assignments,
    authorIds,
  };
}

/** A Revision's review, whatever it is the Revision of. */
export type ReviewCore = Awaited<ReturnType<typeof reviewCore>>;

/** What every content type's snapshot carries for review: its Content Flags and Language Variety. */
export type Reviewable = {
  flags?: ContentFlag[];
  languageVariety?: string | null;
  /** A Resource's download, which must have passed its scan for the Revision to be public. */
  resource?: { source: { kind: "file"; assetId: string } | { kind: "link" } };
  /** An Episode's recording, whose transcript is reviewed for accessibility and needed to publish. */
  episode?: EpisodeDetails;
};

const contentFacts = (snapshot: unknown): ReviewFacts => {
  const reviewable = snapshot as Reviewable;
  return {
    flags: reviewable.flags ?? [],
    languageVariety: reviewable.languageVariety ?? null,
    episode: !!reviewable.episode,
  };
};

/** Everything about one Content Item Revision's review: what it needs, what has been decided, and its state. */
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
  const facts = contentFacts(snapshot);
  const flags = snapshot.flags ?? [];
  const core = await reviewCore(
    CONTENT_ITEM_REVIEW,
    db,
    {
      revisionId: row.revision.id,
      number: row.revision.number,
      parentId: row.item.id,
      currentDraftRevisionId: row.item.currentDraftRevisionId,
      submitted: row.submission !== null,
    },
    facts,
    contentFacts,
  );
  return {
    ...core,
    contentItem: {
      id: row.item.id,
      type: row.item.type as ContentType,
      publicationState: row.item.publicationState as PublicationState,
      currentDraftRevisionId: row.item.currentDraftRevisionId,
      currentPublishedRevisionId: row.item.currentPublishedRevisionId,
    },
    flags,
    languageVariety: facts.languageVariety ?? null,
    /** What it is, for what its kind needs of its own (content-kinds.ts, visibility.server.ts). */
    content,
    /** The media library files the Revision shows or offers; each needs rights of its own. */
    mediaAssetIds: mediaAssetIdsIn(content),
  };
}

export type Review = NonNullable<Awaited<ReturnType<typeof loadReview>>>;

// --- Carrying approvals forward ---

/**
 * The inserts that carry approvals forward to a new Revision (ADR-0003), for running in the same
 * batch as the new Revision. They come from the Revision the new one's content came from: the base
 * for an edit, the restored Revision for a restore. Each approval on it whose Review Type's
 * fingerprint is unchanged, unless its reviewer edited the new Revision, becomes an explicit
 * Carried-forward Approval: a copy of every column (a Learning Layer's Review Link and evidence
 * included), pointing at the approval it carries, keeping its original decision date, and audited.
 * The insert re-checks that no newer decision for that Review Type landed since the approvals were
 * read, so a rejection recorded at the same moment is never carried past.
 */
export async function carryForwardInserts(
  subject: ReviewSubject,
  db: Database,
  carry: {
    parentId: string;
    /** The Revision whose content and approvals the new one takes up. */
    sourceRevisionId: string;
    newRevisionId: string;
    newNumber: number;
    newFingerprints: Fingerprints;
    savedBy: string;
  },
) {
  const { approval, revision: table } = subject;
  const [source, approvals, earlierAuthors] = await Promise.all([
    db.select({ fingerprints: table.fingerprints }).from(table).where(eq(table.id, carry.sourceRevisionId)).get(),
    db.select().from(approval).where(eq(approval.revisionId, carry.sourceRevisionId)),
    authorIdsOf(subject, db, carry.parentId, carry.newNumber - 1),
  ]);
  const carried = approvalsToCarryForward({
    approvals: approvals.map(toRecordedDecision),
    baseFingerprints: (source?.fingerprints ?? {}) as Fingerprints,
    newFingerprints: carry.newFingerprints,
    newAuthorIds: [...earlierAuthors, carry.savedBy],
  });
  return carried.flatMap(({ id: originalId }) => {
    const id = crypto.randomUUID();
    const original = alias(approval, "original");
    const newer = alias(approval, "newer");
    // Every column of the original, by its own name, but for the copy's ID, Revision and origin.
    const copied: Record<string, SQL.Aliased | SQLiteColumn> = Object.fromEntries(
      Object.keys(getTableColumns(approval)).map((name) => [
        name,
        original[name as keyof typeof original] as SQLiteColumn,
      ]),
    );
    copied.id = sql<string>`${id}`.as("id");
    copied.revisionId = sql<string>`${carry.newRevisionId}`.as("revision_id");
    copied.carriedForwardFromId = original.id;
    return [
      db.insert(approval).select(
        db
          .select(copied)
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
          ) as never,
      ),
      db.insert(auditEvent).select(
        db
          .select({
            id: sql<string>`${crypto.randomUUID()}`.as("id"),
            actorId: sql<string>`${carry.savedBy}`.as("actor_id"),
            action: sql<string>`${subject.audit.carried}`.as("action"),
            objectType: sql<string>`${subject.audit.approvalType}`.as("object_type"),
            objectId: approval.id,
            details: sql<string>`${JSON.stringify({ revisionId: carry.newRevisionId, from: originalId })}`.as(
              "details",
            ),
            createdAt: sql<number>`${Date.now()}`.as("created_at"),
          })
          .from(approval)
          .where(eq(approval.id, id)),
      ),
    ];
  });
}

// --- Acting on a review ---

export type ReviewActionResult = { ok: true } | { ok: false; error: string };

export const refuse = (error: string): ReviewActionResult => ({ ok: false, error });

/** Only the current draft can be submitted or reviewed; older Revisions are superseded. */
const isCurrent = (review: ReviewCore) => review.currentDraftRevisionId === review.revisionId;

/** Runs a write, turning a unique-index clash (a second click racing the first) into a refusal. */
export async function onceOnly(write: () => Promise<unknown>, message: string): Promise<ReviewActionResult> {
  try {
    await write();
    return { ok: true };
  } catch (error) {
    if (String(error).includes("UNIQUE") || String(error).includes("PRIMARY KEY")) return refuse(message);
    throw error;
  }
}

/**
 * Sends the current draft for review, once whoever asks has been allowed to: each kind decides who
 * may (`submitRevision` here, `submitLayerRevision` for Learning Layers).
 */
export async function submitDraft(db: Database, actor: Actor, review: ReviewCore): Promise<ReviewActionResult> {
  if (!isCurrent(review)) return refuse("Only the latest revision can be submitted.");
  if (review.submitted) return refuse("This revision has already been submitted.");
  const { subject } = review;
  return onceOnly(
    () =>
      db.batch([
        db
          .insert(subject.submission)
          .values({ revisionId: review.revisionId, submittedBy: actor.userId, submittedAt: new Date() }),
        auditInsert(db, {
          actorId: actor.userId,
          action: subject.audit.submitted,
          objectType: subject.audit.revisionType,
          objectId: review.revisionId,
        }),
      ]),
    "This revision has already been submitted.",
  );
}

/** An editor sends a Content Item's current draft for review; language instruction needs its Variety first. */
export async function submitRevision(db: Database, actor: Actor, review: Review): Promise<ReviewActionResult> {
  if (!can(actor, { action: "content.edit" })) return refuse("Only editors can submit for review.");
  const ready = isCurrent(review) && !review.submitted;
  if (ready && review.languageVariety === null && review.flags.includes("languageInstruction")) {
    return refuse("Language instruction needs its Language Variety before it can be submitted.");
  }
  return submitDraft(db, actor, review);
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

/** An editor asks a reviewer scoped to the Review Type to review the Content Item or Learning Layer. */
export async function assignReviewer(
  db: Database,
  actor: Actor,
  review: ReviewCore,
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
  const { subject } = review;
  const id = crypto.randomUUID();
  return onceOnly(
    () =>
      db.batch([
        db.insert(subject.assignment).values({
          id,
          [subject.assignmentParentKey]: review.parentId,
          reviewType,
          reviewerId,
          assignedBy: actor.userId,
          assignedAt: new Date(),
        } as typeof reviewAssignment.$inferInsert),
        auditInsert(db, {
          actorId: actor.userId,
          action: subject.audit.assigned,
          objectType: subject.audit.assignmentType,
          objectId: id,
          details: { [subject.assignmentParentKey]: review.parentId, reviewType, reviewerId },
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
export function decidableRequirement(
  actor: Actor,
  review: Pick<ReviewCore, "requirements" | "authorIds" | "assignments">,
  reviewType: ReviewType,
): ReviewRequirement | null {
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

const auditRefusal = (db: Database, actor: Actor, review: ReviewCore, reason: string, reviewType?: ReviewType) =>
  recordAudit(db, {
    actorId: actor.userId,
    action: review.subject.audit.refused,
    objectType: review.subject.audit.revisionType,
    objectId: review.revisionId,
    details: { reason, ...(reviewType ? { reviewType } : {}) },
  });

/** A reviewer approves or rejects the exact Revision for one Review Type. Refusals are audited. */
export async function recordDecision(
  db: Database,
  actor: Actor,
  review: ReviewCore,
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
  const { subject } = review;
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(subject.approval).values({
      id,
      revisionId: review.revisionId,
      reviewType,
      languageVariety: requirement.languageVariety ?? null,
      decision: decision.decision,
      reviewerId: actor.userId,
      scope: decision.scope.slice(0, APPROVAL_LIMITS.scope) || null,
      notes: decision.notes.slice(0, APPROVAL_LIMITS.notes) || null,
      decidedAt: new Date(),
    }),
    auditInsert(db, {
      actorId: actor.userId,
      action: decision.decision === "approved" ? subject.audit.approved : subject.audit.rejected,
      objectType: subject.audit.approvalType,
      objectId: id,
      details: { revisionId: review.revisionId, reviewType, languageVariety: requirement.languageVariety },
    }),
  ]);
  return { ok: true };
}

/** The longest an approval's free-text fields are kept, in characters. */
export const APPROVAL_LIMITS = { name: 200, method: 200, scope: 500, notes: 2000, conditions: 2000 } as const;

export type KnowledgeHolderDetails = {
  knowledgeHolderName: string;
  method: string;
  conditions: string;
  scope: string;
  notes: string;
};

/**
 * Why an editor can't record a Knowledge Holder Approval on this Revision, or null if they can:
 * only an editor who didn't write or edit it, on the submitted current draft, when it needs one,
 * with who gave it and how. A refusal for permission is audited.
 */
export async function knowledgeHolderRefusal(
  db: Database,
  actor: Actor,
  review: ReviewCore,
  approval: Pick<KnowledgeHolderDetails, "knowledgeHolderName" | "method">,
): Promise<ReviewActionResult | null> {
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
  return null;
}

/**
 * The writes recording a Knowledge Holder Approval on the exact Revision: a cultural approval with
 * who gave it, how, any conditions, and whatever else a kind of review records with it (a Learning
 * Layer's Review Link and evidence), audited. Check `knowledgeHolderRefusal` first.
 */
export function knowledgeHolderInserts(
  db: Database,
  actor: Actor,
  review: ReviewCore,
  approval: KnowledgeHolderDetails,
  extra: { values?: Record<string, unknown>; details?: Record<string, unknown> } = {},
) {
  const { subject } = review;
  const id = crypto.randomUUID();
  return [
    db.insert(subject.approval).values({
      id,
      revisionId: review.revisionId,
      reviewType: "cultural",
      decision: "approved",
      reviewerId: actor.userId,
      knowledgeHolderName: approval.knowledgeHolderName.slice(0, APPROVAL_LIMITS.name),
      knowledgeHolderMethod: approval.method.slice(0, APPROVAL_LIMITS.method),
      conditions: approval.conditions.slice(0, APPROVAL_LIMITS.conditions) || null,
      scope: approval.scope.slice(0, APPROVAL_LIMITS.scope) || null,
      notes: approval.notes.slice(0, APPROVAL_LIMITS.notes) || null,
      decidedAt: new Date(),
      ...extra.values,
    } as typeof reviewApproval.$inferInsert),
    auditInsert(db, {
      actorId: actor.userId,
      action: "knowledge_holder_approval.recorded",
      objectType: subject.audit.approvalType,
      objectId: id,
      details: { revisionId: review.revisionId, ...extra.details },
    }),
  ] as const;
}

/** An editor records a Knowledge Holder Approval on a Content Item Revision. */
export async function recordKnowledgeHolderApproval(
  db: Database,
  actor: Actor,
  review: ReviewCore,
  approval: KnowledgeHolderDetails,
): Promise<ReviewActionResult> {
  const refused = await knowledgeHolderRefusal(db, actor, review, approval);
  if (refused) return refused;
  await db.batch([...knowledgeHolderInserts(db, actor, review, approval)]);
  return { ok: true };
}

// --- Reviewers' queues ---

/**
 * Submitted Revisions waiting on this reviewer, of one kind: the current drafts of the Content
 * Items or Learning Layers they are assigned to, with the Review Types still awaiting them.
 */
export async function reviewQueue(
  subject: ReviewSubject,
  db: Database,
  reviewerId: string,
  load: (db: Database, revisionId: string) => Promise<(ReviewCore & { title: string }) | null>,
) {
  const assigned = await db
    .select({ parentId: sql<string>`${subject.assignmentParent}`, reviewType: subject.assignment.reviewType })
    .from(subject.assignment)
    .where(eq(subject.assignment.reviewerId, reviewerId));
  if (!assigned.length) return [];
  const rows = await db
    .select({ parentId: sql<string>`${subject.parent.id}`, revisionId: subject.revision.id })
    .from(subject.parent.table)
    .innerJoin(subject.revision, eq(subject.revision.id, subject.parent.draftId))
    .innerJoin(subject.submission, eq(subject.submission.revisionId, subject.revision.id))
    .where(
      inArray(
        subject.parent.id,
        assigned.map((row) => row.parentId),
      ),
    );
  const queue = [];
  for (const row of rows) {
    const review = await load(db, row.revisionId);
    if (!review) continue;
    const types = assigned.filter((entry) => entry.parentId === row.parentId).map((entry) => entry.reviewType);
    const waiting = review.progress.filter(
      (entry) => types.includes(entry.requirement.reviewType) && entry.status === "awaiting",
    );
    if (waiting.length) {
      queue.push({
        id: row.parentId,
        number: review.number,
        title: review.title,
        reviewTypes: waiting.map((entry) => entry.requirement.reviewType),
      });
    }
  }
  return queue;
}

/** Content Item Revisions waiting on this reviewer. */
export const contentReviewQueue = (db: Database, reviewerId: string) =>
  reviewQueue(CONTENT_ITEM_REVIEW, db, reviewerId, async (inner, revisionId) => {
    const review = await loadReview(inner, revisionId);
    if (!review) return null;
    const row = await inner
      .select({ snapshot: revision.snapshot })
      .from(revision)
      .where(eq(revision.id, revisionId))
      .get();
    return { ...review, title: (row?.snapshot as { title?: string } | undefined)?.title ?? "Untitled" };
  });
