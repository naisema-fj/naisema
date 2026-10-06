import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { auditEvent, user } from "~db/schema";
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

/**
 * What the audit log page narrows to: one object, one person (by email or user ID), actions
 * starting with some words, and events older than the last one on the page before.
 */
export type AuditFilter = { object?: string; actor?: string; action?: string; before?: AuditCursor };

/** The last event on a page: its time, and its ID to order events written in the same millisecond. */
export type AuditCursor = { at: number; id: string };

export const cursorText = (cursor: AuditCursor) => `${cursor.at}.${cursor.id}`;

export function readCursor(text: string | null): AuditCursor | undefined {
  const match = text?.match(/^(\d{1,15})\.([\w-]{1,64})$/);
  return match ? { at: Number(match[1]), id: match[2] } : undefined;
}

export const AUDIT_PAGE_SIZE = 100;

/**
 * Audit events, newest first, a page at a time (CMS-05), with who acted as their email address.
 * Paging from the last event shown, rather than by offset, means new events never shift a page.
 */
export async function auditLog(db: Database, filter: AuditFilter) {
  const conditions = [
    filter.object ? eq(auditEvent.objectId, filter.object) : undefined,
    filter.actor ? or(eq(auditEvent.actorId, filter.actor), eq(user.email, filter.actor.toLowerCase())) : undefined,
    filter.action ? sql`substr(${auditEvent.action}, 1, ${filter.action.length}) = ${filter.action}` : undefined,
    filter.before
      ? or(
          lt(auditEvent.createdAt, new Date(filter.before.at)),
          and(eq(auditEvent.createdAt, new Date(filter.before.at)), lt(auditEvent.id, filter.before.id)),
        )
      : undefined,
  ];
  const rows = await db
    .select({
      id: auditEvent.id,
      action: auditEvent.action,
      objectType: auditEvent.objectType,
      objectId: auditEvent.objectId,
      details: auditEvent.details,
      createdAt: auditEvent.createdAt,
      actorId: auditEvent.actorId,
      actorEmail: user.email,
    })
    .from(auditEvent)
    .leftJoin(user, eq(user.id, auditEvent.actorId))
    .where(and(...conditions))
    .orderBy(desc(auditEvent.createdAt), desc(auditEvent.id))
    .limit(AUDIT_PAGE_SIZE + 1)
    .all();
  return {
    events: rows.slice(0, AUDIT_PAGE_SIZE).map((row) => ({ ...row, reason: reasonOf(row.details) })),
    more: rows.length > AUDIT_PAGE_SIZE,
  };
}

/**
 * Why, where the event says: a reason given by the person who acted, or the reasons the code gave
 * for refusing (`publish.refused`).
 */
export function reasonOf(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const { reason, reasons } = details as { reason?: unknown; reasons?: unknown };
  if (typeof reason === "string") return reason;
  if (Array.isArray(reasons) && reasons.every((item) => typeof item === "string")) return reasons.join(" ");
  return null;
}
