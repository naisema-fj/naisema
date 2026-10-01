import { describe, expect, it } from "vitest";
import {
  formatDuration,
  isoDuration,
  parseDuration,
  readEpisodeFields,
  transcriptParagraphs,
} from "~/lib/episode-fields";

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const each of [value].flat()) data.append(name, each);
  }
  return data;
};

const common = {
  episodeAudioAssetId: "audio-1",
  episodeHost: "Mere Vula",
  episodeGuests: "Ratu Joni\n\n  Ana Tuilagi  \n",
  episodeRecordedOn: "2026-09-12",
  episodeDuration: "32:10",
  episodeTranscript: "Mere: Bula vinaka.\n\nRatu Joni: Bula.",
};
const today = new Date("2026-10-01T09:00:00Z");

describe("readEpisodeFields", () => {
  it("reads an audio Episode with its host, guests, date, duration and transcript", () => {
    const result = readEpisodeFields(form(common), today);

    expect(result).toEqual({
      ok: true,
      details: {
        audioAssetId: "audio-1",
        host: "Mere Vula",
        guests: ["Ratu Joni", "Ana Tuilagi"],
        recordedOn: "2026-09-12",
        durationSeconds: 1930,
        transcript: "Mere: Bula vinaka.\n\nRatu Joni: Bula.",
        distribution: [],
      },
    });
  });

  it("can be saved without a transcript, which publishing then needs", () => {
    const result = readEpisodeFields(form({ ...common, episodeTranscript: "  " }), today);

    expect(result).toMatchObject({ ok: true, details: { transcript: "" } });
  });

  it("reads distribution links, skipping empty rows, and needs each to be labelled and secure", () => {
    const good = readEpisodeFields(
      form({
        ...common,
        episodeLinkLabel: ["Spotify", "", ""],
        episodeLinkUrl: ["https://open.spotify.com/episode/1", "", ""],
      }),
      today,
    );
    const bad = readEpisodeFields(
      form({ ...common, episodeLinkLabel: ["", "Apple"], episodeLinkUrl: ["https://example.org", "http://apple.com"] }),
      today,
    );

    expect(good).toMatchObject({
      ok: true,
      details: { distribution: [{ label: "Spotify", url: "https://open.spotify.com/episode/1" }] },
    });
    expect(bad).toMatchObject({ ok: false, errors: { episodeDistribution: expect.any(String) } });
  });

  it("needs the audio, the host, a recording date no later than today and the duration", () => {
    const result = readEpisodeFields(
      form({ episodeRecordedOn: "2026-10-02", episodeDuration: "about half an hour" }),
      today,
    );

    expect(result).toMatchObject({
      ok: false,
      errors: {
        episodeAudioAssetId: expect.any(String),
        episodeHost: expect.any(String),
        episodeRecordedOn: expect.stringContaining("future"),
        episodeDuration: expect.any(String),
      },
    });
  });
});

describe("durations", () => {
  it("reads minutes and seconds, or hours, minutes and seconds", () => {
    expect(parseDuration("32:10")).toBe(1930);
    expect(parseDuration("1:05:00")).toBe(3900);
    expect(parseDuration(" 0:45 ")).toBe(45);
  });

  it("refuses anything else", () => {
    for (const value of ["", "32", "32:60", "1:60:00", "0:00", "a:bc", "1:2:3:4"]) {
      expect(parseDuration(value), value).toBeNull();
    }
  });

  it("are shown in words and in ISO 8601 for machines", () => {
    expect(formatDuration(1930)).toBe("32 min");
    expect(formatDuration(3900)).toBe("1 hr 5 min");
    expect(formatDuration(45)).toBe("1 min");
    expect(isoDuration(1930)).toBe("PT32M10S");
    expect(isoDuration(3900)).toBe("PT1H5M");
  });
});

describe("transcriptParagraphs", () => {
  it("splits on blank lines and picks out who is speaking", () => {
    expect(transcriptParagraphs("Mere: Bula vinaka.\n\n[Music]\nfades\n\n\nRatu Joni: Bula, Mere.")).toEqual([
      { speaker: "Mere", text: "Bula vinaka." },
      { speaker: null, text: "[Music]\nfades" },
      { speaker: "Ratu Joni", text: "Bula, Mere." },
    ]);
  });

  it("doesn't take a sentence with a colon for a speaker", () => {
    expect(transcriptParagraphs("We said this: it matters, and the reasons are long enough.")).toEqual([
      { speaker: null, text: "We said this: it matters, and the reasons are long enough." },
    ]);
  });
});
