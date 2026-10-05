import { and, asc, eq, inArray, like, notInArray, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { expression, learningLayer, learningLayerEducator, learningLayerRevision } from "~db/schema";
import type { ExpressionDetails, NewExpression } from "./annotations";
import { auditInsert, recordAudit } from "./audit.server";
import type { Database } from "./db.server";
import type { ExpressionLibrary } from "./layer-revision";
import { type Actor, can } from "./permissions";

/**
 * The Expression library (ADR-0011, VID-07): words and phrases with their general meaning, grammar
 * note and pronunciation, reused by Annotations across Learning Layers. An Expression defined while
 * annotating is added here when the Learning Layer is saved, unless the same word or phrase with
 * the same meaning is already here, which is then used instead, so the library doesn't fill with
 * copies. Editors, and whoever added an Expression, can change it; Learning Layers see a change
 * when they are next saved.
 */

export type LibraryExpression = typeof expression.$inferSelect;

export const detailsOf = (row: LibraryExpression): ExpressionDetails => ({
  headword: row.headword,
  generalMeaning: row.generalMeaning,
  grammarNote: row.grammarNote,
  pronunciation: row.pronunciation,
  literalMeaning: row.literalMeaning,
});

/** A Language Variety's Expressions, by word or phrase, optionally matching a search. */
export function listExpressions(db: Database, languageVariety: string, search = "", limit = 500) {
  const term = search.trim().replace(/[%_]/g, "");
  return db
    .select()
    .from(expression)
    .where(
      and(
        eq(expression.languageVariety, languageVariety),
        term ? or(like(expression.headword, `%${term}%`), like(expression.generalMeaning, `%${term}%`)) : undefined,
      ),
    )
    .orderBy(asc(sql`lower(${expression.headword})`))
    .limit(limit);
}

export const getExpression = (db: Database, id: string) =>
  db.select().from(expression).where(eq(expression.id, id)).get();

/** The library's Expressions with these IDs, by ID. */
export async function expressionsById(db: Database, ids: string[]) {
  if (!ids.length) return new Map<string, LibraryExpression>();
  const rows = await db.select().from(expression).where(inArray(expression.id, ids));
  return new Map(rows.map((row) => [row.id, row]));
}

/** A headword as matched: Unicode lower case and composed, so "Ā" and "ā" are the same word. */
export const headwordKey = (headword: string) => headword.trim().normalize("NFC").toLowerCase();

const EXPRESSION_FIELDS = ["headword", "generalMeaning", "grammarNote", "pronunciation", "literalMeaning"] as const;

/** Whether two Expressions say exactly the same, case aside: only then is one reused for the other. */
const sameDetails = (a: ExpressionDetails, b: ExpressionDetails) =>
  EXPRESSION_FIELDS.every(
    (field) =>
      (a[field] === null) === (b[field] === null) && headwordKey(a[field] ?? "") === headwordKey(b[field] ?? ""),
  );

/** The most new Expressions one save may add. */
export const MAX_NEW_EXPRESSIONS = 100;

export type Placed =
  | {
      ok: true;
      /** The library ID each Expression the editor defined ends up as. */
      ids: Map<string, string>;
      inserts: BatchItem<"sqlite">[];
      added: (ExpressionDetails & { id: string })[];
    }
  | { ok: false; error: string };

/**
 * Prepares Expressions defined while annotating: each either matches one already in the library
 * saying exactly the same (so the Educator's notes are never dropped for another's) or is to be
 * inserted with the ID the editor gave it. An ID that is already another Expression's is refused,
 * never swapped, so no Annotation is moved to a different Expression.
 */
export async function placeNewExpressions(
  db: Database,
  actorId: string,
  languageVariety: string,
  items: NewExpression[],
): Promise<Placed> {
  if (items.length > MAX_NEW_EXPRESSIONS) {
    return { ok: false, error: `Save after adding at most ${MAX_NEW_EXPRESSIONS} new Expressions at a time.` };
  }
  const taken = await expressionsById(
    db,
    items.map((item) => item.id),
  );
  if (taken.size)
    return { ok: false, error: "A new Expression's ID is already in use. Reload the editor and try again." };
  const keys = [...new Set(items.map((item) => headwordKey(item.details.headword)))];
  const candidates = keys.length
    ? await db
        .select()
        .from(expression)
        .where(and(eq(expression.languageVariety, languageVariety), inArray(expression.headwordKey, keys)))
    : [];
  const ids = new Map<string, string>();
  const inserts: BatchItem<"sqlite">[] = [];
  const added: (ExpressionDetails & { id: string })[] = [];
  const now = new Date();
  for (const item of items) {
    const existing =
      candidates.find((row) => sameDetails(detailsOf(row), item.details))?.id ??
      added.find((other) => sameDetails(other, item.details))?.id;
    if (existing) {
      ids.set(item.id, existing);
      continue;
    }
    ids.set(item.id, item.id);
    added.push({ id: item.id, ...item.details });
    inserts.push(
      db.insert(expression).values({
        id: item.id,
        languageVariety,
        ...item.details,
        headwordKey: headwordKey(item.details.headword),
        createdBy: actorId,
        createdAt: now,
        updatedBy: actorId,
        updatedAt: now,
      }),
      auditInsert(db, { actorId, action: "expression.created", objectType: "expression", objectId: item.id }),
    );
  }
  return { ok: true, ids, inserts, added };
}

/**
 * The copy of each Expression a Revision's Annotations use, by ID: those just added, and those in
 * the library for the Learning Layer's Language Variety. Annotations linked to anything else are
 * left without one, which their check then reports.
 */
export async function expressionCopies(
  db: Database,
  languageVariety: string,
  ids: string[],
  added: (ExpressionDetails & { id: string })[],
) {
  const library = await expressionsById(db, ids);
  const copies: Record<string, ExpressionDetails> = {};
  for (const id of ids) {
    const fresh = added.find((item) => item.id === id);
    const row = library.get(id);
    if (fresh) {
      const { id: _, ...details } = fresh;
      copies[id] = details;
    } else if (row?.languageVariety === languageVariety) {
      copies[id] = detailsOf(row);
    }
  }
  return copies;
}

/**
 * Whether a Learning Layer the person isn't assigned to uses an Expression in its current draft:
 * then only an editor may change it, so one Educator's change never reaches another's work unseen.
 */
async function usedByOthers(db: Database, actorId: string, expressionId: string) {
  const row = await db
    .select({ id: learningLayer.id })
    .from(learningLayer)
    .innerJoin(learningLayerRevision, eq(learningLayerRevision.id, learningLayer.currentDraftRevisionId))
    .where(
      and(
        sql`instr(${learningLayerRevision.snapshot}, ${expressionId}) > 0`,
        notInArray(
          learningLayer.id,
          db
            .select({ id: learningLayerEducator.learningLayerId })
            .from(learningLayerEducator)
            .where(eq(learningLayerEducator.userId, actorId)),
        ),
      ),
    )
    .get();
  return Boolean(row);
}

/** Whether someone may change an Expression in the library (`expression.edit`). */
export async function canEditExpression(db: Database, actor: Actor, row: LibraryExpression) {
  return can(actor, {
    action: "expression.edit",
    expression: { createdBy: row.createdBy, usedByOthers: await usedByOthers(db, actor.userId, row.id) },
  });
}

/** Changes an Expression in the library; a refused attempt is audited. */
export async function updateExpression(db: Database, actor: Actor, row: LibraryExpression, details: ExpressionDetails) {
  if (!(await canEditExpression(db, actor, row))) {
    await recordAudit(db, {
      actorId: actor.userId,
      action: "expression.refused",
      objectType: "expression",
      objectId: row.id,
    });
    return false;
  }
  await db.batch([
    db
      .update(expression)
      .set({ ...details, headwordKey: headwordKey(details.headword), updatedBy: actor.userId, updatedAt: new Date() })
      .where(eq(expression.id, row.id)),
    auditInsert(db, {
      actorId: actor.userId,
      action: "expression.updated",
      objectType: "expression",
      objectId: row.id,
    }),
  ]);
  return true;
}

/**
 * The library of one Language Variety in D1, as a Learning Layer save reaches it
 * (app/lib/layer-revision.ts): new Expressions are placed by `placeNewExpressions`, and their
 * inserts are made with the Revision.
 */
export function expressionLibrary(db: Database, actorId: string, languageVariety: string): ExpressionLibrary {
  return {
    async place(items) {
      const placed = await placeNewExpressions(db, actorId, languageVariety, items);
      return placed.ok ? { ok: true, ids: placed.ids, added: placed.added, writes: placed.inserts } : placed;
    },
    copies: (ids, added) => expressionCopies(db, languageVariety, ids, added),
  };
}
