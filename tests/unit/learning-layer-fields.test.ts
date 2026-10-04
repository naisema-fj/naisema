import { describe, expect, it } from "vitest";
import {
  type LearningLayerSnapshot,
  learningLayerReviewFields,
  readLayerDetails,
  withDefaults,
} from "~/lib/learning-layer-fields";
import { fingerprintsOf } from "~/lib/review-rules";

const form = (fields: Partial<Record<"title" | "level" | "clip" | "sourceStart" | "sourceEnd", string>> = {}) => ({
  title: "Greetings at the market",
  level: "beginner",
  clip: "whole",
  sourceStart: "",
  sourceEnd: "",
  ...fields,
});

describe("a Learning Layer's details", () => {
  it("reads the whole video or an Excerpt of it", () => {
    expect(readLayerDetails(form(), 60_000)).toEqual({
      ok: true,
      details: { title: "Greetings at the market", level: "beginner", excerpt: null },
    });
    expect(readLayerDetails(form({ clip: "excerpt", sourceStart: "0:10", sourceEnd: "0:40.5" }), 60_000)).toEqual({
      ok: true,
      details: {
        title: "Greetings at the market",
        level: "beginner",
        excerpt: { sourceStartMs: 10_000, sourceEndMs: 40_500 },
      },
    });
  });

  it("says what is wrong with each field", () => {
    expect(
      readLayerDetails(
        form({ title: " ", level: "expert", clip: "excerpt", sourceStart: "soon", sourceEnd: "2:00" }),
        60_000,
      ),
    ).toEqual({
      ok: false,
      errors: {
        title: "Enter a title for the Learning Layer.",
        level: "Choose a level.",
        sourceStartMs: "Enter the in time, like 1:05.250.",
        sourceEndMs: "The out time is after the video ends.",
      },
    });
    expect(readLayerDetails(form({ clip: "excerpt", sourceStart: "0:30", sourceEnd: "0:20" }), 60_000)).toMatchObject({
      ok: false,
      errors: { sourceEndMs: "The out time must be after the in time." },
    });
  });
});

describe("what each review covers", () => {
  const snapshot: LearningLayerSnapshot = {
    title: "Greetings",
    level: "beginner",
    excerpt: null,
    segments: [
      {
        id: "a",
        startMs: 0,
        endMs: 1_000,
        speaker: "Mere",
        fijian: "Bula",
        english: "Hello",
        overlapIntended: false,
        draft: true,
        retimed: false,
        tokens: [{ id: "t1", text: "Bula" }],
      },
    ],
    annotations: [
      {
        id: "n1",
        segmentId: "a",
        startTokenId: "t1",
        endTokenId: "t1",
        expressionId: "e1",
        contextualMeaning: "Hello",
        grammarNote: "",
        inVocabulary: true,
        needsCheck: false,
      },
    ],
    notes: [],
    expressions: {
      e1: {
        headword: "bula",
        generalMeaning: "life; hello",
        grammarNote: "",
        pronunciation: "mbula",
        literalMeaning: null,
      },
    },
  };

  it("keeps language approval when only the timing changes, but not accessibility", async () => {
    const before = await fingerprintsOf(learningLayerReviewFields(snapshot, "standard-fijian"));
    const retimed = { ...snapshot, segments: [{ ...snapshot.segments[0], startMs: 100 }] };
    const after = await fingerprintsOf(learningLayerReviewFields(retimed, "standard-fijian"));
    expect(after.language).toBe(before.language);
    expect(after.accessibility).not.toBe(before.accessibility);
    expect(after.editorial).not.toBe(before.editorial);
  });

  it("counts a change to an Annotation or the Expression it uses for language review", async () => {
    const before = await fingerprintsOf(learningLayerReviewFields(snapshot, "standard-fijian"));
    const meaning = { ...snapshot, annotations: [{ ...snapshot.annotations[0], contextualMeaning: "Hi there" }] };
    const expression = { ...snapshot, expressions: { e1: { ...snapshot.expressions.e1, pronunciation: "bula" } } };
    const vocabularyOnly = { ...snapshot, annotations: [{ ...snapshot.annotations[0], inVocabulary: false }] };
    expect((await fingerprintsOf(learningLayerReviewFields(meaning, "standard-fijian"))).language).not.toBe(
      before.language,
    );
    expect((await fingerprintsOf(learningLayerReviewFields(expression, "standard-fijian"))).language).not.toBe(
      before.language,
    );
    expect((await fingerprintsOf(learningLayerReviewFields(vocabularyOnly, "standard-fijian"))).language).toBe(
      before.language,
    );
  });

  it("fills in what older Revisions lack, tokenising their Segments", () => {
    const old = withDefaults({
      title: "Old",
      level: "beginner",
      excerpt: null,
      segments: [{ ...snapshot.segments[0], tokens: undefined as never, fijian: "Ni sa bula" }],
    });
    expect(old.annotations).toEqual([]);
    expect(old.notes).toEqual([]);
    expect(old.expressions).toEqual({});
    expect(old.segments[0].tokens.map((token) => token.text)).toEqual(["Ni", "sa", "bula"]);
  });

  it("doesn't count marking a draft as reviewed as a change", async () => {
    const before = await fingerprintsOf(learningLayerReviewFields(snapshot, "standard-fijian"));
    const checked = { ...snapshot, segments: [{ ...snapshot.segments[0], draft: false }] };
    expect(await fingerprintsOf(learningLayerReviewFields(checked, "standard-fijian"))).toEqual(before);
  });
});
