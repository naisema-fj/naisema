import { describe, expect, it } from "vitest";
import {
  approvalRefusal,
  type ExpressionWording,
  reviewStanding,
  searchKey,
  searchText,
  vosaSlug,
  wordingFingerprint,
} from "~/lib/vosa";

const WORDING: ExpressionWording = {
  kind: "word",
  headword: "Baca",
  partOfSpeech: "noun",
  generalMeaning: "Bait put on a fishhook or in a fishing trap.",
  literalMeaning: "",
  grammarNote: "",
  pronunciation: "",
  notes: "",
  details: { searchKeywords: ["bait"], appsSite: { englishChecked: true, status: "needs review", notes: "" } },
  citations: [{ sourceId: "a2056948d246" }],
  themes: ["fishing-traps"],
};

describe("Vosa addresses", () => {
  it("keep the marks and hyphens Fijian tells words apart by", () => {
    expect(vosaSlug("Baca")).toBe("baca");
    expect(vosaSlug("vaka-")).toBe("vaka-");
    expect(vosaSlug("vaka")).toBe("vaka");
    expect(vosaSlug("vūtū")).not.toBe(vosaSlug("vutu"));
    expect(vosaSlug("Turaga bale")).toBe("turaga-bale");
    expect(vosaSlug("E CAKA ME KA NI I SAU")).toBe("e-caka-me-ka-ni-i-sau");
  });

  it("let a search without marks find a word written with them", () => {
    expect(searchKey("vūtū")).toBe("vutu");
    expect(searchText(WORDING)).toContain("bait");
  });
});

describe("Expression review (ADR-0017)", () => {
  it("fingerprints the exact wording, whatever order its fields come in", async () => {
    const same = { ...WORDING, details: { appsSite: WORDING.details.appsSite, searchKeywords: ["bait"] } };
    expect(await wordingFingerprint(same)).toBe(await wordingFingerprint(WORDING));
    expect(await wordingFingerprint({ ...WORDING, generalMeaning: "Bait." })).not.toBe(
      await wordingFingerprint(WORDING),
    );
  });

  it("leaves the apps site's own record out of the wording a reviewer approves", async () => {
    const otherRecord = { ...WORDING, details: { ...WORDING.details, appsSite: undefined } };
    expect(await wordingFingerprint(otherRecord)).toBe(await wordingFingerprint(WORDING));
  });

  it("counts only an approval of the wording as it is now", () => {
    const old = { fingerprint: "old", reviewerEmail: "r@naisema.test", createdAt: new Date("2026-11-15") };
    const now = { fingerprint: "now", reviewerEmail: "r@naisema.test", createdAt: new Date("2026-11-16") };
    expect(reviewStanding("now", [old, now])).toBe(now);
    expect(reviewStanding("newer", [old, now])).toBeNull();
  });

  it("lets only a Language Reviewer for the variety approve, and never their own wording", () => {
    const expression = { variety: "standard-fijian", updatedBy: "editor@naisema.test" };
    const reviewer = { email: "reviewer@naisema.test", mayReviewLanguage: true, languageVariety: "standard-fijian" };
    expect(approvalRefusal(reviewer, expression)).toBeNull();
    expect(approvalRefusal({ ...reviewer, mayReviewLanguage: false }, expression)).toMatch(/roles/);
    expect(approvalRefusal({ ...reviewer, languageVariety: null }, expression)).toMatch(/variety/);
    expect(approvalRefusal(reviewer, { ...expression, updatedBy: "Reviewer@naisema.test" })).toMatch(/wrote/);
  });
});
