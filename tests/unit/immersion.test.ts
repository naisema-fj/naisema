import { describe, expect, it } from "vitest";
import type { Activity, ActivityKind } from "~/lib/activities";
import {
  EMPTY_PROGRESS,
  IMMERSION_STAGES,
  learnerView,
  progressSummary,
  readStage,
  recordAnswer,
  recordRealWorld,
  recordVisit,
  type StageId,
  stageNeighbours,
} from "~/lib/immersion";
import type { LearningLayerSnapshot } from "~/lib/learning-layer-fields";
import type { Segment } from "~/lib/segment-rules";
import { retokenise } from "~/lib/tokens";

describe("the immersion route", () => {
  it("has eight stages, in the order a learner is guided through them", () => {
    expect(IMMERSION_STAGES.map((stage) => stage.id)).toEqual([
      "watch",
      "captions",
      "words",
      "support",
      "listen-again",
      "practise",
      "respond",
      "use-it",
    ]);
  });

  it("starts at watching naturally, and any stage can be opened directly", () => {
    expect(readStage(null)).toBe("watch");
    expect(readStage("")).toBe("watch");
    expect(readStage("nonsense")).toBe("watch");
    expect(readStage("respond")).toBe("respond");
  });

  it("names the stages before and after, with none past either end", () => {
    expect(stageNeighbours("watch")).toEqual({ previous: null, next: "captions" });
    expect(stageNeighbours("support")).toEqual({ previous: "words", next: "listen-again" });
    expect(stageNeighbours("use-it")).toEqual({ previous: "respond", next: null });
  });
});

const segment = (id: string, english: string): Segment => ({
  id,
  startMs: 0,
  endMs: 2_000,
  speaker: "",
  fijian: "Bula vinaka",
  english,
  overlapIntended: false,
  draft: false,
  retimed: false,
  tokens: retokenise([], "Bula vinaka", () => crypto.randomUUID()),
});

const activity = (id: string, kind: ActivityKind, required = true): Activity => ({
  id,
  kind,
  segmentId: null,
  prompt: `Prompt ${id}`,
  options: [],
  modelResponse: "",
  feedback: "Feedback",
  pronunciation: "",
  required: kind !== "real-world" && required,
  textAlternative: "Read it.",
});

const first = segment("s1", "Hello.");
const snapshot: LearningLayerSnapshot = {
  title: "Greetings",
  level: "beginner",
  flags: [],
  excerpt: null,
  segments: [first, segment("s2", "I come from Suva.")],
  annotations: [
    {
      id: "a1",
      segmentId: "s1",
      startTokenId: first.tokens[0].id,
      endTokenId: first.tokens[1].id,
      expressionId: "e1",
      contextualMeaning: "Hello, to a friend",
      grammarNote: "A greeting",
      inVocabulary: true,
      needsCheck: false,
    },
  ],
  notes: [{ id: "n1", segmentId: null, kind: "cultural", text: "Greet elders first.", attribution: "Mere" }],
  expressions: {
    e1: { headword: "bula vinaka", generalMeaning: "hello", grammarNote: "", pronunciation: "", literalMeaning: null },
  },
  activities: [
    activity("respond-1", "comprehension"),
    activity("practise-1", "listen-repeat"),
    activity("use-1", "real-world"),
    activity("practise-2", "discrimination", false),
    activity("respond-2", "next-line"),
  ],
};

/** Every English string in the snapshot, to look for in what a stage sends. */
const ENGLISH = ["Hello.", "I come from Suva.", "Hello, to a friend", "A greeting", "hello", "Greet elders first."];

describe("what each stage puts on the page", () => {
  it("leaves English off the page entirely while listening without it, not merely hidden", () => {
    for (const stage of ["watch", "captions", "listen-again"] as const) {
      const view = learnerView(snapshot, stage);
      const sent = JSON.stringify(view);
      for (const english of ENGLISH) expect(sent, `${stage}: ${english}`).not.toContain(english);
      expect(view.englishTrack, stage).toBe(false);
      // The Fijian is all still there.
      expect(view.segments.map((line) => line.fijian)).toEqual(["Bula vinaka", "Bula vinaka"]);
    }
  });

  it("explores words with their meanings but without the lines' English", () => {
    const view = learnerView(snapshot, "words");
    expect(view.segments.map((line) => line.english)).toEqual(["", ""]);
    expect(view.englishTrack).toBe(false);
    expect(view.annotations.map((annotation) => annotation.contextualMeaning)).toEqual(["Hello, to a friend"]);
    expect(Object.keys(view.expressions)).toEqual(["e1"]);
    expect(view.notes).toEqual([]);
  });

  it("gives English and context notes from the support stage on", () => {
    const view = learnerView(snapshot, "support");
    expect(view.segments.map((line) => line.english)).toEqual(["Hello.", "I come from Suva."]);
    expect(view.englishTrack).toBe(true);
    expect(view.notes.map((note) => note.text)).toEqual(["Greet elders first."]);
    expect(learnerView(snapshot, "respond").segments[1].english).toBe("I come from Suva.");
  });

  it("turns captions off for the listening stages, Fijian on elsewhere, and English on only for support", () => {
    const captions = Object.fromEntries(IMMERSION_STAGES.map(({ id }) => [id, learnerView(snapshot, id).captions]));
    expect(captions).toEqual({
      watch: { taught: false, english: false },
      captions: { taught: true, english: false },
      words: { taught: true, english: false },
      support: { taught: true, english: true },
      "listen-again": { taught: false, english: false },
      practise: { taught: true, english: false },
      respond: { taught: true, english: false },
      "use-it": { taught: true, english: false },
    });
  });

  it("hides captions and the transcript only in the listening stages, which can reveal them", () => {
    const hidden = IMMERSION_STAGES.filter(({ id }) => learnerView(snapshot, id).listening).map(({ id }) => id);
    expect(hidden).toEqual(["watch", "listen-again"]);
  });

  it("offers each Activity in its stage, in the Educator's order: practise, respond, then use it with someone", () => {
    const kinds = (stage: StageId) => learnerView(snapshot, stage).activities.map((item) => item.id);
    expect(kinds("practise")).toEqual(["practise-1", "practise-2"]);
    expect(kinds("respond")).toEqual(["respond-1", "respond-2"]);
    expect(kinds("use-it")).toEqual(["use-1"]);
    for (const stage of ["watch", "captions", "words", "support", "listen-again"] as const) {
      expect(kinds(stage), stage).toEqual([]);
    }
  });

  it("names every required Activity and its stage on every stage, so progress can be shown anywhere", () => {
    expect(learnerView(snapshot, "watch").required).toEqual([
      { id: "respond-1", kind: "comprehension", stage: "respond" },
      { id: "practise-1", kind: "listen-repeat", stage: "practise" },
      { id: "respond-2", kind: "next-line", stage: "respond" },
    ]);
  });
});

describe("a learner's progress", () => {
  const { required } = learnerView(snapshot, "watch");

  it("completes once every required Activity is answered and its feedback seen", () => {
    let progress = recordAnswer(EMPTY_PROGRESS, "respond-1", true);
    progress = recordAnswer(progress, "practise-1", null);
    expect(progressSummary(required, progress).completion).toEqual({ required: 3, done: 2, complete: false });
    progress = recordAnswer(progress, "respond-2", false);
    expect(progressSummary(required, progress).completion).toEqual({ required: 3, done: 3, complete: true });
  });

  it("is never completed by watching, visiting every stage, or optional and real-world Activities", () => {
    let progress = EMPTY_PROGRESS;
    for (const { id } of IMMERSION_STAGES) progress = recordVisit(progress, id);
    progress = recordAnswer(progress, "practise-2", true);
    progress = recordRealWorld(progress, "use-1", "tried");
    expect(progressSummary(required, progress).completion).toEqual({ required: 3, done: 0, complete: false });
    expect(progress.visited).toEqual(IMMERSION_STAGES.map(({ id }) => id));
  });

  it("keeps a completion through retries, and counts the latest answer for correctness", () => {
    let progress = recordAnswer(EMPTY_PROGRESS, "respond-1", false);
    progress = recordAnswer(progress, "respond-1", true);
    expect(progress.activities["respond-1"]).toEqual({ attempted: true, feedbackViewed: true, correct: true });
    progress = recordAnswer(progress, "respond-1", false);
    expect(progressSummary(required, progress).completion.done).toBe(1);
    expect(progressSummary(required, progress).answers).toEqual({ checked: 1, right: 0 });
  });

  it("keeps correctness, practice and real-world use as separate states", () => {
    let progress = recordAnswer(EMPTY_PROGRESS, "respond-1", true);
    progress = recordAnswer(progress, "practise-1", null);
    progress = recordAnswer(progress, "practise-2", false);
    progress = recordRealWorld(progress, "use-1", "later");
    expect(progressSummary(required, progress)).toEqual({
      completion: { required: 3, done: 2, complete: false },
      // Saying a line aloud has no right answer, so only checked answers count.
      answers: { checked: 2, right: 1 },
      practised: 3,
      realWorld: { "use-1": "later" },
    });
  });
});
