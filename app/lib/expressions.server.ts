import { and, asc, eq, inArray, like, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { expression } from "~db/schema";
import type { ExpressionDetails, NewExpression } from "./annotations";
import { auditInsert } from "./audit.server";
import type { Database } from "./db.server";
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
export function listExpressions(db: Database, languageVariety: string, search = "") {
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
    .limit(500);
}

export const getExpression = (db: Database, id: string) =>
  db.select().from(expression).where(eq(expression.id, id)).get();

/** The library's Expressions with these IDs, by ID. */
export async function expressionsById(db: Database, ids: string[]) {
  if (!ids.length) return new Map<string, LibraryExpression>();
  const rows = await db.select().from(expression).where(inArray(expression.id, ids));
  return new Map(rows.map((row) => [row.id, row]));
}

const sameKey = (value: string) => value.trim().toLowerCase();

/**
 * Prepares Expressions defined while annotating: each either matches one already in the library
 * (the same word or phrase and meaning) or is to be inserted. Returns how the editor's IDs map to
 * library IDs, and the inserts to run in the save's batch.
 */
export async function placeNewExpressions(
  db: Database,
  actorId: string,
  languageVariety: string,
  items: NewExpression[],
) {
  const ids = new Map<string, string>();
  const inserts: BatchItem<"sqlite">[] = [];
  const added: (ExpressionDetails & { id: string })[] = [];
  const existingIds = await expressionsById(
    db,
    items.map((item) => item.id),
  );
  const now = new Date();
  for (const item of items) {
    const same = await db
      .select({ id: expression.id })
      .from(expression)
      .where(
        and(
          eq(expression.languageVariety, languageVariety),
          eq(sql`lower(${expression.headword})`, sameKey(item.details.headword)),
          eq(sql`lower(${expression.generalMeaning})`, sameKey(item.details.generalMeaning)),
        ),
      )
      .get();
    const twin = added.find(
      (other) =>
        sameKey(other.headword) === sameKey(item.details.headword) &&
        sameKey(other.generalMeaning) === sameKey(item.details.generalMeaning),
    );
    if (same || twin) {
      ids.set(item.id, (same?.id ?? twin?.id) as string);
      continue;
    }
    // An ID already in the library for another Expression is never reused for a new one.
    const id = existingIds.has(item.id) ? crypto.randomUUID() : item.id;
    ids.set(item.id, id);
    added.push({ id, ...item.details });
    inserts.push(
      db.insert(expression).values({
        id,
        languageVariety,
        ...item.details,
        createdBy: actorId,
        createdAt: now,
        updatedBy: actorId,
        updatedAt: now,
      }),
      auditInsert(db, {
        actorId,
        action: "expression.created",
        objectType: "expression",
        objectId: id,
      }),
    );
  }
  return { ids, inserts, added };
}

/** Whether someone may change an Expression in the library: editors, and whoever added it. */
export const canEditExpression = (actor: Actor, row: LibraryExpression) =>
  can(actor, { action: "content.edit" }) || row.createdBy === actor.userId;

/** Changes an Expression in the library. */
export async function updateExpression(db: Database, actor: Actor, row: LibraryExpression, details: ExpressionDetails) {
  if (!canEditExpression(actor, row)) return false;
  await db.batch([
    db
      .update(expression)
      .set({ ...details, updatedBy: actor.userId, updatedAt: new Date() })
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
