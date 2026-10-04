import { describe, expect, it } from "vitest";
import type { Segment } from "~/lib/segment-rules";
import { importWebVtt, parseWebVtt, toWebVtt } from "~/lib/webvtt";

const segment = (fields: Partial<Segment> & Pick<Segment, "startMs" | "endMs">): Segment => ({
  id: crypto.randomUUID(),
  speaker: "",
  fijian: "",
  english: "",
  overlapIntended: false,
  draft: false,
  retimed: false,
  ...fields,
});

describe("reading WebVTT", () => {
  it("reads cues with their times, speakers and text, skipping notes, styles and cue settings", () => {
    const vtt = [
      "WEBVTT - Talanoa",
      "",
      "NOTE exported by hand",
      "",
      "STYLE",
      "::cue { color: yellow }",
      "",
      "intro",
      "00:00:01.000 --> 00:00:03.500 align:start line:90%",
      "<v Mere>Bula vinaka,</v>",
      "<i>au</i> &amp; o iko.",
      "",
      "01:04.250 --> 01:06.000",
      "Ni sa moce.",
      "",
    ].join("\n");
    expect(parseWebVtt(vtt)).toEqual({
      ok: true,
      cues: [
        { id: "intro", startMs: 1_000, endMs: 3_500, speaker: "Mere", text: "Bula vinaka,\nau & o iko." },
        { id: "", startMs: 64_250, endMs: 66_000, speaker: "", text: "Ni sa moce." },
      ],
    });
  });

  it("reads Windows line endings and a byte order mark", () => {
    expect(parseWebVtt("﻿WEBVTT\r\n\r\n00:01.000 --> 00:02.000\r\nIo\r\n")).toMatchObject({
      ok: true,
      cues: [{ startMs: 1_000, endMs: 2_000, text: "Io" }],
    });
  });

  it("refuses a file that isn't WebVTT, naming the line that's wrong", () => {
    expect(parseWebVtt("1\n00:00:01,000 --> 00:00:02,000\nSRT")).toEqual({
      ok: false,
      error: "This isn't a WebVTT file: it must start with WEBVTT.",
    });
    expect(parseWebVtt("WEBVTT\n\n00:00:0x.000 --> 00:00:02.000\nOops")).toEqual({
      ok: false,
      error: "Line 3 has a time that can't be read.",
    });
  });
});

describe("writing WebVTT", () => {
  it("writes one language's text, with the Segment IDs as cue IDs and speakers as voices", () => {
    const first = segment({ startMs: 1_000, endMs: 3_500, speaker: "Mere", fijian: "Bula <vinaka>", english: "Hello" });
    const second = segment({ startMs: 3_725_004, endMs: 3_726_000, fijian: "Moce", english: "" });
    expect(toWebVtt([first, second], "fijian")).toBe(
      [
        "WEBVTT",
        "",
        first.id,
        "00:00:01.000 --> 00:00:03.500",
        "<v Mere>Bula &lt;vinaka&gt;",
        "",
        second.id,
        "01:02:05.004 --> 01:02:06.000",
        "Moce",
        "",
      ].join("\n"),
    );
    expect(toWebVtt([first, second], "english")).not.toContain(second.id);
  });

  it("reads back what it writes", () => {
    const original = [segment({ startMs: 500, endMs: 1_500, speaker: "Jone", fijian: "Io, sa vinaka & sa dodonu." })];
    const parsed = parseWebVtt(toWebVtt(original, "fijian"));
    expect(parsed).toMatchObject({
      ok: true,
      cues: [{ id: original[0].id, startMs: 500, endMs: 1_500, speaker: "Jone", text: "Io, sa vinaka & sa dodonu." }],
    });
  });
});

describe("importing WebVTT into a Learning Layer", () => {
  const cues = [
    { id: "", startMs: 0, endMs: 1_000, speaker: "Mere", text: "Bula" },
    { id: "", startMs: 1_000, endMs: 2_000, speaker: "", text: "Vinaka" },
  ];

  it("makes Fijian cues into new Segments, marked as unreviewed drafts", () => {
    const result = importWebVtt(cues, [], "fijian");
    expect(result.matched).toBe(2);
    expect(result.segments).toMatchObject([
      { startMs: 0, endMs: 1_000, speaker: "Mere", fijian: "Bula", english: "", draft: true },
      { startMs: 1_000, endMs: 2_000, fijian: "Vinaka", draft: true },
    ]);
    expect(result.segments[0].id).not.toBe(result.segments[1].id);
  });

  it("fills English translations into the Segments whose ID or times match, marking them drafts", () => {
    const kept = segment({ startMs: 0, endMs: 1_000, fijian: "Bula" });
    const byId = segment({ startMs: 5_000, endMs: 6_000, fijian: "Moce" });
    const untouched = segment({ startMs: 8_000, endMs: 9_000, fijian: "Io", english: "Yes" });
    const result = importWebVtt(
      [
        { id: "", startMs: 0, endMs: 1_000, speaker: "", text: "Hello" },
        { id: byId.id, startMs: 5_100, endMs: 6_100, speaker: "", text: "Goodnight" },
        { id: "", startMs: 20_000, endMs: 21_000, speaker: "", text: "Nowhere" },
      ],
      [kept, byId, untouched],
      "english",
    );
    expect(result.matched).toBe(2);
    expect(result.unmatched).toBe(1);
    expect(result.segments).toEqual([
      { ...kept, english: "Hello", draft: true },
      { ...byId, english: "Goodnight", draft: true },
      untouched,
    ]);
  });
});
