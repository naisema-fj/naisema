/**
 * Reading the lists the Learning Layer editor sends as JSON (Annotations, notes, Activities): every
 * entry is read field by field, so nothing the editor didn't mean to send is kept, and each needs
 * its own UUID, which stays the same across Revisions.
 */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
/** A string field, trimmed and cut to `limit` characters, or "" for anything else. */
export const text = (value: unknown, limit: number) => (typeof value === "string" ? value.trim().slice(0, limit) : "");
/** An ID pointing at something else, or "" for anything that can't be one. */
export const reference = (value: unknown) => (typeof value === "string" && value.length <= 64 ? value : "");

export type Read<T> = { ok: true; items: T[] } | { ok: false; error: string };

/** Parses a JSON list the editor sent, reading each entry; refuses one it can't read or a repeated ID. */
export function readList<T extends { id: string }>(
  json: string,
  what: string,
  read: (item: Record<string, unknown>) => T | null,
): Read<T> {
  const refused = (where = "") => ({
    ok: false as const,
    error: `The ${what} couldn't be read${where}. Reload the editor and try again.`,
  });
  let value: unknown;
  try {
    value = JSON.parse(json || "[]");
  } catch {
    return refused();
  }
  if (!Array.isArray(value) || value.length > 2000) return refused();
  const items: T[] = [];
  const seen = new Set<string>();
  for (const [index, entry] of value.entries()) {
    const item = isRecord(entry) ? read(entry) : null;
    if (!item || !UUID.test(item.id) || seen.has(item.id)) return refused(` (number ${index + 1})`);
    seen.add(item.id);
    items.push(item);
  }
  return { ok: true, items };
}
