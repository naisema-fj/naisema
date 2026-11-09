import { auditEvent } from "~db/schema";
import type { Database } from "./db.server";

/**
 * Records who did what to which object (CMS-05). The table refuses updates and deletes, so the log
 * only grows. Details hold IDs, choices and reasons, never form bodies or evidence.
 */
export function audit(
  db: Database,
  actorEmail: string,
  action: string,
  subject: { type: string; id: string },
  details: Record<string, unknown> = {},
) {
  return db.insert(auditEvent).values({
    id: crypto.randomUUID(),
    actorEmail,
    action,
    subjectType: subject.type,
    subjectId: subject.id,
    details,
  });
}
