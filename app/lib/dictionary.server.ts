import { and, asc, count, eq, inArray, like, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { dictionaryEntry, dictionarySource } from "~db/schema";
import { auditInsert } from "./audit.server";
import type { Database } from "./db.server";
import { headwordKey } from "./expressions.server";
import type { Actor } from "./permissions";
import { can } from "./permissions";
import type { VosaBundle } from "./vosa-bundle";

/**
 * The Vosa dictionary's drafts (apps.naisema.com, which stays live on its own host). Editors import its data file; every word and saying arrives as
 * a draft that needs review, with the sources it cites, so each source can be cleared with a
 * Rights Record. Nothing here is public, and a draft is not an Expression: Annotations can't use it.
 * Importing again refreshes the drafts from the newer file and adds what is new.
 */

export type DictionaryEntry = typeof dictionaryEntry.$inferSelect;
export type DictionarySource = typeof dictionarySource.$inferSelect;

/** D1 binds at most 100 values in one statement, so rows go in groups that stay under it. */
const MAX_BOUND = 100;
const groups = <T>(rows: T[], columns: number) => {
  const size = Math.max(1, Math.floor(MAX_BOUND / columns));
  const out: T[][] = [];
  for (let at = 0; at < rows.length; at += size) out.push(rows.slice(at, at + size));
  return out;
};

export const canImportDictionary = (actor: Actor) => can(actor, { action: "content.edit" });

export type ImportResult = { words: number; sayings: number; sources: number; batch: string };

/** Imports a read Vosa data file as drafts, in one batch with its audit event. Editors only. */
export async function importVosaBundle(db: Database, actor: Actor, bundle: VosaBundle, now = new Date()) {
  if (!canImportDictionary(actor)) throw new Response("Only editors import the dictionary.", { status: 403 });
  const batch = `vosa-${bundle.generated || "undated"}-${now.toISOString().slice(0, 19)}`;
  const entryRows = bundle.entries.map((entry) => ({
    ...entry,
    headwordKey: headwordKey(entry.headword),
    reviewState: "needs_review" as const,
    importBatch: batch,
    importedAt: now,
  }));
  const sourceRows = bundle.sources.map((source) => ({ ...source, importBatch: batch, importedAt: now }));

  const statements: BatchItem<"sqlite">[] = [];
  for (const rows of groups(sourceRows, Object.keys(sourceRows[0] ?? { id: 1 }).length)) {
    statements.push(
      db
        .insert(dictionarySource)
        .values(rows)
        .onConflictDoUpdate({
          target: dictionarySource.id,
          set: {
            name: sql`excluded.name`,
            kind: sql`excluded.kind`,
            role: sql`excluded.role`,
            coverage: sql`excluded.coverage`,
            pages: sql`excluded.pages`,
            webUrl: sql`excluded.web_url`,
            importBatch: sql`excluded.import_batch`,
            importedAt: sql`excluded.imported_at`,
          },
        }),
    );
  }
  for (const rows of groups(entryRows, Object.keys(entryRows[0] ?? { id: 1 }).length)) {
    statements.push(
      db
        .insert(dictionaryEntry)
        .values(rows)
        .onConflictDoUpdate({
          target: dictionaryEntry.id,
          set: {
            kind: sql`excluded.kind`,
            headword: sql`excluded.headword`,
            headwordKey: sql`excluded.headword_key`,
            meaning: sql`excluded.meaning`,
            literalMeaning: sql`excluded.literal_meaning`,
            partOfSpeech: sql`excluded.part_of_speech`,
            themes: sql`excluded.themes`,
            sourceIds: sql`excluded.source_ids`,
            appsStatus: sql`excluded.apps_status`,
            details: sql`excluded.details`,
            importBatch: sql`excluded.import_batch`,
            importedAt: sql`excluded.imported_at`,
          },
          // A draft someone has moved on from review is never overwritten by an import.
          setWhere: sql`${dictionaryEntry.reviewState} = 'needs_review'`,
        }),
    );
  }

  const result: ImportResult = {
    words: bundle.entries.filter((entry) => entry.kind === "word").length,
    sayings: bundle.entries.filter((entry) => entry.kind === "saying").length,
    sources: bundle.sources.length,
    batch,
  };
  const audit = auditInsert(db, {
    actorId: actor.userId,
    action: "dictionary.imported",
    objectType: "dictionary",
    objectId: batch,
    details: { ...result, generated: bundle.generated },
  });
  await db.batch([audit, ...statements]);
  return result;
}

export const DICTIONARY_PAGE = 100;

/** Drafts by headword, optionally matching a word or meaning, a page at a time. */
export async function listDictionary(db: Database, options: { search?: string; kind?: string; page?: number } = {}) {
  const term = (options.search ?? "").trim().replace(/[%_]/g, "");
  const where = and(
    options.kind === "word" || options.kind === "saying" ? eq(dictionaryEntry.kind, options.kind) : undefined,
    term ? or(like(dictionaryEntry.headword, `%${term}%`), like(dictionaryEntry.meaning, `%${term}%`)) : undefined,
  );
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(dictionaryEntry)
      .where(where)
      .orderBy(asc(dictionaryEntry.headwordKey), asc(dictionaryEntry.id))
      .limit(DICTIONARY_PAGE)
      .offset((page - 1) * DICTIONARY_PAGE),
    db.select({ value: count() }).from(dictionaryEntry).where(where),
  ]);
  return { rows, total: total?.value ?? 0, page };
}

export const getDictionaryEntry = (db: Database, id: string) =>
  db.select().from(dictionaryEntry).where(eq(dictionaryEntry.id, id)).get();

/** The sources with these ids, in the order given; an id with no source is left out. */
export async function dictionarySources(db: Database, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.select().from(dictionarySource).where(inArray(dictionarySource.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** Every source, by name, with how many drafts cite it: what needs a Rights Record first. */
export async function listDictionarySources(db: Database) {
  const [sources, entries] = await Promise.all([
    db.select().from(dictionarySource).orderBy(asc(dictionarySource.name)),
    db.select({ sourceIds: dictionaryEntry.sourceIds }).from(dictionaryEntry),
  ]);
  const cited = new Map<string, number>();
  for (const { sourceIds } of entries) for (const id of sourceIds) cited.set(id, (cited.get(id) ?? 0) + 1);
  return sources.map((source) => ({ ...source, citedBy: cited.get(source.id) ?? 0 }));
}
