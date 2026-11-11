import { describe, expect, it } from "vitest";
import { reviewLabels } from "~/lib/content-rules";
import { ALL_LABEL_MEANINGS, meaningsOfLabels } from "~/lib/review-label-help";

describe("the help beside Review Labels", () => {
  it("explains only the labels an item shows, once each, in the order shown", () => {
    const names = meaningsOfLabels(["Language reviewed · Standard Fijian · 1 Oct 2026", "Opinion"]).map((m) => m.name);
    expect(names).toEqual(["Language reviewed", "Opinion"]);
    expect(meaningsOfLabels([])).toEqual([]);
    expect(meaningsOfLabels(["Something unknown"])).toEqual([]);
  });

  it("has a meaning for every label the site can generate", () => {
    const generated = reviewLabels({
      flags: ["opinion"],
      approvals: [
        { type: "language", createdAt: new Date("2026-10-01") },
        { type: "knowledge-holder", createdAt: new Date("2026-10-02") },
      ],
      languageName: "Standard Fijian",
    });
    expect(generated).toHaveLength(ALL_LABEL_MEANINGS.length);
    expect(meaningsOfLabels(generated)).toHaveLength(generated.length);
  });
});
