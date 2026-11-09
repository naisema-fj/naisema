/**
 * Reading the Vosa dictionary's data file (apps.naisema.com/dictionary/data.js), so its words,
 * sayings and sources can be imported as drafts (app/lib/dictionary.server.ts). The file is a
 * script, `window.FIJIAN_DATA = {…};`; a plain JSON copy of the same object is read too. Nothing
 * here decides what is published: every imported row waits for review.
 */

export const VOSA_SCHEMA = 1;

/** The largest data file an import takes; the November 2026 file is about 1 MB. */
export const VOSA_MAX_BYTES = 8 * 1024 * 1024;

export type VosaSource = {
  id: string;
  name: string;
  kind: string;
  role: string;
  coverage: string;
  pages: number | null;
  webUrl: string | null;
};

export type VosaEntry = {
  id: string;
  kind: "word" | "saying";
  headword: string;
  meaning: string;
  literalMeaning: string | null;
  partOfSpeech: string;
  themes: string[];
  sourceIds: string[];
  appsStatus: string;
  /** The rest of the record, as the apps site had it. */
  details: Record<string, unknown>;
};

export type VosaBundle = { generated: string; entries: VosaEntry[]; sources: VosaSource[] };

export type VosaRead = { ok: true; bundle: VosaBundle; skipped: number } | { ok: false; error: string };

const LIMITS = { id: 100, headword: 300, meaning: 5000, short: 300 } as const;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textOf = (value: unknown, limit: number) => (typeof value === "string" ? value.trim().slice(0, limit) : "");

const idOf = (value: unknown) => {
  const id = textOf(value, LIMITS.id);
  return ID.test(id) ? id : null;
};

const textList = (value: unknown) =>
  Array.isArray(value)
    ? [...new Set(value.map((each) => textOf(each, LIMITS.short)).filter(Boolean))]
    : ([] as string[]);

/** The source ids a record cites, from its `source` and `sources`, each once. */
function citedSources(record: Record<string, unknown>) {
  const cited = [record.source, ...(Array.isArray(record.sources) ? record.sources : [])];
  const ids = cited.map((each) => (isRecord(each) ? idOf(each.id) : null)).filter((id): id is string => id !== null);
  return [...new Set(ids)];
}

/** The parts of a record kept in its own columns, left out of `details`. */
const COLUMNS = new Set(["id", "fijian", "meaning", "literal", "englishPos", "themes", "status", "source", "sources"]);

const detailsOf = (record: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(record).filter(([key]) => !COLUMNS.has(key)));

/** The object in the data file: the script's assignment, or the file as plain JSON. */
function objectIn(text: string): unknown {
  const body = text.trim().replace(/^﻿/, "");
  const assigned = body.match(/^window\.FIJIAN_DATA\s*=\s*([\s\S]*?);?\s*$/);
  return JSON.parse(assigned ? assigned[1] : body);
}

/**
 * Reads a Vosa data file. A word or saying without an id, its Fijian or its English meaning is
 * skipped (and counted), not guessed at; a file that isn't the Vosa data at all is refused.
 */
export function readVosaBundle(text: string): VosaRead {
  if (text.length > VOSA_MAX_BYTES) return { ok: false, error: "That file is larger than any Vosa data file." };
  let data: unknown;
  try {
    data = objectIn(text);
  } catch {
    return { ok: false, error: "That file isn't the Vosa dictionary's data.js." };
  }
  if (!isRecord(data) || !Array.isArray(data.entries)) {
    return { ok: false, error: "That file isn't the Vosa dictionary's data.js." };
  }
  if (data.schema !== VOSA_SCHEMA) {
    return { ok: false, error: `This file uses data schema ${String(data.schema)}; the import reads schema 1.` };
  }

  let skipped = 0;
  const entries = new Map<string, VosaEntry>();
  const add = (record: unknown, kind: VosaEntry["kind"]) => {
    if (!isRecord(record)) return void skipped++;
    const id = idOf(record.id);
    const headword = textOf(record.fijian, LIMITS.headword);
    const meaning = textOf(record.meaning, LIMITS.meaning);
    if (!id || !headword || !meaning || entries.has(id)) return void skipped++;
    entries.set(id, {
      id,
      kind,
      headword,
      meaning,
      literalMeaning: textOf(record.literal, LIMITS.meaning) || null,
      partOfSpeech: textOf(record.englishPos, LIMITS.short),
      themes: textList(record.themes),
      sourceIds: citedSources(record),
      appsStatus: textOf(record.status, LIMITS.short),
      details: detailsOf(record),
    });
  };
  for (const record of data.entries) add(record, "word");
  for (const record of Array.isArray(data.proverbs) ? data.proverbs : []) add(record, "saying");

  const sources = new Map<string, VosaSource>();
  for (const record of Array.isArray(data.sources) ? data.sources : []) {
    const id = isRecord(record) ? idOf(record.id) : null;
    if (!isRecord(record) || !id || sources.has(id)) continue;
    const webUrl = textOf(record.webUrl, 2000);
    sources.set(id, {
      id,
      name: textOf(record.name, LIMITS.short) || id,
      kind: textOf(record.type, LIMITS.short),
      role: textOf(record.role, LIMITS.short),
      coverage: textOf(record.coverage, LIMITS.meaning),
      pages: typeof record.pages === "number" && Number.isInteger(record.pages) ? record.pages : null,
      webUrl: /^https:\/\//.test(webUrl) ? webUrl : null,
    });
  }

  return {
    ok: true,
    skipped,
    bundle: {
      generated: textOf(data.generated, LIMITS.short),
      entries: [...entries.values()],
      sources: [...sources.values()],
    },
  };
}
