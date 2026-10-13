import { describe, expect, it } from "vitest";
import { cleanQuery, MAX_QUERY, matchesQuery } from "~/lib/staff-search";

const ID = "3f9c2a6e-1b7d-4e55-9a0c-5d2e8f1a7b44";

describe("cleanQuery", () => {
  it("trims, collapses spaces and caps the length", () => {
    expect(cleanQuery("  yaqona   ceremony ")).toBe("yaqona ceremony");
    expect(cleanQuery("x".repeat(MAX_QUERY + 50))).toHaveLength(MAX_QUERY);
  });

  it("treats a missing or blank query as nothing to search for", () => {
    expect(cleanQuery(null)).toBe("");
    expect(cleanQuery("   ")).toBe("");
  });
});

describe("matchesQuery", () => {
  const item = { id: ID, fields: ["Bringing yaqona", "bringing-yaqona"] };

  it("finds a word anywhere in a title or slug, ignoring case", () => {
    expect(matchesQuery(item, "YAQONA")).toBe(true);
    expect(matchesQuery(item, "bringing-yaq")).toBe(true);
  });

  it("needs every word to be found, in any order", () => {
    expect(matchesQuery(item, "yaqona bringing")).toBe(true);
    expect(matchesQuery(item, "yaqona kava")).toBe(false);
  });

  it("finds an item by its whole ID or the start of it", () => {
    expect(matchesQuery(item, ID)).toBe(true);
    expect(matchesQuery(item, "3f9c2a6e")).toBe(true);
    expect(matchesQuery(item, ID.toUpperCase())).toBe(true);
  });

  it("doesn't match a short fragment against the middle of an ID", () => {
    expect(matchesQuery(item, "5d2e")).toBe(false);
    expect(matchesQuery(item, "3f9")).toBe(false);
  });

  it("matches nothing for an empty query", () => {
    expect(matchesQuery(item, "")).toBe(false);
  });
});
