/**
 * Staff search (BO-05): what a typed query means. Matching is plain and predictable: every word
 * must appear in the item's title, name or slug, or the whole query is the start of its ID. The
 * words never reach logs or analytics (app/lib/log.server.ts withholds query strings).
 */

export const MAX_QUERY = 100;
/** The fewest characters of an ID that find it: shorter runs would match by chance. */
const MIN_ID_PREFIX = 6;

/** The query as searched: spaces tidied and capped, empty when there is nothing to look for. */
export function cleanQuery(raw: string | null | undefined) {
  return (raw ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_QUERY);
}

/** Whether an item answers a cleaned query. */
export function matchesQuery(item: { id: string; fields: string[] }, query: string) {
  if (!query) return false;
  const wanted = query.toLowerCase();
  if (wanted.length >= MIN_ID_PREFIX && item.id.toLowerCase().startsWith(wanted)) return true;
  const haystack = item.fields.join("\n").toLowerCase();
  return wanted.split(" ").every((word) => haystack.includes(word));
}
