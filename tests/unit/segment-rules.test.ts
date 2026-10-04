import { describe, expect, it } from "vitest";
import {
  clipDuration,
  formatTimecode,
  nudge,
  parseTimecode,
  readSegments,
  retimeExcerpt,
  type Segment,
  segmentProblems,
} from "~/lib/segment-rules";

const segment = (fields: Partial<Segment> & Pick<Segment, "startMs" | "endMs">): Segment => ({
  id: crypto.randomUUID(),
  speaker: "",
  fijian: "Bula vinaka.",
  english: "Hello.",
  overlapIntended: false,
  draft: false,
  retimed: false,
  tokens: [],
  ...fields,
});

describe("timecodes", () => {
  it("writes milliseconds as minutes, seconds and milliseconds", () => {
    expect(formatTimecode(0)).toBe("0:00.000");
    expect(formatTimecode(61_250)).toBe("1:01.250");
    expect(formatTimecode(3_725_004)).toBe("1:02:05.004");
  });

  it("reads what staff type", () => {
    expect(parseTimecode("1:01.25")).toBe(61_250);
    expect(parseTimecode("0:05")).toBe(5_000);
    expect(parseTimecode("12.5")).toBe(12_500);
    expect(parseTimecode(" 1:02:05.004 ")).toBe(3_725_004);
    expect(parseTimecode("1:75.000")).toBeNull();
    expect(parseTimecode("-1")).toBeNull();
    expect(parseTimecode("soon")).toBeNull();
    expect(parseTimecode("")).toBeNull();
  });

  it("nudges by 100 ms, never below zero or past the clip", () => {
    expect(nudge(1_000, 1, 5_000)).toBe(1_100);
    expect(nudge(50, -1, 5_000)).toBe(0);
    expect(nudge(4_950, 1, 5_000)).toBe(5_000);
  });
});

describe("a Learning Layer's clip", () => {
  it("is the whole video, or the Excerpt between its source in and out times", () => {
    expect(clipDuration(null, 95_000)).toBe(95_000);
    expect(clipDuration({ sourceStartMs: 10_000, sourceEndMs: 40_000 }, 95_000)).toBe(30_000);
  });
});

describe("Segment validation", () => {
  it("accepts ordered Segments inside the clip", () => {
    expect(
      segmentProblems([segment({ startMs: 0, endMs: 2_000 }), segment({ startMs: 2_000, endMs: 4_000 })], 5_000),
    ).toEqual([]);
  });

  it("reports the exact Segment and field", () => {
    const silent = segment({ startMs: 0, endMs: 500, fijian: "  " });
    const backwards = segment({ startMs: 3_000, endMs: 2_000 });
    const tooLate = segment({ startMs: 4_000, endMs: 6_000 });
    expect(segmentProblems([silent, backwards, tooLate], 5_000)).toEqual([
      { segmentId: silent.id, position: 1, field: "fijian", message: "Segment 1 needs its Fijian text." },
      { segmentId: backwards.id, position: 2, field: "endMs", message: "Segment 2 ends before it starts." },
      {
        segmentId: tooLate.id,
        position: 3,
        field: "endMs",
        message: "Segment 3 ends after the clip, which ends at 0:05.000.",
      },
    ]);
  });

  it("says a Segment with no length has no length", () => {
    const empty = segment({ startMs: 1_000, endMs: 1_000 });
    expect(segmentProblems([empty], 5_000)).toEqual([
      {
        segmentId: empty.id,
        position: 1,
        field: "endMs",
        message: "Segment 1 has no length: its end must be after its start.",
      },
    ]);
  });

  it("requires time order", () => {
    const second = segment({ startMs: 1_000, endMs: 1_500 });
    expect(segmentProblems([segment({ startMs: 2_000, endMs: 3_000 }), second], 5_000)).toContainEqual({
      segmentId: second.id,
      position: 2,
      field: "startMs",
      message: "Segment 2 starts before Segment 1. Put Segments in time order.",
    });
  });

  it("allows an overlap only when it is marked intentional", () => {
    const first = segment({ startMs: 0, endMs: 3_000 });
    const overlapping = segment({ startMs: 2_000, endMs: 4_000 });
    expect(segmentProblems([first, overlapping], 5_000)).toEqual([
      {
        segmentId: overlapping.id,
        position: 2,
        field: "startMs",
        message: "Segment 2 overlaps Segment 1. Mark the overlap as intentional, or change the times.",
      },
    ]);
    expect(segmentProblems([first, { ...overlapping, overlapIntended: true }], 5_000)).toEqual([]);
  });

  it("checks an overlap against every earlier Segment, not only the one above", () => {
    const long = segment({ startMs: 0, endMs: 4_000 });
    const inside = segment({ startMs: 1_000, endMs: 2_000, overlapIntended: true });
    const after = segment({ startMs: 3_000, endMs: 4_500 });
    expect(segmentProblems([long, inside, after], 5_000).map((problem) => problem.segmentId)).toEqual([after.id]);
  });
});

describe("retiming an Excerpt", () => {
  it("keeps each Segment on the same moment of the source and flags those that no longer fit", () => {
    const early = segment({ startMs: 0, endMs: 1_000 });
    const middle = segment({ startMs: 5_000, endMs: 6_000 });
    const late = segment({ startMs: 9_000, endMs: 10_000 });

    const retimed = retimeExcerpt(
      [early, middle, late],
      { sourceStartMs: 10_000, sourceEndMs: 20_000 },
      { sourceStartMs: 12_000, sourceEndMs: 19_500 },
      60_000,
    );

    expect(retimed.map(({ startMs, endMs, retimed: flagged }) => ({ startMs, endMs, flagged }))).toEqual([
      { startMs: -2_000, endMs: -1_000, flagged: true },
      { startMs: 3_000, endMs: 4_000, flagged: false },
      { startMs: 7_000, endMs: 8_000, flagged: true },
    ]);
  });

  it("treats the whole video as an Excerpt from its start", () => {
    const retimed = retimeExcerpt(
      [segment({ startMs: 15_000, endMs: 16_000 })],
      null,
      { sourceStartMs: 10_000, sourceEndMs: 20_000 },
      60_000,
    );
    expect(retimed[0]).toMatchObject({ startMs: 5_000, endMs: 6_000, retimed: false });
  });
});

describe("reading Segments sent by the editor", () => {
  it("keeps the IDs it was given and gives new Segments one", () => {
    const id = crypto.randomUUID();
    const result = readSegments(
      JSON.stringify([
        { id, startMs: 0, endMs: 1_000, speaker: "Mere", fijian: "Bula", english: "Hello" },
        { startMs: 1_000, endMs: 2_000, fijian: "Vinaka", english: "", draft: true },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.segments[0]).toEqual({
      id,
      startMs: 0,
      endMs: 1_000,
      speaker: "Mere",
      fijian: "Bula",
      english: "Hello",
      overlapIntended: false,
      draft: false,
      retimed: false,
      tokens: [{ id: expect.any(String), text: "Bula" }],
    });
    expect(result.segments[1].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.segments[1].draft).toBe(true);
  });

  it("closes up blank lines in text, which a WebVTT cue can't hold", () => {
    const result = readSegments(
      JSON.stringify([{ startMs: 0, endMs: 1, fijian: " Bula.\n\n\nVinaka. ", english: "" }]),
    );
    expect(result.ok && result.segments[0].fijian).toBe("Bula.\nVinaka.");
  });

  it("keeps the token IDs sent when they match the text, and re-tokenises against the old ones when not", () => {
    const tokens = [
      { id: "a", text: "Bula" },
      { id: "b", text: "vinaka" },
    ];
    const id = crypto.randomUUID();
    const sent = readSegments(JSON.stringify([{ id, startMs: 0, endMs: 1, fijian: "Bula vinaka", tokens }]));
    expect(sent.ok && sent.segments[0].tokens).toEqual(tokens);
    const edited = readSegments(
      JSON.stringify([{ id, startMs: 0, endMs: 1, fijian: "Bula vinaka vakalevu", tokens }]),
      new Map([[id, tokens]]),
    );
    expect(edited.ok && edited.segments[0].tokens.map((token) => token.id).slice(0, 2)).toEqual(["a", "b"]);
  });

  it("refuses repeated IDs and anything that isn't a list of Segments", () => {
    const id = crypto.randomUUID();
    const twice = { id, startMs: 0, endMs: 1, fijian: "a" };
    expect(readSegments(JSON.stringify([twice, twice])).ok).toBe(false);
    expect(readSegments("not json").ok).toBe(false);
    expect(readSegments(JSON.stringify({})).ok).toBe(false);
    expect(readSegments(JSON.stringify([{ startMs: "soon", endMs: 1 }])).ok).toBe(false);
  });
});
