import { describe, expect, it } from "vitest";
import {
  type LearningLayerSnapshot,
  readLayerDetails,
  withDefaults,
} from "~/lib/learning-layer-fields";

const form = (fields: Partial<Record<"title" | "level" | "clip" | "sourceStart" | "sourceEnd", string>> = {}) => ({
  title: "Greetings at the market",
  level: "beginner",
  clip: "whole",
  sourceStart: "",
  sourceEnd: "",
  ...fields,
});

describe("a Learning Layer's details", () => {
  it("reads the whole video or an Excerpt of it", () => {
    expect(readLayerDetails(form(), 60_000)).toEqual({
      ok: true,
      details: { title: "Greetings at the market", level: "beginner", flags: [], excerpt: null },
    });
    expect(readLayerDetails(form({ clip: "excerpt", sourceStart: "0:10", sourceEnd: "0:40.5" }), 60_000)).toEqual({
      ok: true,
      details: {
        title: "Greetings at the market",
        level: "beginner",
        flags: [],
        excerpt: { sourceStartMs: 10_000, sourceEndMs: 40_500 },
      },
    });
  });

  it("says what is wrong with each field", () => {
    expect(
      readLayerDetails(
        form({ title: " ", level: "expert", clip: "excerpt", sourceStart: "soon", sourceEnd: "2:00" }),
        60_000,
      ),
    ).toEqual({
      ok: false,
      errors: {
        title: "Enter a title for the Learning Layer.",
        level: "Choose a level.",
        sourceStartMs: "Enter the in time, like 1:05.250.",
        sourceEndMs: "The out time is after the video ends.",
      },
    });
    expect(readLayerDetails(form({ clip: "excerpt", sourceStart: "0:30", sourceEnd: "0:20" }), 60_000)).toMatchObject({
      ok: false,
      errors: { sourceEndMs: "The out time must be after the in time." },
    });
  });
});
