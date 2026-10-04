import { describe, expect, it } from "vitest";
import { matchExpression, searchEvent, searchFilters, searchHref } from "~/lib/search-query";

const filters = (query: string) => searchFilters(new URL(`https://naisema.test/search${query}`));

describe("matchExpression", () => {
  it("matches every word, the last one as a prefix, so results narrow as a visitor types", () => {
    expect(matchExpression("Bula vina")).toBe('"Bula" "vina"*');
  });

  it("treats search syntax as plain words, so a visitor can't break the query", () => {
    expect(matchExpression('title:"x" OR NOT (y) -z*')).toBe('"title" "x" "OR" "NOT" "y" "z"*');
  });

  it("keeps letters with diacritics and macrons together", () => {
    expect(matchExpression("Viti Levu ā")).toBe('"Viti" "Levu" "ā"*');
  });

  it("has nothing to match when there are no words", () => {
    expect(matchExpression("  ?! ")).toBeNull();
    expect(matchExpression("")).toBeNull();
  });

  it("caps very long queries", () => {
    const words = Array.from({ length: 30 }, (_, index) => `w${index}`).join(" ");
    expect(matchExpression(words)?.split(" ")).toHaveLength(10);
  });
});

describe("searchFilters", () => {
  it("reads the query, filters and page from the URL", () => {
    expect(filters("?q=bula&area=learn&topic=t1&format=article&page=3")).toEqual({
      q: "bula",
      area: "learn",
      topic: "t1",
      format: "article",
      page: 3,
    });
  });

  it("ignores filters it doesn't recognise and pages that aren't pages", () => {
    expect(filters("?area=nowhere&format=podcast&page=-2")).toEqual({
      q: "",
      area: null,
      topic: null,
      format: null,
      page: 1,
    });
    expect(filters("?page=abc").page).toBe(1);
  });
});

describe("searchHref", () => {
  it("keeps the current filters and leaves defaults out", () => {
    const current = filters("?q=bula&area=learn&page=2");

    expect(searchHref(current, { page: 3 })).toBe("/search?q=bula&area=learn&page=3");
    expect(searchHref(current, { area: null, page: 1 })).toBe("/search?q=bula");
  });
});

describe("searchEvent", () => {
  it("records filters, result IDs and counts, never the words searched for", () => {
    const event = searchEvent({
      filters: filters("?q=my+private+words&area=learn&topic=t1"),
      resultIds: ["item-1", "item-2"],
      total: 2,
    });

    expect(event).toEqual({
      indexes: ["search_performed"],
      blobs: ["search_performed", "learn", "t1", "", "item-1", "item-2"],
      doubles: [2, 1],
    });
    expect(JSON.stringify(event)).not.toContain("private");
  });

  it("records at most ten result IDs", () => {
    const resultIds = Array.from({ length: 20 }, (_, index) => `item-${index}`);
    expect(searchEvent({ filters: filters(""), resultIds, total: 20 }).blobs).toHaveLength(14);
  });
});
