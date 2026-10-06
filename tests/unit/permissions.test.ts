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
  ["administrator sees the usage and cost report", administrator, { action: "usage.read" }, true],
  ["an editor does not see the usage and cost report", editor, { action: "usage.read" }, false],
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
  ["editor reads Knowledge Holder Approval evidence", editor, { action: "approvalEvidence.read" }, true],
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
    "editor authors any learning layer",
    editor,
    { action: "learningLayer.author", learningLayer: { assignedEducatorIds: [] } },
    true,
  ],
  [
    "reviewer cannot author a learning layer, even if listed",
    languageReviewer,
    { action: "learningLayer.author", learningLayer: { assignedEducatorIds: ["lang-reviewer"] } },
    false,
  ],
  [
    "educator adds a learning layer to a video they are assigned to",
    educator,
    { action: "learningLayer.create", video: { assignedEducatorIds: ["educator"] } },
    true,
  ],
  [
    "educator cannot add a learning layer to a video they aren't assigned to",
    educator,
    { action: "learningLayer.create", video: { assignedEducatorIds: ["someone-else"] } },
    false,
  ],
  [
    "editor adds a learning layer to any video",
    editor,
    { action: "learningLayer.create", video: { assignedEducatorIds: [] } },
    true,
  ],
  [
    "educator changes an Expression they added",
    educator,
    { action: "expression.edit", expression: { createdBy: "educator", usedByOthers: false } },
    true,
  ],
  [
    "educator cannot change an Expression they added once another's Learning Layer uses it",
    educator,
    { action: "expression.edit", expression: { createdBy: "educator", usedByOthers: true } },
    false,
  ],
  [
    "educator cannot change another's Expression",
    educator,
    { action: "expression.edit", expression: { createdBy: "someone-else", usedByOthers: false } },
    false,
  ],
  [
    "editor changes any Expression",
    editor,
    { action: "expression.edit", expression: { createdBy: "someone-else", usedByOthers: true } },
    true,
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

  // Submissions and Consent Records (docs/phase-1a-defaults.md §4, §11)
  ["editor works the Submission queue", editor, { action: "submission.manage" }, true],
  ["educator does not see Submissions", educator, { action: "submission.manage" }, false],
  ["administrator does not see Submissions by role alone", administrator, { action: "submission.manage" }, false],
  ["privacy contact publishes consent notices", privacyContact, { action: "notice.publish" }, true],
  ["administrator publishes consent notices", administrator, { action: "notice.publish" }, true],
  ["editor cannot change consent notices", editor, { action: "notice.publish" }, false],
  ["privacy contact looks up and withdraws Consent Records", privacyContact, { action: "consent.manage" }, true],
  ["editor cannot look up Consent Records by person", editor, { action: "consent.manage" }, false],
  ["administrator cannot look up Consent Records by role alone", administrator, { action: "consent.manage" }, false],
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

  // The audit log and bulk exports (CMS-05, VCMS-06)
  ["administrator reads the audit log", administrator, { action: "audit.read" }, true],
  ["an editor does not read the audit log", editor, { action: "audit.read" }, false],
  ["a safeguarding lead does not read the audit log", safeguardingLead, { action: "audit.read" }, false],
  ["administrator exports the audit log", administrator, { action: "export.run", kind: "audit" }, true],
  ["an editor does not export the audit log", editor, { action: "export.run", kind: "audit" }, false],
  ["editor exports content", editor, { action: "export.run", kind: "content" }, true],
  ["editor exports Rights Records", editor, { action: "export.run", kind: "rights" }, true],
  ["editor exports approvals", editor, { action: "export.run", kind: "approvals" }, true],
  ["editor exports a Learning Layer", editor, { action: "export.run", kind: "learningLayer" }, true],
  ["an educator does not export a Learning Layer", educator, { action: "export.run", kind: "learningLayer" }, false],
  ["an administrator alone does not export content", administrator, { action: "export.run", kind: "content" }, false],
  ["privacy contact exports contacts", privacyContact, { action: "export.run", kind: "contacts" }, true],
  ["an editor does not export contacts", editor, { action: "export.run", kind: "contacts" }, false],
  ["an administrator does not export contacts", administrator, { action: "export.run", kind: "contacts" }, false],
  ["a learner exports nothing in bulk", learner("me"), { action: "export.run", kind: "content" }, false],

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
    "learner changes their own records",
    learner("me"),
    { action: "learnerRecord.write", learnerRecord: { ownerId: "me" } },
    true,
  ],
  [
    "learner cannot change someone else's records",
    learner("me"),
    { action: "learnerRecord.write", learnerRecord: { ownerId: "someone-else" } },
    false,
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
