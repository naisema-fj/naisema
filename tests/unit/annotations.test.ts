import { describe, expect, it } from "vitest";
import {
  type Annotation,
  annotatedText,
  annotationProblems,
  annotationsToCheck,
  type ContextNote,
  noteProblems,
  readExpressionDetails,
  vocabularyList,
} from "~/lib/annotations";
import type { Segment } from "~/lib/segment-rules";

const segment = (id: string, startMs: number, tokens: [string, string][]): Segment => ({
  id,
  startMs,
  endMs: startMs + 2_000,
  speaker: "",
  fijian: tokens.map(([, text]) => text).join(" "),
  english: "",
  overlapIntended: false,
  draft: false,
  retimed: false,
  tokens: tokens.map(([tokenId, text]) => ({ id: tokenId, text })),
});

const annotation = (fields: Partial<Annotation>): Annotation => ({
  id: crypto.randomUUID(),
  segmentId: "s1",
  startTokenId: "a",
  endTokenId: "a",
  expressionId: "e1",
  contextualMeaning: "Hello (to one person)",
  grammarNote: "",
  inVocabulary: true,
  needsCheck: false,
  ...fields,
});

const segments = [
  segment("s1", 0, [
    ["a", "Ni"],
    ["b", "sa"],
    ["c", "bula"],
  ]),
  segment("s2", 4_000, [
    ["d", "Ni"],
    ["e", "sa"],
    ["f", "moce"],
  ]),
];

describe("what an Annotation covers", () => {
  it("is the words from its start token to its end token, in one Segment", () => {
    expect(annotatedText(segments, annotation({ startTokenId: "a", endTokenId: "c" }))).toBe("Ni sa bula");
    expect(annotatedText(segments, annotation({ startTokenId: "x", endTokenId: "c" }))).toBeNull();
  });
});

describe("hyphenated compounds", () => {
  it("can be annotated whole, or by one part, and read as written", () => {
    const compound = segment("s3", 8_000, [
      ["g", "Au"],
      ["h", "lako"],
      ["i", "ki"],
      ["j", "na"],
      ["k", "vale"],
      ["l", "ni"],
      ["m", "vuli"],
    ]);
    compound.fijian = "Au lako ki na vale-ni-vuli.";
    expect(annotatedText([compound], annotation({ segmentId: "s3", startTokenId: "k", endTokenId: "m" }))).toBe(
      "vale-ni-vuli",
    );
    expect(annotatedText([compound], annotation({ segmentId: "s3", startTokenId: "m", endTokenId: "m" }))).toBe("vuli");
  });
});

describe("Annotations on a word an edit repeats", () => {
  const before = [
    { id: "n", text: "ni" },
    { id: "k", text: "koro" },
  ];
  const after = [
    { id: "new", text: "ni" },
    { id: "n", text: "ni" },
    { id: "k", text: "koro" },
  ];

  it("are flagged to check when their word now appears a different number of times", () => {
    const onNi = annotation({ segmentId: "s1", startTokenId: "n", endTokenId: "n" });
    const onKoro = annotation({ segmentId: "s1", startTokenId: "k", endTokenId: "k" });
    const elsewhere = annotation({ segmentId: "s2", startTokenId: "n", endTokenId: "n" });
    expect(annotationsToCheck([onNi, onKoro, elsewhere], "s1", before, after)).toEqual([onNi.id]);
    expect(annotationsToCheck([onNi], "s1", before, before)).toEqual([]);
  });

  it("are listed to check until the Educator confirms them", () => {
    const flagged = annotation({ needsCheck: true });
    expect(annotationProblems([flagged], segments, new Set(["e1"]))).toEqual([
      {
        annotationId: flagged.id,
        message:
          "One of its words now appears more than once in the Segment. Check it's on the right one, then confirm it.",
        revalidate: true,
      },
    ]);
  });
});

describe("Annotations to revalidate", () => {
  it("flags an Annotation whose words or Segment are gone, without re-pointing it", () => {
    const fine = annotation({ startTokenId: "a", endTokenId: "b" });
    const wordGone = annotation({ startTokenId: "a", endTokenId: "z" });
    const segmentGone = annotation({ segmentId: "s9" });
    const backwards = annotation({ startTokenId: "c", endTokenId: "a" });
    const unknownExpression = annotation({ expressionId: "missing" });
    expect(
      annotationProblems([fine, wordGone, segmentGone, backwards, unknownExpression], segments, new Set(["e1"])),
    ).toEqual([
      {
        annotationId: wordGone.id,
        message: "Its words are no longer in the Segment. Select them again, or remove it.",
        revalidate: true,
      },
      {
        annotationId: segmentGone.id,
        message: "Its Segment was removed. Remove the Annotation.",
        revalidate: true,
      },
      {
        annotationId: backwards.id,
        message: "Its last word comes before its first. Select the words again.",
        revalidate: false,
      },
      { annotationId: unknownExpression.id, message: "Choose the Expression it links to.", revalidate: false },
    ]);
  });
});

describe("cultural and context notes", () => {
  it("need text and attribution, on the Learning Layer or one of its Segments", () => {
    const fine: ContextNote = {
      id: "n1",
      segmentId: null,
      kind: "cultural",
      text: "A sevusevu is offered.",
      attribution: "Ratu Joni",
    };
    const unattributed: ContextNote = { ...fine, id: "n2", attribution: " " };
    const orphan: ContextNote = { ...fine, id: "n3", segmentId: "gone" };
    const empty: ContextNote = { ...fine, id: "n4", text: "" };
    expect(noteProblems([fine, unattributed, orphan, empty], segments)).toEqual([
      { noteId: "n2", message: "Say who the note comes from.", revalidate: false },
      {
        noteId: "n3",
        message: "Its Segment was removed. Remove the note, or move it to the whole Learning Layer.",
        revalidate: true,
      },
      { noteId: "n4", message: "Write the note.", revalidate: false },
    ]);
  });
});

describe("Expressions", () => {
  const base = {
    headword: "ni sa bula",
    generalMeaning: "hello",
    grammarNote: "",
    pronunciation: "nee sah mbula",
    idiom: false,
    literalMeaning: "",
  };

  it("need a word or phrase and its general meaning", () => {
    expect(readExpressionDetails(base)).toEqual({
      ok: true,
      details: {
        headword: "ni sa bula",
        generalMeaning: "hello",
        grammarNote: "",
        pronunciation: "nee sah mbula",
        literalMeaning: null,
      },
    });
    expect(readExpressionDetails({ ...base, headword: " ", generalMeaning: "" })).toEqual({
      ok: false,
      errors: { headword: "Enter the word or phrase.", generalMeaning: "Enter its general meaning." },
    });
  });

  it("explain an idiom beyond its literal translation", () => {
    expect(readExpressionDetails({ ...base, idiom: true, literalMeaning: "" })).toMatchObject({
      ok: false,
      errors: { literalMeaning: "An idiom needs its literal meaning as well as what it means." },
    });
    expect(readExpressionDetails({ ...base, idiom: true, literalMeaning: "hello" })).toMatchObject({
      ok: false,
      errors: { literalMeaning: "Explain what the idiom means beyond its literal translation." },
    });
    expect(readExpressionDetails({ ...base, idiom: true, literalMeaning: "you are alive" })).toMatchObject({
      ok: true,
      details: { literalMeaning: "you are alive" },
    });
  });
});

describe("the vocabulary list", () => {
  it("lists each chosen Expression once, with every moment it is annotated, in order", () => {
    const expressions = {
      e1: { headword: "ni sa bula", generalMeaning: "hello" },
      e2: { headword: "moce", generalMeaning: "goodbye; sleep" },
    };
    const list = vocabularyList(
      segments,
      [
        annotation({ segmentId: "s2", startTokenId: "f", endTokenId: "f", expressionId: "e2" }),
        annotation({ segmentId: "s1", startTokenId: "a", endTokenId: "c", expressionId: "e1" }),
        annotation({ segmentId: "s2", startTokenId: "d", endTokenId: "e", expressionId: "e1" }),
        annotation({ segmentId: "s1", startTokenId: "b", endTokenId: "b", expressionId: "e2", inVocabulary: false }),
        annotation({ segmentId: "s1", startTokenId: "zz", endTokenId: "zz", expressionId: "e2" }),
      ],
      expressions,
    );
    expect(list).toEqual([
      {
        expressionId: "e1",
        headword: "ni sa bula",
        generalMeaning: "hello",
        occurrences: [
          { segmentId: "s1", startMs: 0, text: "Ni sa bula" },
          { segmentId: "s2", startMs: 4_000, text: "Ni sa" },
        ],
      },
      {
        expressionId: "e2",
        headword: "moce",
        generalMeaning: "goodbye; sleep",
        occurrences: [{ segmentId: "s2", startMs: 4_000, text: "moce" }],
      },
    ]);
  });
});
