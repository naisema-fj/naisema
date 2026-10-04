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
    activities: [
      {
        id: "x1",
        kind: "listen-repeat",
        segmentId: "a",
        prompt: "Listen, then say it aloud.",
        options: [],
        modelResponse: "Bula",
        feedback: "Say the b softly, like mb.",
        pronunciation: "mbula",
        required: true,
        textAlternative: "Read “Bula” and write it out.",
      },
      {
        id: "x2",
        kind: "real-world",
        segmentId: null,
        prompt: "Greet someone in Fijian this week.",
        options: [],
        modelResponse: "",
        feedback: "",
        pronunciation: "",
        required: false,
        textAlternative: "Write a greeting you could send someone.",
      },
    ],
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
    expect(old.activities).toEqual([]);
    expect(old.segments[0].tokens.map((token) => token.text)).toEqual(["Ni", "sa", "bula"]);
  });

  it("doesn't count marking a draft as reviewed as a change", async () => {
    const before = await fingerprintsOf(learningLayerReviewFields(snapshot, "standard-fijian"));
    const checked = { ...snapshot, segments: [{ ...snapshot.segments[0], draft: false }] };
    expect(await fingerprintsOf(learningLayerReviewFields(checked, "standard-fijian"))).toEqual(before);
  });

  it("counts an Activity's answers for language review, but not whether it's required", async () => {
    const fields = async (change: Partial<LearningLayerSnapshot["activities"][number]>) =>
      fingerprintsOf(
        learningLayerReviewFields(
          { ...snapshot, activities: [{ ...snapshot.activities[0], ...change }, snapshot.activities[1]] },
          "standard-fijian",
        ),
      );
    const before = await fingerprintsOf(learningLayerReviewFields(snapshot, "standard-fijian"));
    const answer = await fields({ modelResponse: "Bula vinaka" });
    expect(answer.language).not.toBe(before.language);
    const optional = await fields({ required: false });
    expect(optional.language).toBe(before.language);
    expect(optional.editorial).not.toBe(before.editorial);
    const alternative = await fields({ textAlternative: "Write out “Bula”." });
    expect(alternative.accessibility).not.toBe(before.accessibility);
  });

  it("puts every Activity's words before cultural review, and real-world prompts before safeguarding", async () => {
    const before = await fingerprintsOf(learningLayerReviewFields(snapshot, "standard-fijian"));
    const changed = await fingerprintsOf(
      learningLayerReviewFields(
        { ...snapshot, activities: [snapshot.activities[0], { ...snapshot.activities[1], prompt: "Ask an elder." }] },
        "standard-fijian",
      ),
    );
    expect(changed.cultural).not.toBe(before.cultural);
    expect(changed.safeguarding).not.toBe(before.safeguarding);
    const practice = await fingerprintsOf(
      learningLayerReviewFields(
        {
          ...snapshot,
          activities: [{ ...snapshot.activities[0], feedback: "Said to elders." }, snapshot.activities[1]],
        },
        "standard-fijian",
      ),
    );
    expect(practice.cultural).not.toBe(before.cultural);
    expect(practice.safeguarding).toBe(before.safeguarding);
  });

  it("doesn't count putting the Activities in another order as a change to their words", async () => {
    const before = await fingerprintsOf(learningLayerReviewFields(snapshot, "standard-fijian"));
    const reordered = await fingerprintsOf(
      learningLayerReviewFields({ ...snapshot, activities: [...snapshot.activities].reverse() }, "standard-fijian"),
    );
    expect(reordered.language).toBe(before.language);
    expect(reordered.accessibility).toBe(before.accessibility);
    expect(reordered.editorial).not.toBe(before.editorial);
  });
});
