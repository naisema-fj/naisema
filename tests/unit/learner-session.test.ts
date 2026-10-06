import { describe, expect, it } from "vitest";
import { captionsFor } from "~/lib/learner-session";

const HIDDEN = { taught: false, english: false };
const SHOWN = { taught: true, english: false };

describe("the captions a stage shows", () => {
  it("are the stage's own until the learner changes them", () => {
    expect(captionsFor(HIDDEN, undefined, false)).toEqual(HIDDEN);
    expect(captionsFor(HIDDEN, { taught: true, english: false, underAlways: false }, false)).toEqual(SHOWN);
  });

  it("never hide the language taught under the accessibility preference", () => {
    expect(captionsFor(HIDDEN, undefined, true)).toEqual(SHOWN);
  });

  it("don't keep a choice to hide them made before the preference was turned on", () => {
    expect(captionsFor(SHOWN, { taught: false, english: true, underAlways: false }, true)).toEqual({
      taught: true,
      english: true,
    });
  });

  it("keep a choice the learner made with the preference on", () => {
    expect(captionsFor(SHOWN, { taught: false, english: false, underAlways: true }, true)).toEqual(HIDDEN);
  });
});
