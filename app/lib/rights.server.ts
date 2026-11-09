import { and, desc, eq } from "drizzle-orm";
import { rightsRecord } from "~db/schema";
import { audit } from "./audit.server";
import { Refused } from "./content.server";
import type { Database } from "./db.server";
import { can, type Staff } from "./roles";
import { isPermittedUse, type PermittedUse } from "./rights-rules";

/**
 * Rights Records on Content Items and media files (ADR-0007). They are added and withdrawn, never
 * edited, so what an item was public under stays on record.
 */

export type RightsSubject = { type: "item" | "media"; id: string };

export const rightsFor = (db: Database, subject: RightsSubject) =>
  db
    .select()
    .from(rightsRecord)
    .where(and(eq(rightsRecord.subjectType, subject.type), eq(rightsRecord.subjectId, subject.id)))
    .orderBy(desc(rightsRecord.createdAt));

export async function addRights(
  db: Database,
  actor: Staff,
  subject: RightsSubject,
  input: {
    holder: string;
    uses: string[];
    guardianPermission: boolean;
    expiresOn: string;
    notes: string;
    evidenceKey: string | null;
  },
) {
  if (!can(actor, "rights.manage")) throw new Refused("Only editors record rights.", 403);
  const holder = input.holder.trim();
  if (!holder) throw new Refused("Name who holds the rights.");
  const uses = [...new Set(input.uses.filter(isPermittedUse))] as PermittedUse[];
  if (!uses.length) throw new Refused("Choose at least one use they permit.");
  const expiresOn = input.expiresOn.trim() || null;
  if (expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) throw new Refused("Give the last day as a date.");
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(rightsRecord).values({
      id,
      subjectType: subject.type,
      subjectId: subject.id,
      holder: holder.slice(0, 300),
      permittedUses: uses,
      guardianPermission: input.guardianPermission,
      expiresOn,
      evidenceKey: input.evidenceKey,
      notes: input.notes.trim().slice(0, 2000),
      createdBy: actor.email,
    }),
    audit(db, actor.email, "rights.added", { type: subject.type, id: subject.id }, { record: id, uses, expiresOn }),
  ]);
  return id;
}

export async function withdrawRights(db: Database, actor: Staff, recordId: string, reason: string) {
  if (!can(actor, "rights.manage")) throw new Refused("Only editors withdraw rights.", 403);
  const record = await db.query.rightsRecord.findFirst({ where: eq(rightsRecord.id, recordId) });
  if (!record) throw new Refused("That Rights Record doesn't exist.", 404);
  if (record.withdrawnAt) return record;
  await db.batch([
    db.update(rightsRecord).set({ withdrawnAt: new Date() }).where(eq(rightsRecord.id, recordId)),
    audit(db, actor.email, "rights.withdrawn", { type: record.subjectType, id: record.subjectId }, {
      record: recordId,
      reason: reason.trim().slice(0, 500),
    }),
  ]);
  return record;
}
