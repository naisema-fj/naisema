import { describe, expect, it } from "vitest";
import { retokenise, sameTokens, tokenSpans, tokenTexts } from "~/lib/tokens";

let counter = 0;
const ids = () => `t${++counter}`;

describe("splitting Fijian text into tokens", () => {
  it("finds the words and where they are, leaving out spaces and punctuation", () => {
    expect(tokenSpans("Bula vinaka, Ratu! Sā cava?")).toEqual([
      { text: "Bula", start: 0, end: 4 },
      { text: "vinaka", start: 5, end: 11 },
      { text: "Ratu", start: 13, end: 17 },
      { text: "Sā", start: 19, end: 21 },
      { text: "cava", start: 22, end: 26 },
    ]);
  });

  it("keeps words joined by an apostrophe or hyphen together", () => {
    expect(tokenTexts("vale-ni-bula o'qo")).toEqual(["vale-ni-bula", "o'qo"]);
  });
});

describe("re-tokenising after an edit", () => {
  it("gives every word an ID the first time", () => {
    counter = 0;
    expect(retokenise([], "Bula vinaka", ids)).toEqual([
      { id: "t1", text: "Bula" },
      { id: "t2", text: "vinaka" },
    ]);
  });

  it("keeps the IDs of words that are still there, and gives new words new IDs", () => {
    const before = [
      { id: "a", text: "Ni" },
      { id: "b", text: "sa" },
      { id: "c", text: "bula" },
      { id: "d", text: "vinaka" },
    ];
    counter = 0;
    expect(retokenise(before, "Ni sa bula vakalevu vinaka", ids)).toEqual([
      { id: "a", text: "Ni" },
      { id: "b", text: "sa" },
      { id: "c", text: "bula" },
      { id: "t1", text: "vakalevu" },
      { id: "d", text: "vinaka" },
    ]);
    expect(retokenise(before, "sa vinaka", ids).map((token) => token.id)).toEqual(["b", "d"]);
  });

  it("treats a word whose spelling changed as a new word", () => {
    const before = [
      { id: "a", text: "Bula" },
      { id: "b", text: "vinaka" },
    ];
    counter = 0;
    expect(retokenise(before, "Bula vinakā", ids)).toEqual([
      { id: "a", text: "Bula" },
      { id: "t1", text: "vinakā" },
    ]);
  });

  it("keeps a word's ID when only its capitals change, with the new spelling", () => {
    expect(retokenise([{ id: "a", text: "bula" }], "Bula", ids)).toEqual([{ id: "a", text: "Bula" }]);
  });
});

describe("checking tokens sent from the editor", () => {
  it("accepts tokens that match the text with distinct IDs", () => {
    expect(
      sameTokens(
        [
          { id: "a", text: "Bula" },
          { id: "b", text: "vinaka" },
        ],
        "Bula vinaka.",
      ),
    ).toBe(true);
    expect(sameTokens([{ id: "a", text: "Bula" }], "Bula vinaka")).toBe(false);
    expect(
      sameTokens(
        [
          { id: "a", text: "Bula" },
          { id: "a", text: "vinaka" },
        ],
        "Bula vinaka",
      ),
    ).toBe(false);
  });
});
