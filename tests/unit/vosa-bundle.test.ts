import { describe, expect, it } from "vitest";
import { readVosaBundle } from "~/lib/vosa-bundle";

const data = (object: unknown) => `window.FIJIAN_DATA = ${JSON.stringify(object)};\n`;

const file = {
  schema: 1,
  generated: "2026-11-06",
  entries: [
    {
      id: "dc470a78352aa372",
      fijian: " Baca ",
      englishPos: "noun",
      meaning: "Bait put on a fishhook or in a fishing trap.",
      status: "needs review",
      source: { id: "a2056948d246" },
      sources: [{ id: "a2056948d246" }, { id: "peace-corps-baca-bait-1968" }],
      themes: ["fishing-traps"],
      searchKeywords: ["bait"],
    },
    { id: "no-meaning", fijian: "Bai" },
    { fijian: "No id", meaning: "Skipped." },
  ],
  proverbs: [
    {
      id: "founder-qalova-uaua-na-moka",
      fijian: "qalova uaua na moka",
      literal: "Swimming to a stone fish fence while the tide is still high.",
      meaning: "Trying to do something before the right time.",
      status: "reviewed",
      sources: [{ id: "fiji-marinas-geraghty-proverb-2020", page: 115 }],
    },
  ],
  sources: [
    {
      id: "a2056948d246",
      name: "fijian english volavosa.pdf",
      type: "pdf",
      role: "dictionary",
      pages: 366,
      webUrl: "https://apps.naisema.com/dictionary/sources/fijian%20english%20volavosa.pdf",
    },
    { id: "bad url", name: "Skipped: its id has a space" },
    { id: "plain", name: "Plain", webUrl: "javascript:alert(1)" },
  ],
};

describe("readVosaBundle", () => {
  it("reads words and sayings with their cited sources, keeping the rest of each record as details", () => {
    const read = readVosaBundle(data(file));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.skipped).toBe(2);
    expect(read.bundle.generated).toBe("2026-11-06");
    expect(read.bundle.entries).toEqual([
      {
        id: "dc470a78352aa372",
        kind: "word",
        headword: "Baca",
        meaning: "Bait put on a fishhook or in a fishing trap.",
        literalMeaning: null,
        partOfSpeech: "noun",
        themes: ["fishing-traps"],
        sourceIds: ["a2056948d246", "peace-corps-baca-bait-1968"],
        appsStatus: "needs review",
        details: { searchKeywords: ["bait"] },
      },
      expect.objectContaining({
        id: "founder-qalova-uaua-na-moka",
        kind: "saying",
        literalMeaning: "Swimming to a stone fish fence while the tide is still high.",
        appsStatus: "reviewed",
        sourceIds: ["fiji-marinas-geraghty-proverb-2020"],
      }),
    ]);
  });

  it("keeps only https links for sources and skips a source whose id isn't plain", () => {
    const read = readVosaBundle(data(file));
    if (!read.ok) throw new Error(read.error);
    expect(read.bundle.sources.map((source) => [source.id, source.webUrl])).toEqual([
      ["a2056948d246", "https://apps.naisema.com/dictionary/sources/fijian%20english%20volavosa.pdf"],
      ["plain", null],
    ]);
  });

  it("reads the same object as plain JSON", () => {
    expect(readVosaBundle(JSON.stringify(file)).ok).toBe(true);
  });

  it("refuses a file that isn't the Vosa data, or uses another schema", () => {
    expect(readVosaBundle("console.log('hi')")).toEqual({ ok: false, error: expect.stringContaining("data.js") });
    expect(readVosaBundle(data({ entries: "no" })).ok).toBe(false);
    expect(readVosaBundle(data({ ...file, schema: 2 }))).toEqual({
      ok: false,
      error: expect.stringContaining("schema 2"),
    });
  });
});
