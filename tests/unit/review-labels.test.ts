import { describe, expect, it } from "vitest";
import { languageVarietyName, reviewLabels } from "~/lib/review-labels";
import type { RecordedDecision, ReviewProgress } from "~/lib/review-rules";

const decision = (overrides: Partial<RecordedDecision> = {}): RecordedDecision => ({
  id: crypto.randomUUID(),
  reviewType: "language",
  languageVariety: "standard-fijian",
  decision: "approved",
  knowledgeHolder: false,
  reviewerId: "reviewer",
  decidedAt: new Date("2026-10-12T03:00:00Z"),
  ...overrides,
});

const approved = (requirement: ReviewProgress["requirement"], made = decision()): ReviewProgress => ({
  requirement,
  status: "approved",
  decision: made,
});

describe("reviewLabels (PUB-02)", () => {
  it("states each review that actually approved the published revision, with its date", () => {
    const labels = reviewLabels({
      progress: [
        approved({ reviewType: "language", languageVariety: "standard-fijian" }),
        approved(
          { reviewType: "cultural", knowledgeHolder: true },
          decision({ reviewType: "cultural", languageVariety: null, knowledgeHolder: true }),
        ),
        approved({ reviewType: "editorial" }, decision({ reviewType: "editorial", languageVariety: null })),
        approved({ reviewType: "accessibility" }, decision({ reviewType: "accessibility", languageVariety: null })),
      ],
      flags: ["languageInstruction", "sensitiveCultural", "historicalClaims", "disabilityAdvice"],
    });

    expect(labels).toEqual([
      "Language reviewed · Standard Fijian · 12 Oct 2026",
      "Cultural context reviewed with a Knowledge Holder · 12 Oct 2026",
      "Sources and claims reviewed · 12 Oct 2026",
      "Disability advice reviewed · 12 Oct 2026",
    ]);
  });

  it("says when an accessibility review covered a recording's transcript", () => {
    const transcript = approved(
      { reviewType: "accessibility", transcript: true },
      decision({ reviewType: "accessibility", languageVariety: null }),
    );

    expect(reviewLabels({ progress: [transcript], flags: [] })).toEqual([
      "Transcript reviewed for accessibility · 12 Oct 2026",
    ]);
    expect(reviewLabels({ progress: [transcript], flags: ["disabilityAdvice"] })).toEqual([
      "Disability advice and transcript reviewed · 12 Oct 2026",
    ]);
  });

  it("labels opinion and personal experience, which needs no review", () => {
    expect(reviewLabels({ progress: [], flags: ["opinion"] })).toEqual(["Opinion or personal experience"]);
  });

  it("never claims a review that is awaited, rejected or only internal", () => {
    expect(
      reviewLabels({
        progress: [
          { requirement: { reviewType: "language", languageVariety: "standard-fijian" }, status: "awaiting" },
          {
            requirement: { reviewType: "editorial" },
            status: "rejected",
            decision: decision({ reviewType: "editorial", decision: "rejected" }),
          },
          approved({ reviewType: "safeguarding" }, decision({ reviewType: "safeguarding", languageVariety: null })),
        ],
        flags: [],
      }),
    ).toEqual([]);
  });

  it("leaves out a Language Variety the decision didn't record, rather than printing a gap", () => {
    expect(
      reviewLabels({
        progress: [approved({ reviewType: "language" }, decision({ languageVariety: null }))],
        flags: [],
      }),
    ).toEqual(["Language reviewed · 12 Oct 2026"]);
  });

  it("never says verified", () => {
    const labels = reviewLabels({
      progress: [approved({ reviewType: "language", languageVariety: "standard-fijian" })],
      flags: ["opinion"],
    });
    expect(labels.join(" ").toLowerCase()).not.toContain("verified");
  });
});

describe("languageVarietyName", () => {
  it("turns a stored Language Variety into words", () => {
    expect(languageVarietyName("standard-fijian")).toBe("Standard Fijian");
    expect(languageVarietyName("bauan")).toBe("Bauan");
  });
});
