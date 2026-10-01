import { describe, expect, it } from "vitest";
import { type Actor, type Check, can, type RoleAssignment } from "~/lib/permissions";

// Rows follow the permissions matrix in docs/phase-1a-defaults.md §11.
const staff = (userId: string, ...roles: RoleAssignment[]): Actor => ({ userId, roles });
const learner = (userId: string): Actor => ({ userId, roles: [] });

const administrator = staff("admin", { role: "administrator" });
const editor = staff("editor", { role: "editor" });
const educator = staff("educator", { role: "educator" });
const languageReviewer = staff("lang-reviewer", {
  role: "reviewer",
  reviewType: "language",
  languageVariety: "standard-fijian",
});
const culturalReviewer = staff("cultural-reviewer", { role: "reviewer", reviewType: "cultural" });
const safeguardingLead = staff("safeguarding", { role: "safeguarding_lead" });
const privacyContact = staff("privacy", { role: "privacy_contact" });
const editorAndReviewer = staff(
  "natasha",
  { role: "editor" },
  { role: "reviewer", reviewType: "language", languageVariety: "standard-fijian" },
);

const languageRevision = (overrides: Partial<{ authorIds: string[]; assignedReviewerIds: string[] }> = {}) =>
  ({
    action: "revision.review",
    revision: {
      authorIds: ["editor"],
      assignedReviewerIds: ["lang-reviewer", "natasha"],
      reviewType: "language",
      languageVariety: "standard-fijian",
      ...overrides,
    },
  }) satisfies Check;

const rows: [string, Actor | null, Check, boolean][] = [
  // Entering the staff area at all
  ["any staff role may enter the staff area", educator, { action: "staffArea.enter" }, true],
  ["a signed-in person without a staff role may not", learner("me"), { action: "staffArea.enter" }, false],
  ["an anonymous visitor may not", null, { action: "staffArea.enter" }, false],

  // Administrator
  ["administrator manages accounts", administrator, { action: "account.manage" }, true],
  ["administrator assigns roles", administrator, { action: "role.assign" }, true],
  ["administrator edits site settings and feature flags", administrator, { action: "settings.edit" }, true],
  [
    "administrator resets another staff member's two-factor",
    administrator,
    { action: "twoFactor.reset", staffMember: { userId: "editor" } },
    true,
  ],
  [
    "administrator cannot reset their own two-factor",
    administrator,
    { action: "twoFactor.reset", staffMember: { userId: "admin" } },
    false,
  ],
  ["administrator cannot read report cases", administrator, { action: "case.read", case: { kind: "report" } }, false],
  [
    "administrator cannot read data-request cases",
    administrator,
    { action: "case.read", case: { kind: "data_request" } },
    false,
  ],
  ["administrator cannot approve reviews by role alone", administrator, languageRevision(), false],
  [
    "administrator cannot read revisions by role alone",
    administrator,
    { action: "revision.view", revision: { assignedReviewerIds: [] } },
    false,
  ],
  ["administrator cannot withdraw content", administrator, { action: "content.withdraw" }, false],
  ["administrator cannot manage Rights Records by role alone", administrator, { action: "rights.manage" }, false],
  ["administrator cannot read rights evidence", administrator, { action: "rightsEvidence.read" }, false],

  // Editor
  ["editor edits content", editor, { action: "content.edit" }, true],
  ["editor publishes eligible revisions", editor, { action: "revision.publish" }, true],
  ["editor issues review links", editor, { action: "reviewLink.issue" }, true],
  [
    "editor records a knowledge holder approval on someone else's revision",
    editor,
    { action: "knowledgeHolderApproval.record", revision: { authorIds: ["educator"] } },
    true,
  ],
  [
    "editor cannot record a knowledge holder approval on their own revision",
    editor,
    { action: "knowledgeHolderApproval.record", revision: { authorIds: ["editor"] } },
    false,
  ],
  ["editor cannot assign roles", editor, { action: "role.assign" }, false],
  [
    "editor cannot reset a staff member's two-factor",
    editor,
    { action: "twoFactor.reset", staffMember: { userId: "educator" } },
    false,
  ],
  [
    "editor cannot approve reviews without a reviewer role",
    editor,
    languageRevision({ authorIds: ["educator"] }),
    false,
  ],

  ["editor withdraws and archives published content", editor, { action: "content.withdraw" }, true],
  ["editor records and withdraws Rights Records", editor, { action: "rights.manage" }, true],
  ["editor reads rights evidence", editor, { action: "rightsEvidence.read" }, true],
  ["editor reads any revision", editor, { action: "revision.view", revision: { assignedReviewerIds: [] } }, true],

  // Educator
  [
    "educator authors an assigned learning layer",
    educator,
    { action: "learningLayer.author", learningLayer: { assignedEducatorIds: ["educator"] } },
    true,
  ],
  [
    "educator cannot author an unassigned learning layer",
    educator,
    { action: "learningLayer.author", learningLayer: { assignedEducatorIds: ["someone-else"] } },
    false,
  ],
  [
    "educator submits an assigned learning layer for review",
    educator,
    { action: "learningLayer.submit", learningLayer: { assignedEducatorIds: ["educator"] } },
    true,
  ],
  [
    "educator cannot submit an unassigned learning layer",
    educator,
    { action: "learningLayer.submit", learningLayer: { assignedEducatorIds: ["someone-else"] } },
    false,
  ],
  ["educator cannot publish", educator, { action: "revision.publish" }, false],
  ["educator cannot withdraw content", educator, { action: "content.withdraw" }, false],
  ["educator cannot manage Rights Records", educator, { action: "rights.manage" }, false],
  ["educator uploads to the media library", educator, { action: "media.upload" }, true],
  ["editor uploads to the media library", editor, { action: "media.upload" }, true],
  ["administrator cannot upload by role alone", administrator, { action: "media.upload" }, false],
  ["safeguarding lead cannot upload by role alone", safeguardingLead, { action: "media.upload" }, false],
  ["a signed-in person without a staff role cannot upload", learner("me"), { action: "media.upload" }, false],
  [
    "educator cannot read learner records",
    educator,
    { action: "learnerRecord.read", learnerRecord: { ownerId: "a-learner" } },
    false,
  ],

  // Reviewer
  [
    "language reviewer approves or rejects an assigned revision in their variety",
    languageReviewer,
    languageRevision(),
    true,
  ],
  [
    "language reviewer cannot approve an unassigned revision",
    languageReviewer,
    languageRevision({ assignedReviewerIds: ["someone-else"] }),
    false,
  ],
  [
    "language reviewer cannot approve another language variety",
    languageReviewer,
    {
      action: "revision.review",
      revision: {
        authorIds: ["editor"],
        assignedReviewerIds: ["lang-reviewer"],
        reviewType: "language",
        languageVariety: "a-regional-variety",
      },
    },
    false,
  ],
  [
    "language reviewer cannot approve a cultural review",
    languageReviewer,
    {
      action: "revision.review",
      revision: { authorIds: ["editor"], assignedReviewerIds: ["lang-reviewer"], reviewType: "cultural" },
    },
    false,
  ],
  [
    "cultural reviewer approves an assigned cultural review",
    culturalReviewer,
    {
      action: "revision.review",
      revision: { authorIds: ["editor"], assignedReviewerIds: ["cultural-reviewer"], reviewType: "cultural" },
    },
    true,
  ],
  [
    "reviewer cannot approve their own work",
    languageReviewer,
    languageRevision({ authorIds: ["lang-reviewer"] }),
    false,
  ],
  [
    "someone holding editor and reviewer roles cannot approve a revision they edited",
    editorAndReviewer,
    languageRevision({ authorIds: ["editor", "natasha"] }),
    false,
  ],
  [
    "someone holding editor and reviewer roles approves a revision they did not touch",
    editorAndReviewer,
    languageRevision({ authorIds: ["educator"] }),
    true,
  ],

  [
    "reviewer reads a revision they are assigned to review",
    languageReviewer,
    { action: "revision.view", revision: { assignedReviewerIds: ["lang-reviewer"] } },
    true,
  ],
  [
    "reviewer cannot read a revision they are not assigned to",
    languageReviewer,
    { action: "revision.view", revision: { assignedReviewerIds: ["someone-else"] } },
    false,
  ],
  ["reviewer cannot withdraw content", languageReviewer, { action: "content.withdraw" }, false],
  ["reviewer cannot read rights evidence", languageReviewer, { action: "rightsEvidence.read" }, false],
  ["reviewer has a review queue", culturalReviewer, { action: "reviewQueue.view" }, true],
  ["an editor without a reviewer role has no review queue", editor, { action: "reviewQueue.view" }, false],
  [
    "someone still assigned whose reviewer role was revoked cannot read the revision",
    educator,
    { action: "revision.view", revision: { assignedReviewerIds: ["educator"] } },
    false,
  ],

  // Safeguarding lead
  ["safeguarding lead reads report cases", safeguardingLead, { action: "case.read", case: { kind: "report" } }, true],
  [
    "safeguarding lead actions rights concerns",
    safeguardingLead,
    { action: "case.act", case: { kind: "rights_concern" } },
    true,
  ],
  ["safeguarding lead hides content pending review", safeguardingLead, { action: "content.hidePendingReview" }, true],
  ["editor cannot hide content pending a safeguarding review", editor, { action: "content.hidePendingReview" }, false],
  [
    "safeguarding lead cannot read data-request cases",
    safeguardingLead,
    { action: "case.read", case: { kind: "data_request" } },
    false,
  ],
  [
    "safeguarding lead decides an appeal on someone else's decision",
    safeguardingLead,
    { action: "case.decideAppeal", case: { kind: "report", decidedBy: "backup-lead" } },
    true,
  ],
  [
    "safeguarding lead cannot decide the appeal on their own decision",
    safeguardingLead,
    { action: "case.decideAppeal", case: { kind: "report", decidedBy: "safeguarding" } },
    false,
  ],

  // Privacy contact
  [
    "privacy contact reads data-request cases",
    privacyContact,
    { action: "case.read", case: { kind: "data_request" } },
    true,
  ],
  [
    "privacy contact runs exports and deletions",
    privacyContact,
    { action: "learnerData.process", learnerRecord: { ownerId: "a-learner" } },
    true,
  ],
  [
    "privacy contact cannot read report cases",
    privacyContact,
    { action: "case.read", case: { kind: "report" } },
    false,
  ],

  // Learner and anonymous visitors
  [
    "learner reads their own records",
    learner("me"),
    { action: "learnerRecord.read", learnerRecord: { ownerId: "me" } },
    true,
  ],
  [
    "learner exports their own records",
    learner("me"),
    { action: "learnerRecord.export", learnerRecord: { ownerId: "me" } },
    true,
  ],
  [
    "learner cannot read someone else's records",
    learner("me"),
    { action: "learnerRecord.read", learnerRecord: { ownerId: "someone-else" } },
    false,
  ],
  [
    "learner deletes their own account",
    learner("me"),
    { action: "learnerRecord.delete", learnerRecord: { ownerId: "me" } },
    true,
  ],
  [
    "learner cannot delete someone else's records",
    learner("me"),
    { action: "learnerRecord.delete", learnerRecord: { ownerId: "someone-else" } },
    false,
  ],
  ["learner cannot edit content", learner("me"), { action: "content.edit" }, false],
  [
    "anonymous visitor cannot read learner records",
    null,
    { action: "learnerRecord.read", learnerRecord: { ownerId: "me" } },
    false,
  ],
  ["anonymous visitor cannot manage accounts", null, { action: "account.manage" }, false],
];

describe("can()", () => {
  it.each(rows)("%s", (_description, actor, check, expected) => {
    expect(can(actor, check)).toBe(expected);
  });
});
