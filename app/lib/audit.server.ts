import { auditEvent } from "~db/schema";
import type { Database } from "./db.server";

export type AuditEntry = {
  actorId: string | null;
  action: string;
  objectType: string;
  objectId?: string | null;
  details?: Record<string, unknown>;
};

/** Appends one event to the audit log (CMS-05). Never pass form bodies or secrets in details. */
export async function recordAudit(db: Database, entry: AuditEntry): Promise<void> {
  await auditInsert(db, entry);
}

/** The insert for one audit event, for running in a batch with the change it records. */
export function auditInsert(db: Database, entry: AuditEntry) {
  return db.insert(auditEvent).values({
    id: crypto.randomUUID(),
    actorId: entry.actorId,
    action: entry.action,
    objectType: entry.objectType,
    objectId: entry.objectId ?? null,
    details: entry.details ?? null,
    createdAt: new Date(),
  });
}
