import { and, asc, count, eq, inArray, like, ne, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { dictionaryEntry, dictionarySource } from "~db/schema";
import { auditInsert } from "./audit.server";
import type { Database } from "./db.server";
import { worksOnDictionary } from "./dictionary-rules";
import { headwordKey } from "./expressions.server";
import { LAYER_LANGUAGE_VARIETY } from "./learning-layer-fields";
import type { Actor } from "./permissions";
import { can } from "./permissions";
import { requireStaff } from "./staff.server";
import type { VosaBundle } from "./vosa-bundle";

/**
 * The Vosa dictionary's drafts (apps.naisema.com, which stays live on its own host). Editors import its data file; every word and saying arrives as
 * a draft that needs review, with the sources it cites, so each source can be cleared with a
 * Rights Record. Nothing here is public, and a draft is not an Expression: Annotations can't use it.
 * Importing again refreshes the drafts from the newer file and adds what is new.
 *
 * An entry is public only when a language reviewer has approved exactly what it shows now (its
 * fingerprint), every source it cites has been cleared by an editor, and it isn't a cultural term
 * (those need cultural review with a Knowledge Holder, which the dictionary doesn't record yet).
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

/** The staff gate for the dictionary's staff pages. */
export async function requireDictionaryStaff(env: Env, request: Request) {
  const staff = await requireStaff(env, request);
  if (!worksOnDictionary(staff.actor)) {
    throw new Response("Only editors, Educators and language reviewers work on the dictionary.", { status: 403 });
  }
  return staff;
}

export const canImportDictionary = (actor: Actor) => can(actor, { action: "content.edit" });

export type ImportResult = {
  words: number;
  sayings: number;
  sources: number;
  batch: string;
  /** Approved entries the import changed, which leave the public site until reviewed again. */
  takenDown: string[];
};

/** Imports a read Vosa data file as drafts, in one batch with its audit event. Editors only. */
export async function importVosaBundle(db: Database, actor: Actor, bundle: VosaBundle, now = new Date()) {
  if (!canImportDictionary(actor)) throw new Response("Only editors import the dictionary.", { status: 403 });
  const batch = `vosa-${bundle.generated || "undated"}-${now.toISOString().slice(0, 19)}`;
  const entryRows = await Promise.all(
    bundle.entries.map(async (entry) => ({
      ...entry,
      headwordKey: headwordKey(entry.headword),
      reviewState: "needs_review" as const,
      importBatch: batch,
      importedAt: now,
      importedBy: actor.userId,
      contentFingerprint: await entryFingerprint(entry),
    })),
  );
  const sourceRows = bundle.sources.map((source) => ({ ...source, importBatch: batch, importedAt: now }));
  const approved = await db
    .select({ id: dictionaryEntry.id, fingerprint: dictionaryEntry.approvedFingerprint })
    .from(dictionaryEntry)
    .where(sql`${dictionaryEntry.approvedFingerprint} IS NOT NULL`);
  const approvedById = new Map(approved.map((row) => [row.id, row.fingerprint]));
  const takenDown = entryRows
    .filter((row) => approvedById.has(row.id) && approvedById.get(row.id) !== row.contentFingerprint)
    .map((row) => row.id);

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
            importedBy: sql`excluded.imported_by`,
            // A changed entry gets a new fingerprint, so its approval no longer matches and it
            // leaves the public site until it is reviewed again (as ADR-0006 does for Revisions).
            contentFingerprint: sql`excluded.content_fingerprint`,
          },
        }),
    );
  }

  const result: ImportResult = {
    words: bundle.entries.filter((entry) => entry.kind === "word").length,
    sayings: bundle.entries.filter((entry) => entry.kind === "saying").length,
    sources: bundle.sources.length,
    batch,
    takenDown,
  };
  const audit = auditInsert(db, {
    actorId: actor.userId,
    action: "dictionary.imported",
    objectType: "dictionary",
    objectId: batch,
    details: {
      words: result.words,
      sayings: result.sayings,
      sources: result.sources,
      takenDown: takenDown.length,
      generated: bundle.generated,
    },
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

/** What a language reviewer approves: the parts of an entry shown publicly. */
export async function entryFingerprint(entry: {
  headword: string;
  meaning: string;
  literalMeaning: string | null;
  partOfSpeech: string;
}) {
  const shown = JSON.stringify([entry.headword, entry.meaning, entry.literalMeaning, entry.partOfSpeech]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(shown));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Cultural terms wait for cultural review with a Knowledge Holder, which the dictionary doesn't record yet. */
export const CULTURAL_TERM = "cultural term";

/** The SQL condition for an entry being public; the same rule as `isPublicEntry`. */
const publicEntry = and(
  sql`${dictionaryEntry.approvedFingerprint} = ${dictionaryEntry.contentFingerprint}`,
  ne(dictionaryEntry.partOfSpeech, CULTURAL_TERM),
  // Every cited source exists and is cleared (names written out: the subquery has two tables).
  sql`NOT EXISTS (SELECT 1 FROM json_each("dictionary_entry"."source_ids") AS cited LEFT JOIN "dictionary_source" AS src ON src."id" = cited.value WHERE src."cleared_at" IS NULL)`,
);

export type EntryState = "needs_review" | "approved_sources_pending" | "approved_cultural" | "public";

/** Where one entry has got to, for staff. */
export function entryState(entry: DictionaryEntry, sources: DictionarySource[]): EntryState {
  if (!entry.approvedFingerprint || entry.approvedFingerprint !== entry.contentFingerprint) return "needs_review";
  if (entry.partOfSpeech === CULTURAL_TERM) return "approved_cultural";
  const cleared = new Set(sources.filter((source) => source.clearedAt).map((source) => source.id));
  return entry.sourceIds.every((id) => cleared.has(id)) ? "public" : "approved_sources_pending";
}

export const ENTRY_STATES: Record<EntryState, string> = {
  needs_review: "Needs language review",
  approved_sources_pending: "Approved for language; waiting for its sources to be cleared",
  approved_cultural: "Approved for language; a cultural term, so not public until cultural review exists",
  public: "Public",
};

/** Whether this actor may approve an entry for language: a Standard Fijian language reviewer who didn't import it. */
export const canReviewEntry = (actor: Actor, entry: Pick<DictionaryEntry, "importedBy">) =>
  entry.importedBy !== actor.userId &&
  actor.roles.some(
    (role) =>
      role.role === "reviewer" && role.reviewType === "language" && role.languageVariety === LAYER_LANGUAGE_VARIETY,
  );

export const canClearSource = (actor: Actor) => can(actor, { action: "rights.manage" });

/** Approves what an entry shows now, for language. Returns false when this actor may not. */
export async function approveEntry(db: Database, actor: Actor, entry: DictionaryEntry, now = new Date()) {
  if (!canReviewEntry(actor, entry)) return false;
  await db.batch([
    db
      .update(dictionaryEntry)
      .set({ approvedFingerprint: entry.contentFingerprint, approvedBy: actor.userId, approvedAt: now })
      .where(and(eq(dictionaryEntry.id, entry.id), eq(dictionaryEntry.contentFingerprint, entry.contentFingerprint))),
    auditInsert(db, {
      actorId: actor.userId,
      action: "dictionary.approved",
      objectType: "dictionary_entry",
      objectId: entry.id,
      details: { fingerprint: entry.contentFingerprint },
    }),
  ]);
  return true;
}

/** Withdraws an entry's language approval, taking it off the public site. Its reviewers and editors may. */
export async function withdrawApproval(db: Database, actor: Actor, entry: DictionaryEntry) {
  if (!canReviewEntry(actor, entry) && !can(actor, { action: "content.withdraw" })) return false;
  await db.batch([
    db
      .update(dictionaryEntry)
      .set({ approvedFingerprint: null, approvedBy: null, approvedAt: null })
      .where(eq(dictionaryEntry.id, entry.id)),
    auditInsert(db, {
      actorId: actor.userId,
      action: "dictionary.approval_withdrawn",
      objectType: "dictionary_entry",
      objectId: entry.id,
    }),
  ]);
  return true;
}

/** Records (or, with a null note, removes) an editor's clearance of a source. */
export async function setSourceClearance(
  db: Database,
  actor: Actor,
  sourceId: string,
  note: string | null,
  now = new Date(),
) {
  if (!canClearSource(actor)) return false;
  await db.batch([
    db
      .update(dictionarySource)
      .set(
        note
          ? { clearedBy: actor.userId, clearedAt: now, clearanceNote: note }
          : { clearedBy: null, clearedAt: null, clearanceNote: null },
      )
      .where(eq(dictionarySource.id, sourceId)),
    auditInsert(db, {
      actorId: actor.userId,
      action: note ? "dictionary.source_cleared" : "dictionary.source_clearance_removed",
      objectType: "dictionary_source",
      objectId: sourceId,
    }),
  ]);
  return true;
}

/** Public entries by headword, optionally matching a word or meaning, a page at a time. */
export async function listPublicDictionary(db: Database, options: { search?: string; page?: number } = {}) {
  const term = (options.search ?? "").trim().replace(/[%_]/g, "").slice(0, 100);
  const where = and(
    publicEntry,
    term ? or(like(dictionaryEntry.headword, `%${term}%`), like(dictionaryEntry.meaning, `%${term}%`)) : undefined,
  );
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: dictionaryEntry.id,
        headword: dictionaryEntry.headword,
        meaning: dictionaryEntry.meaning,
        kind: dictionaryEntry.kind,
        partOfSpeech: dictionaryEntry.partOfSpeech,
      })
      .from(dictionaryEntry)
      .where(where)
      .orderBy(asc(dictionaryEntry.headwordKey), asc(dictionaryEntry.id))
      .limit(DICTIONARY_PAGE)
      .offset((page - 1) * DICTIONARY_PAGE),
    db.select({ value: count() }).from(dictionaryEntry).where(where),
  ]);
  return { rows, total: total?.value ?? 0, page };
}

/** One public entry with the sources it cites, or null if it isn't public. */
export async function getPublicEntry(db: Database, id: string) {
  const entry = await db
    .select()
    .from(dictionaryEntry)
    .where(and(eq(dictionaryEntry.id, id), publicEntry))
    .get();
  if (!entry) return null;
  return { entry, sources: await dictionarySources(db, entry.sourceIds) };
}

/** The public pages showing an entry, to purge when it changes. */
export const publicDictionaryPaths = (id?: string) => ["/learn/dictionary", ...(id ? [`/learn/dictionary/${id}`] : [])];

/** Every entry citing a source, for purging their pages when its clearance changes. */
export async function entriesCiting(db: Database, sourceId: string) {
  const rows = await db
    .select({ id: dictionaryEntry.id })
    .from(dictionaryEntry)
    .where(
      sql`EXISTS (SELECT 1 FROM json_each("dictionary_entry"."source_ids") AS cited WHERE cited.value = ${sourceId})`,
    );
  return rows.map((row) => row.id);
}
