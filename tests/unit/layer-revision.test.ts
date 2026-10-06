import { describe, expect, it } from "vitest";
import type { ExpressionDetails, NewExpression } from "~/lib/annotations";
import { buildLayerRevision, type ExpressionLibrary, type LayerEditorPayload } from "~/lib/layer-revision";
import type { LearningLayerSnapshot } from "~/lib/learning-layer-fields";
import { retokenise } from "~/lib/tokens";

/** Building a Learning Layer's next Revision, with the Expression library in memory. */

const id = () => crypto.randomUUID();

/** An in-memory Expression library: what is there already, and what a save placed. */
function memoryLibrary(existing: Record<string, ExpressionDetails> = {}) {
  const placed: NewExpression[] = [];
  const library: ExpressionLibrary = {
    async place(items) {
      if (items.some((item) => existing[item.id])) return { ok: false, error: "That ID is taken." };
      placed.push(...items);
      return {
        ok: true,
        ids: new Map(items.map((item) => [item.id, item.id])),
        added: items.map((item) => ({ id: item.id, ...item.details })),
        writes: items.map((item) => `insert ${item.id}`),
      };
    },
    async copies(ids, added) {
      return Object.fromEntries(
        ids.flatMap((wanted) => {
          const fresh = added.find((item) => item.id === wanted);
          const details = fresh ? { ...fresh, id: undefined } : existing[wanted];
          if (!details) return [];
          const { id: _, ...rest } = details as ExpressionDetails & { id?: string };
          return [[wanted, rest]];
        }),
      );
    },
  };
  return { library, placed };
}

const segmentId = id();
const tokens = retokenise([], "Ni sa bula vinaka");
const before: LearningLayerSnapshot = {
  title: "Greetings",
  level: "beginner",
  flags: [],
  excerpt: null,
  segments: [
    {
      id: segmentId,
      startMs: 0,
      endMs: 2_000,
      speaker: "Mere",
      fijian: "Ni sa bula vinaka",
      english: "Hello",
      overlapIntended: false,
      draft: false,
      retimed: false,
      tokens,
    },
  ],
  annotations: [],
  notes: [],
  expressions: {},
  activities: [],
};
const base = { snapshot: before, videoDurationMs: 10_000 };

const payload = (change: Partial<LayerEditorPayload> = {}): LayerEditorPayload => ({
  title: "Greetings",
  level: "beginner",
  clip: "whole",
  sourceStart: "",
  sourceEnd: "",
  segments: JSON.stringify(before.segments),
  annotations: "[]",
  notes: "[]",
  newExpressions: "[]",
  activities: "[]",
  ...change,
});

const bula: ExpressionDetails = {
  headword: "bula",
  generalMeaning: "life, health",
  grammarNote: "",
  pronunciation: "mbula",
  literalMeaning: null,
};

const annotationOn = (expressionId: string) => ({
  id: id(),
  segmentId,
  startTokenId: tokens[2].id,
  endTokenId: tokens[2].id,
  expressionId,
  contextualMeaning: "hello",
  grammarNote: "",
  inVocabulary: true,
});

describe("building a Learning Layer's next Revision", () => {
  it("builds the snapshot from the editor's payload, keeping its Segments' tokens", async () => {
    const built = await buildLayerRevision(payload({ title: "Greetings, again" }), base, memoryLibrary().library);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.snapshot.title).toBe("Greetings, again");
    expect(built.snapshot.segments[0].tokens.map((token) => token.id)).toEqual(tokens.map((token) => token.id));
    expect(built.libraryWrites).toEqual([]);
  });

  it("places a new Expression an Annotation uses, keeps a copy, and leaves the writes to the caller", async () => {
    const newId = id();
    const unused = id();
    const { library, placed } = memoryLibrary();
    const built = await buildLayerRevision(
      payload({
        annotations: JSON.stringify([annotationOn(newId)]),
        newExpressions: JSON.stringify([
          { id: newId, ...bula, idiom: false, literalMeaning: "" },
          { id: unused, ...bula, headword: "vinaka", idiom: false, literalMeaning: "" },
        ]),
      }),
      base,
      library,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    // Only the Expression an Annotation uses joins the library.
    expect(placed.map((item) => item.id)).toEqual([newId]);
    expect(built.libraryWrites).toEqual([`insert ${newId}`]);
    expect(built.snapshot.expressions[newId]).toMatchObject({ headword: "bula", generalMeaning: "life, health" });
  });

  it("uses an Expression already in the library", async () => {
    const libraryId = id();
    const built = await buildLayerRevision(
      payload({ annotations: JSON.stringify([annotationOn(libraryId)]) }),
      base,
      memoryLibrary({ [libraryId]: bula }).library,
    );
    expect(built.ok && built.snapshot.expressions[libraryId]?.headword).toBe("bula");
  });

  it("refuses details, Segments or library problems, saying why", async () => {
    const library = memoryLibrary().library;
    const noTitle = await buildLayerRevision(payload({ title: "" }), base, library);
    expect(noTitle).toMatchObject({ ok: false, errors: { title: "Enter a title for the Learning Layer." } });

    const pastTheEnd = await buildLayerRevision(
      payload({ segments: JSON.stringify([{ ...before.segments[0], endMs: 20_000 }]) }),
      base,
      library,
    );
    expect(pastTheEnd.ok).toBe(false);
    expect(!pastTheEnd.ok && pastTheEnd.problems?.length).toBe(1);

    const taken = id();
    const clash = await buildLayerRevision(
      payload({
        annotations: JSON.stringify([annotationOn(taken)]),
        newExpressions: JSON.stringify([{ id: taken, ...bula, idiom: false, literalMeaning: "" }]),
      }),
      base,
      memoryLibrary({ [taken]: bula }).library,
    );
    expect(clash).toEqual({ ok: false, error: "That ID is taken." });
  });

  it("keeps an Annotation whose Expression can't be found flagged, rather than losing it", async () => {
    const missing = id();
    const built = await buildLayerRevision(
      payload({ annotations: JSON.stringify([annotationOn(missing)]) }),
      base,
      memoryLibrary().library,
    );
    // An Annotation pointing nowhere is a problem the editor must fix, not a silent loss.
    expect(built.ok).toBe(false);
    expect(!built.ok && built.annotationProblems?.length).toBe(1);
  });
});
