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
  | { action: "account.manage" | "role.assign" | "settings.edit" }
  | { action: "content.edit" | "revision.publish" | "reviewLink.issue" }
  | { action: "knowledgeHolderApproval.record"; revision: { authorIds: string[] } }
  | { action: "revision.approve"; revision: RevisionUnderReview }
  | { action: "learningLayer.author"; learningLayer: { assignedEducatorIds: string[] } }
  | { action: "case.read" | "case.act"; case: { kind: CaseKind } }
  | { action: "case.decideAppeal"; case: { kind: CaseKind; decidedBy: string } }
  | {
      action: "learnerRecord.read" | "learnerRecord.export" | "learnerRecord.delete";
      learnerRecord: { ownerId: string };
    }
  | { action: "learnerData.process"; learnerRecord: { ownerId: string } };

const SAFEGUARDING_CASES: CaseKind[] = ["report", "rights_concern"];

export function can(actor: Actor | null, check: Check): boolean {
  if (!actor) return false;
  const has = (role: StaffRole) => actor.roles.some((assignment) => assignment.role === role);

  switch (check.action) {
    case "account.manage":
    case "role.assign":
    case "settings.edit":
      return has("administrator");

    case "content.edit":
    case "revision.publish":
    case "reviewLink.issue":
      return has("editor");

    case "knowledgeHolderApproval.record":
      return has("editor") && !check.revision.authorIds.includes(actor.userId);

    case "revision.approve": {
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

    case "learningLayer.author":
      return has("educator") && check.learningLayer.assignedEducatorIds.includes(actor.userId);

    case "case.read":
    case "case.act":
      return SAFEGUARDING_CASES.includes(check.case.kind) ? has("safeguarding_lead") : has("privacy_contact");

    case "case.decideAppeal":
      return (
        check.case.decidedBy !== actor.userId &&
        (SAFEGUARDING_CASES.includes(check.case.kind) ? has("safeguarding_lead") : has("privacy_contact"))
      );

    case "learnerRecord.read":
    case "learnerRecord.export":
    case "learnerRecord.delete":
      return check.learnerRecord.ownerId === actor.userId;

    case "learnerData.process":
      return has("privacy_contact");
  }
}
