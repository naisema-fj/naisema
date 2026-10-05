import { describe, expect, it } from "vitest";
import type { Activity } from "~/lib/activities";
import {
  layerFlags,
  layerReadinessProblems,
  REVIEW_LINK_DAYS,
  reviewLinkExpiry,
  reviewLinkState,
} from "~/lib/layer-review-rules";
import { type LearningLayerSnapshot, withDefaults } from "~/lib/learning-layer-fields";
import { requiredReviews } from "~/lib/review-rules";
import type { Segment } from "~/lib/segment-rules";

const segment = (change: Partial<Segment> = {}): Segment => ({
  id: "s1",
  startMs: 0,
  endMs: 2_000,
  speaker: "",
  fijian: "Bula vinaka",
  english: "Hello",
  overlapIntended: false,
  draft: false,
  retimed: false,
  tokens: [
    { id: "t1", text: "Bula" },
    { id: "t2", text: "vinaka" },
  ],
  ...change,
});

const activity = (change: Partial<Activity> = {}): Activity => ({
  id: "a1",
  kind: "comprehension",
  segmentId: null,
  prompt: "Who is greeted?",
  options: [
    { id: "o1", text: "A friend", correct: true },
    { id: "o2", text: "A stranger", correct: false },
  ],
  modelResponse: "",
  feedback: "A friend.",
  pronunciation: "",
  required: true,
  textAlternative: "Read the transcript.",
  ...change,
});

const ready = (change: Partial<LearningLayerSnapshot> = {}): LearningLayerSnapshot =>
  withDefaults({ title: "Greetings", level: "beginner", segments: [segment()], activities: [activity()], ...change });

describe("what a Learning Layer needs reviewed", () => {
  it("always needs language review in its Variety, and a Knowledge Holder's approval when flagged", () => {
    expect(requiredReviews(layerFlags(ready()), "standard-fijian")).toEqual([
      { reviewType: "language", languageVariety: "standard-fijian" },
    ]);
    expect(requiredReviews(layerFlags(ready({ flags: ["sensitiveCultural"] })), "standard-fijian")).toEqual([
      { reviewType: "language", languageVariety: "standard-fijian" },
      { reviewType: "cultural", knowledgeHolder: true },
    ]);
  });
});

describe("whether a Learning Layer is ready for learners", () => {
  it("is ready with checked Segments and a required Activity", () => {
    expect(layerReadinessProblems(ready())).toEqual([]);
  });

  it("needs Segments, and a required Activity, since watching never completes it", () => {
    expect(layerReadinessProblems(ready({ segments: [], activities: [] }))).toEqual([
      "It has no Segments yet.",
      "No Activity is required, so learners can't complete this Learning Layer.",
    ]);
    expect(
      layerReadinessProblems(ready({ activities: [activity({ kind: "real-world", options: [], required: true })] })),
    ).toContain("No Activity is required, so learners can't complete this Learning Layer.");
  });

  it("needs unreviewed drafts and retimed Segments checked", () => {
    expect(
      layerReadinessProblems(
        ready({
          segments: [
            segment({ draft: true }),
            segment({ id: "s2", startMs: 2_000, endMs: 3_000, draft: true, retimed: true }),
          ],
        }),
      ),
    ).toEqual([
      "2 Segments are unreviewed drafts. Check their text in the editor.",
      "1 Segment was retimed. Check its times in the editor.",
    ]);
  });

  it("needs Annotations, notes and Activities that lost their place fixed", () => {
    const lost = ready({
      annotations: [
        {
          id: "n1",
          segmentId: "s1",
          startTokenId: "gone",
          endTokenId: "gone",
          expressionId: "e1",
          contextualMeaning: "Hello",
          grammarNote: "",
          inVocabulary: false,
          needsCheck: false,
        },
      ],
      notes: [{ id: "c1", segmentId: "removed", kind: "cultural", text: "Said warmly.", attribution: "Mere" }],
      activities: [activity(), activity({ id: "a2", segmentId: "removed", required: false })],
      expressions: {
        e1: { headword: "bula", generalMeaning: "hello", grammarNote: "", pronunciation: "", literalMeaning: null },
      },
    });
    expect(layerReadinessProblems(lost)).toEqual([
      "2 Annotations or notes need checking in the editor.",
      "1 Activity needs linking to a Segment again.",
    ]);
  });
});

describe("Review Links", () => {
  const now = new Date("2026-10-04T00:00:00Z");

  it("last 14 days", () => {
    expect(REVIEW_LINK_DAYS).toBe(14);
    expect(reviewLinkExpiry(now)).toEqual(new Date("2026-10-18T00:00:00Z"));
  });

  it("work until they expire or are revoked", () => {
    const expiresAt = reviewLinkExpiry(now);
    expect(reviewLinkState({ expiresAt, revokedAt: null }, now)).toBe("active");
    expect(reviewLinkState({ expiresAt, revokedAt: null }, expiresAt)).toBe("expired");
    expect(reviewLinkState({ expiresAt, revokedAt: now }, now)).toBe("revoked");
  });
});
