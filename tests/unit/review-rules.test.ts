import { describe, expect, it } from "vitest";
import { EMPTY_ARTICLE_BODY } from "~/lib/article-body";
import { type ArticleSnapshot, articleReviewFields } from "~/lib/article-fields";
import {
  approvalsToCarryForward,
  fingerprint,
  type RecordedDecision,
  requiredReviews,
  requiredReviewsSince,
  reviewProgress,
  revisionState,
} from "~/lib/review-rules";

describe("requiredReviews", () => {
  it("maps each Content Flag to the review it needs (docs/phase-1a-defaults.md §3)", () => {
    expect(requiredReviews(["languageInstruction"], "standard-fijian")).toEqual([
      { reviewType: "language", languageVariety: "standard-fijian" },
    ]);
    expect(requiredReviews(["sensitiveCultural"], null)).toEqual([{ reviewType: "cultural", knowledgeHolder: true }]);
    expect(requiredReviews(["identifiableChildren"], null)).toEqual([{ reviewType: "safeguarding" }]);
    expect(requiredReviews(["disabilityAdvice"], null)).toEqual([{ reviewType: "accessibility" }]);
    expect(requiredReviews(["historicalClaims"], null)).toEqual([{ reviewType: "editorial" }]);
  });

  it("needs no review for opinion, or when no flag is set", () => {
    expect(requiredReviews(["opinion"], null)).toEqual([]);
    expect(requiredReviews([], null)).toEqual([]);
  });

  it("needs an accessibility review of an Episode's transcript, whatever the flags (A11Y-03)", () => {
    expect(requiredReviews([], null, { episode: true })).toEqual([{ reviewType: "accessibility", transcript: true }]);
    expect(requiredReviews(["disabilityAdvice", "historicalClaims"], null, { episode: true })).toEqual([
      { reviewType: "editorial" },
      { reviewType: "accessibility", transcript: true },
    ]);
    expect(
      requiredReviewsSince(
        { flags: [], languageVariety: null, episode: true },
        {
          flags: [],
          languageVariety: null,
          episode: true,
          number: 1,
        },
      ),
    ).toEqual([{ reviewType: "accessibility", transcript: true }]);
  });

  it("lists each needed review once, in a fixed order", () => {
    expect(requiredReviews(["historicalClaims", "languageInstruction", "opinion"], "standard-fijian")).toEqual([
      { reviewType: "language", languageVariety: "standard-fijian" },
      { reviewType: "editorial" },
    ]);
  });
});

describe("requiredReviewsSince", () => {
  it("is the revision's own requirements when nothing earlier was submitted", () => {
    expect(requiredReviewsSince({ flags: ["historicalClaims"], languageVariety: null }, null)).toEqual([
      { reviewType: "editorial" },
    ]);
  });

  it("keeps a removed flag's review required until a revision without it has been submitted", () => {
    const lastSubmitted = {
      number: 3,
      flags: ["languageInstruction", "sensitiveCultural"],
      languageVariety: "bauan",
    } as const;

    expect(requiredReviewsSince({ flags: ["historicalClaims"], languageVariety: null }, lastSubmitted)).toEqual([
      { reviewType: "language", languageVariety: "bauan", flagRemovedAfter: 3 },
      { reviewType: "cultural", knowledgeHolder: true, flagRemovedAfter: 3 },
      { reviewType: "editorial" },
    ]);
  });

  it("adds nothing for flags the revision still has", () => {
    const lastSubmitted = { number: 2, flags: ["languageInstruction"], languageVariety: "standard-fijian" } as const;

    expect(
      requiredReviewsSince({ flags: ["languageInstruction"], languageVariety: "standard-fijian" }, lastSubmitted),
    ).toEqual([{ reviewType: "language", languageVariety: "standard-fijian" }]);
  });
});

const decision = (overrides: Partial<RecordedDecision>): RecordedDecision => ({
  id: crypto.randomUUID(),
  reviewType: "language",
  languageVariety: "standard-fijian",
  decision: "approved",
  knowledgeHolder: false,
  reviewerId: "reviewer",
  decidedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

describe("reviewProgress", () => {
  const language = { reviewType: "language", languageVariety: "standard-fijian" } as const;

  it("is awaiting until a matching decision exists", () => {
    expect(reviewProgress([language], [])).toEqual([{ requirement: language, status: "awaiting" }]);
  });

  it("only counts a language approval for the stated Language Variety", () => {
    const other = decision({ languageVariety: "bauan" });
    expect(reviewProgress([language], [other])[0].status).toBe("awaiting");
  });

  it("uses the latest decision for each requirement", () => {
    const rejected = decision({ decision: "rejected", decidedAt: new Date("2026-10-01T00:00:00Z") });
    const approved = decision({ decidedAt: new Date("2026-10-02T00:00:00Z") });

    expect(reviewProgress([language], [approved, rejected])).toEqual([
      { requirement: language, status: "approved", decision: approved },
    ]);
    expect(reviewProgress([language], [rejected])[0].status).toBe("rejected");
  });

  it("needs a Knowledge Holder Approval where one is required, not any cultural approval", () => {
    const requirement = { reviewType: "cultural", knowledgeHolder: true } as const;
    const cultural = decision({ reviewType: "cultural", languageVariety: null });
    const knowledgeHolder = decision({ reviewType: "cultural", languageVariety: null, knowledgeHolder: true });

    expect(reviewProgress([requirement], [cultural])[0].status).toBe("awaiting");
    expect(reviewProgress([requirement], [knowledgeHolder])[0].status).toBe("approved");
  });
});

describe("revisionState", () => {
  it("follows draft → submitted → approved → superseded", () => {
    expect(revisionState({ submitted: false, allApproved: false, superseded: false })).toBe("draft");
    expect(revisionState({ submitted: true, allApproved: false, superseded: false })).toBe("submitted");
    expect(revisionState({ submitted: true, allApproved: true, superseded: false })).toBe("approved");
    expect(revisionState({ submitted: true, allApproved: true, superseded: true })).toBe("superseded");
    expect(revisionState({ submitted: false, allApproved: true, superseded: false })).toBe("draft");
  });
});

const snapshot = (overrides: Partial<ArticleSnapshot> = {}): ArticleSnapshot => ({
  title: "Meke",
  summary: "Steps",
  credit: "Words by Sera",
  topicIds: ["a", "b"],
  body: EMPTY_ARTICLE_BODY,
  sources: "",
  flags: ["languageInstruction"],
  languageVariety: "standard-fijian",
  ...overrides,
});

async function fingerprints(value: ArticleSnapshot) {
  const fields = articleReviewFields(value);
  const entries = await Promise.all(
    Object.entries(fields).map(async ([type, covered]) => [type, await fingerprint(covered)]),
  );
  return Object.fromEntries(entries) as Record<string, string>;
}

describe("fingerprints over the fields each Review Type covers", () => {
  it("are stable for the same content, whatever the topic order", async () => {
    expect(await fingerprints(snapshot())).toEqual(await fingerprints(snapshot({ topicIds: ["b", "a"] })));
  });

  it("change only for the Review Types whose fields changed", async () => {
    const before = await fingerprints(snapshot());
    const creditChanged = await fingerprints(snapshot({ credit: "Words by Mere" }));
    const varietyChanged = await fingerprints(snapshot({ languageVariety: "bauan" }));
    const flagsChanged = await fingerprints(snapshot({ flags: ["languageInstruction", "opinion"] }));

    const changed = (after: Record<string, string>) =>
      Object.keys(before)
        .filter((type) => before[type] !== after[type])
        .sort();
    expect(changed(creditChanged)).toEqual(["cultural", "editorial"]);
    expect(changed(varietyChanged)).toEqual(["language"]);
    expect(changed(flagsChanged)).toEqual([]);
  });
});

describe("approvalsToCarryForward", () => {
  const base = { language: "L1", cultural: "C1", editorial: "E1", accessibility: "A1", safeguarding: "S1" };

  it("carries each current approval whose Review Type's fingerprint is unchanged", () => {
    const language = decision({});
    const editorial = decision({ reviewType: "editorial", languageVariety: null });

    const carried = approvalsToCarryForward({
      approvals: [language, editorial],
      baseFingerprints: base,
      newFingerprints: { ...base, editorial: "E2" },
      newAuthorIds: ["editor"],
    });

    expect(carried).toEqual([language]);
  });

  it("carries only the latest decision for a Review Type, and only if it was an approval", () => {
    const approved = decision({ decidedAt: new Date("2026-10-01T00:00:00Z") });
    const rejected = decision({ decision: "rejected", decidedAt: new Date("2026-10-02T00:00:00Z") });

    expect(
      approvalsToCarryForward({
        approvals: [approved, rejected],
        baseFingerprints: base,
        newFingerprints: base,
        newAuthorIds: [],
      }),
    ).toEqual([]);
  });

  it("never carries an approval to a revision its own reviewer edited", () => {
    const approval = decision({ reviewerId: "reviewer" });

    expect(
      approvalsToCarryForward({
        approvals: [approval],
        baseFingerprints: base,
        newFingerprints: base,
        newAuthorIds: ["reviewer"],
      }),
    ).toEqual([]);
  });

  it("carries nothing when a fingerprint is missing on either side", () => {
    expect(
      approvalsToCarryForward({
        approvals: [decision({})],
        baseFingerprints: {},
        newFingerprints: base,
        newAuthorIds: [],
      }),
    ).toEqual([]);
  });
});
