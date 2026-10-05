/**
 * The one place resource-level authorisation is decided (ADR-0005). Every server-side read
 * and write asks `can(actor, check)`; the rules follow docs/phase-1a-defaults.md §11.
 *
 * An Actor's roles are only ever populated by the staff gate after the session has passed
 * two-factor (ADR-0013), so this module can treat every listed role as active.
 */

export const STAFF_ROLES = [
  "administrator",
  "editor",
  "educator",
  "reviewer",
  "safeguarding_lead",
  "privacy_contact",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const REVIEW_TYPES = ["language", "cultural", "editorial", "accessibility", "safeguarding"] as const;
export type ReviewType = (typeof REVIEW_TYPES)[number];

export type RoleAssignment = {
  role: StaffRole;
  /** Reviewers only: the Review Type they may approve. */
  reviewType?: ReviewType;
  /** Language reviewers only: the Language Variety they may approve. */
  languageVariety?: string;
};

/** A signed-in person. Learners are Actors with no roles; anonymous visitors are `null`. */
export type Actor = { userId: string; roles: RoleAssignment[] };

export type CaseKind = "report" | "rights_concern" | "data_request";

type RevisionUnderReview = {
  authorIds: string[];
  assignedReviewerIds: string[];
  reviewType: ReviewType;
  languageVariety?: string;
};

export type Check =
  | { action: "staffArea.enter" }
  | { action: "account.manage" | "role.assign" | "settings.edit" }
  /** The media usage and cost report, and what the monitor is currently alerting on (VAC-10). */
  | { action: "usage.read" }
  /** Signed-in administrators still hold a working authenticator, so nobody resets their own. */
  | { action: "twoFactor.reset"; staffMember: { userId: string } }
  /**
   * Who may publish. Whether a particular Revision may be published (approvals present, rights
   * current) is the eligibility decision, not a permission (ADR-0007).
   */
  | { action: "content.edit" | "revision.publish" | "reviewLink.issue" }
  /** Taking published content down (withdraw) or retiring it (archive). */
  | { action: "content.withdraw" }
  /** Recording and withdrawing Rights Records, and reading the private evidence behind them. */
  | { action: "rights.manage" | "rightsEvidence.read" }
  /** Reading the private evidence behind a Knowledge Holder Approval. */
  | { action: "approvalEvidence.read" }
  /**
   * Uploading files and managing the media library (alt text). There is no public upload path
   * (docs/phase-1a-defaults.md §1).
   */
  | { action: "media.upload" }
  /**
   * Working the Submission queue: reading what the public sent, owning it, setting its due date
   * and sending a contributor an upload link (docs/phase-1a-defaults.md §4).
   */
  | { action: "submission.manage" }
  /** Publishing a new version of a consent notice's wording. */
  | { action: "notice.publish" }
  /** Finding a person's Consent Records and withdrawing one at their request (DATA-02). */
  | { action: "consent.manage" }
  /** Seeing the Revisions waiting on your review. */
  | { action: "reviewQueue.view" }
  /** Reading a Revision in the staff area: editors, and the reviewers assigned to it. */
  | { action: "revision.view"; revision: { assignedReviewerIds: string[] } }
  | { action: "content.hidePendingReview" }
  | { action: "knowledgeHolderApproval.record"; revision: { authorIds: string[] } }
  /** Approving or rejecting a Revision for one Review Type. */
  | { action: "revision.review"; revision: RevisionUnderReview }
  /**
   * Changing an Expression in the library: editors, and the Educator who added it while no
   * Learning Layer they aren't assigned to uses it.
   */
  | { action: "expression.edit"; expression: { createdBy: string; usedByOthers: boolean } }
  /** Adding a Learning Layer to a Video: editors, and the Educators assigned to that Video. */
  | { action: "learningLayer.create"; video: { assignedEducatorIds: string[] } }
  /** Opening and editing a Learning Layer: editors, and the Educators assigned to it (VAC-05). */
  | { action: "learningLayer.author" | "learningLayer.submit"; learningLayer: { assignedEducatorIds: string[] } }
  | { action: "case.read" | "case.act"; case: { kind: CaseKind } }
  | { action: "case.decideAppeal"; case: { kind: CaseKind; decidedBy: string } }
  | {
      action: "learnerRecord.read" | "learnerRecord.write" | "learnerRecord.export" | "learnerRecord.delete";
      learnerRecord: { ownerId: string };
    }
  | { action: "learnerData.process"; learnerRecord: { ownerId: string } };

/** Which staff role handles each kind of Case. */
export const CASE_HANDLER: Record<CaseKind, StaffRole> = {
  report: "safeguarding_lead",
  rights_concern: "safeguarding_lead",
  data_request: "privacy_contact",
};

export function can(actor: Actor | null, check: Check): boolean {
  if (!actor) return false;
  const hasRole = (role: StaffRole) => actor.roles.some((assignment) => assignment.role === role);

  switch (check.action) {
    case "staffArea.enter":
      return actor.roles.length > 0;

    case "account.manage":
    case "role.assign":
    case "settings.edit":
    case "usage.read":
      return hasRole("administrator");

    case "twoFactor.reset":
      return hasRole("administrator") && check.staffMember.userId !== actor.userId;

    case "content.edit":
    case "revision.publish":
    case "reviewLink.issue":
    case "content.withdraw":
    case "rights.manage":
    case "rightsEvidence.read":
    case "approvalEvidence.read":
      return hasRole("editor");

    case "media.upload":
      return hasRole("editor") || hasRole("educator");

    case "submission.manage":
      return hasRole("editor");

    case "notice.publish":
      return hasRole("administrator") || hasRole("privacy_contact");

    case "consent.manage":
      return hasRole("privacy_contact");

    case "reviewQueue.view":
      return hasRole("reviewer");

    case "revision.view":
      return hasRole("editor") || (hasRole("reviewer") && check.revision.assignedReviewerIds.includes(actor.userId));

    case "knowledgeHolderApproval.record":
      return hasRole("editor") && !check.revision.authorIds.includes(actor.userId);

    case "content.hidePendingReview":
      return hasRole("safeguarding_lead");

    case "revision.review": {
      const { revision } = check;
      if (revision.authorIds.includes(actor.userId)) return false;
      if (!revision.assignedReviewerIds.includes(actor.userId)) return false;
      return actor.roles.some(
        (assignment) =>
          assignment.role === "reviewer" &&
          assignment.reviewType === revision.reviewType &&
          (revision.reviewType !== "language" || assignment.languageVariety === revision.languageVariety),
      );
    }

    case "expression.edit":
      return (
        hasRole("editor") ||
        (hasRole("educator") && check.expression.createdBy === actor.userId && !check.expression.usedByOthers)
      );

    case "learningLayer.create":
      return hasRole("editor") || (hasRole("educator") && check.video.assignedEducatorIds.includes(actor.userId));

    case "learningLayer.author":
      return (
        hasRole("editor") || (hasRole("educator") && check.learningLayer.assignedEducatorIds.includes(actor.userId))
      );

    case "learningLayer.submit":
      return hasRole("educator") && check.learningLayer.assignedEducatorIds.includes(actor.userId);

    case "case.read":
    case "case.act":
      return hasRole(CASE_HANDLER[check.case.kind]);

    case "case.decideAppeal":
      return check.case.decidedBy !== actor.userId && hasRole(CASE_HANDLER[check.case.kind]);

    case "learnerRecord.read":
    case "learnerRecord.write":
    case "learnerRecord.export":
    case "learnerRecord.delete":
      return check.learnerRecord.ownerId === actor.userId;

    case "learnerData.process":
      return hasRole("privacy_contact");
  }
}
