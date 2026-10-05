import { describe, expect, it } from "vitest";
import type { Annotation } from "~/lib/annotations";
import { annotatedRuns, currentSegment, PLAYBACK_SPEEDS, playWindow, replayStep } from "~/lib/player-rules";
import type { Segment } from "~/lib/segment-rules";
import { retokenise } from "~/lib/tokens";
import { toWebVtt } from "~/lib/webvtt";

const segment = (id: string, startMs: number, endMs: number, fijian = "Bula vinaka", english = "Hello"): Segment => {
  let n = 0;
  return {
    id,
    startMs,
    endMs,
    speaker: "",
    fijian,
    english,
    overlapIntended: false,
    draft: false,
    retimed: false,
    tokens: retokenise([], fijian, () => `${id}-t${++n}`),
  };
};

describe("speeds", () => {
  it("offers normal, three-quarter and half speed", () => {
    expect(PLAYBACK_SPEEDS).toEqual([1, 0.75, 0.5]);
  });
});

describe("the part of the video a Learning Layer plays", () => {
  it("is the whole video, or its Excerpt in video time", () => {
    expect(playWindow(null, 60_000)).toEqual({ startMs: 0, endMs: 60_000 });
    expect(playWindow({ sourceStartMs: 10_000, sourceEndMs: 40_000 }, 60_000)).toEqual({
      startMs: 10_000,
      endMs: 40_000,
    });
  });
});

describe("captions for the native tracks", () => {
  it("are shifted to video time for an Excerpt, so they line up with what plays", () => {
    const vtt = toWebVtt([segment("a", 1_000, 2_500)], "fijian", { offsetMs: 10_000 });
    expect(vtt).toContain("00:00:11.000 --> 00:00:12.500");
  });
});

describe("which Segment is playing", () => {
  const segments = [segment("a", 0, 2_000), segment("b", 2_000, 4_000), segment("c", 5_000, 6_000)];

  it("is the one whose span holds the time, the later one at a boundary, and none in a gap", () => {
    expect(currentSegment(segments, 1_999)?.id).toBe("a");
    expect(currentSegment(segments, 2_000)?.id).toBe("b");
    expect(currentSegment(segments, 4_500)).toBeNull();
  });
});

describe("replaying a Segment", () => {
  const replay = { startMs: 2_000, endMs: 4_000 };

  it("keeps playing inside it, stops at its end once, or starts it again when looping", () => {
    expect(replayStep({ ...replay, loop: false }, 3_000)).toBe("continue");
    expect(replayStep({ ...replay, loop: false }, 4_000)).toBe("stop");
    expect(replayStep({ ...replay, loop: true }, 4_010)).toBe("restart");
  });

  it("ends when the learner moves the video away from it", () => {
    expect(replayStep({ ...replay, loop: true }, 1_000)).toBe("abandon");
    expect(replayStep({ ...replay, loop: true }, 9_000)).toBe("abandon");
  });
});

describe("a Segment's words with their meanings", () => {
  const annotation = (id: string, start: string, end: string): Annotation => ({
    id,
    segmentId: "s",
    startTokenId: start,
    endTokenId: end,
    expressionId: `e-${id}`,
    contextualMeaning: "",
    grammarNote: "",
    inVocabulary: false,
    needsCheck: false,
  });

  it("runs the text as written, grouping an Annotation's words and the spaces between them", () => {
    const words = segment("s", 0, 2_000, "Ni sa bula vinaka, Mere.");
    expect(annotatedRuns(words, [annotation("n1", "s-t3", "s-t4")])).toEqual([
      { text: "Ni sa ", annotationId: null },
      { text: "bula vinaka", annotationId: "n1" },
      { text: ", Mere.", annotationId: null },
    ]);
  });

  it("leaves out Annotations that lost their words, and keeps the first where two overlap", () => {
    const words = segment("s", 0, 2_000, "Ni sa bula");
    expect(
      annotatedRuns(words, [
        annotation("gone", "x", "y"),
        annotation("n1", "s-t1", "s-t2"),
        annotation("n2", "s-t2", "s-t3"),
      ]),
    ).toEqual([
      { text: "Ni sa", annotationId: "n1" },
      { text: " ", annotationId: null },
      { text: "bula", annotationId: "n2" },
    ]);
  });
});
