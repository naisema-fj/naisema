import { describe, expect, it } from "vitest";
import type { Actor } from "~/lib/permissions";
import { type ReviewCore, reviewAbilities } from "~/lib/review.server";

/** What a review page offers someone, from the same rules its actions check. */

const editor: Actor = { userId: "editor", roles: [{ role: "editor" }] };
const otherEditor: Actor = { userId: "other-editor", roles: [{ role: "editor" }] };
const reviewer: Actor = {
  userId: "reviewer",
  roles: [{ role: "reviewer", reviewType: "language", languageVariety: "standard-fijian" }],
};

const review = (change: Partial<ReviewCore> = {}) =>
  ({
    revisionId: "revision-2",
    currentDraftRevisionId: "revision-2",
    submitted: true,
    requirements: [
      { reviewType: "language", languageVariety: "standard-fijian" },
      { reviewType: "cultural", knowledgeHolder: true },
    ],
    authorIds: ["editor"],
    assignments: [{ reviewType: "language", reviewerId: "reviewer" }],
    ...change,
  }) as ReviewCore;

describe("what a review offers someone", () => {
  it("offers submitting only the latest draft not yet submitted, and only to those who may", () => {
    const draft = review({ submitted: false });
    expect(reviewAbilities(editor, draft, true).canSubmit).toBe(true);
    expect(reviewAbilities(editor, draft, false).canSubmit).toBe(false);
    expect(reviewAbilities(editor, review(), true).canSubmit).toBe(false);
    expect(
      reviewAbilities(editor, review({ submitted: false, currentDraftRevisionId: "revision-3" }), true).canSubmit,
    ).toBe(false);
  });

  it("offers an assigned reviewer their Review Type on a submitted latest Revision, and nothing earlier", () => {
    expect(reviewAbilities(reviewer, review(), false).decideTypes).toEqual(["language"]);
    expect(reviewAbilities(reviewer, review({ submitted: false }), false).decideTypes).toEqual([]);
    expect(reviewAbilities(reviewer, review({ currentDraftRevisionId: "revision-3" }), false).decideTypes).toEqual([]);
  });

  it("offers a Knowledge Holder Approval only where one is needed, and never to the Revision's author", () => {
    expect(reviewAbilities(otherEditor, review(), true).canRecordKnowledgeHolder).toBe(true);
    expect(reviewAbilities(editor, review(), true).canRecordKnowledgeHolder).toBe(false);
    expect(
      reviewAbilities(otherEditor, review({ requirements: [{ reviewType: "language" }] }), true)
        .canRecordKnowledgeHolder,
    ).toBe(false);
  });

  it("offers publishing and withdrawing to editors only", () => {
    expect(reviewAbilities(editor, review(), true)).toMatchObject({
      isEditor: true,
      canPublish: true,
      canWithdraw: true,
    });
    expect(reviewAbilities(reviewer, review(), false)).toMatchObject({
      isEditor: false,
      canPublish: false,
      canWithdraw: false,
    });
  });
});
