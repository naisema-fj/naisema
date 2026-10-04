import { contributor } from "~db/schema";
import { auditInsert } from "./audit.server";
import type { Database } from "./db.server";

/** Contributors: anyone whose story, recording or knowledge appears in content (CONTEXT.md). */
export async function listContributors(db: Database) {
  return db
    .select({ id: contributor.id, name: contributor.name, notes: contributor.notes })
    .from(contributor)
    .orderBy(contributor.name);
}

export async function createContributor(db: Database, createdBy: string, name: string, notes: string) {
  if (!name) return { ok: false as const, error: "Enter the contributor's name." };
  if (name.length > 200) return { ok: false as const, error: "Names can be at most 200 characters." };
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(contributor).values({ id, name, notes: notes || null, createdBy, createdAt: new Date() }),
    auditInsert(db, { actorId: createdBy, action: "contributor.created", objectType: "contributor", objectId: id }),
  ]);
  return { ok: true as const };
}
