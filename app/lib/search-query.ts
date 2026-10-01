import { isPrimaryArea, type PrimaryArea } from "./areas";
import { type ContentFormat, isContentFormat } from "./formats";

/** A public search as it appears in the URL (PUB-03): the words, filters and page. */
export type SearchFilters = {
  q: string;
  area: PrimaryArea | null;
  topic: string | null;
  format: ContentFormat | null;
  page: number;
};

const MAX_TERMS = 10;

/**
 * The FTS5 MATCH expression for what a visitor typed: every word must match, the last one as a
 * prefix. Each word is quoted, so search syntax (OR, NOT, column:, -) is only ever plain text.
 */
export function matchExpression(q: string): string | null {
  const words = (q.match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, MAX_TERMS);
  if (!words.length) return null;
  return words.map((word, index) => `"${word}"${index === words.length - 1 ? "*" : ""}`).join(" ");
}

export function searchFilters(url: URL): SearchFilters {
  const params = url.searchParams;
  const area = params.get("area");
  const format = params.get("format");
  const page = Number.parseInt(params.get("page") ?? "", 10);
  return {
    q: (params.get("q") ?? "").trim(),
    area: area && isPrimaryArea(area) ? area : null,
    topic: params.get("topic") || null,
    format: format && isContentFormat(format) ? format : null,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** The search page's address for these filters, so a search can be shared, bookmarked or paged. */
export function searchHref(filters: SearchFilters, changes: Partial<SearchFilters> = {}) {
  const next = { ...filters, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.area) params.set("area", next.area);
  if (next.topic) params.set("topic", next.topic);
  if (next.format) params.set("format", next.format);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

const MAX_RECORDED_RESULTS = 10;

/**
 * The `search_performed` product event (docs/decision-log.md, analytics): which filters were used
 * and which items came back, by ID. The words searched for never leave the request.
 */
export function searchEvent(input: { filters: SearchFilters; resultIds: string[]; total: number }) {
  const { filters } = input;
  return {
    indexes: ["search_performed"],
    blobs: [
      "search_performed",
      filters.area ?? "",
      filters.topic ?? "",
      filters.format ?? "",
      ...input.resultIds.slice(0, MAX_RECORDED_RESULTS),
    ],
    doubles: [input.total, filters.page],
  };
}
