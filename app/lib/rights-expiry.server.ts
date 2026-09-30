import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { contentItem, revision, rightsExpiryWarning, rightsRecord, roleAssignment, user } from "~db/schema";
import { auditInsert } from "./audit.server";
import { type Database, getDb } from "./db.server";
import { sendEmail } from "./email.server";
import { EXPIRY_WARNING_DAYS, type ExpiryWarning, expiryWarningsDue, type PermittedUse } from "./rights-rules";

const DAY_MS = 86_400_000;
const LONGEST_WINDOW_DAYS = Math.max(...EXPIRY_WARNING_DAYS);

/** Where staff open a Content Item's Rights Records, on this environment's admin host. */
function rightsPageUrl(env: Env, contentItemId: string) {
  const scheme = env.ADMIN_HOSTNAME.endsWith("localhost") ? "http" : "https";
  return `${scheme}://${env.ADMIN_HOSTNAME}/admin/articles/${contentItemId}/rights`;
}

async function activeEditors(db: Database) {
  return db
    .selectDistinct({ id: user.id, email: user.email })
    .from(roleAssignment)
    .innerJoin(user, eq(user.id, roleAssignment.userId))
    .where(and(eq(roleAssignment.role, "editor"), isNull(roleAssignment.revokedAt)));
}

/**
 * The daily job (ADR-0007): emails editors about Rights Records that expire within 30 days, once
 * as each enters the 30-day window and again at 7 days. It only warns: expiry itself takes effect
 * through isEligible, with no unpublishing. Each warning goes to the editor who recorded the
 * record, or to every current editor if that person no longer is one.
 */
export async function sendExpiryWarnings(env: Env, now: Date) {
  const db = getDb(env.DB);
  const expiring = await db
    .select({ record: rightsRecord, title: revision.snapshot })
    .from(rightsRecord)
    .leftJoin(
      contentItem,
      and(eq(rightsRecord.subjectType, "content_item"), eq(contentItem.id, rightsRecord.subjectId)),
    )
    .leftJoin(revision, eq(revision.id, contentItem.currentDraftRevisionId))
    .where(
      and(
        isNull(rightsRecord.withdrawnAt),
        gt(rightsRecord.expiresAt, now),
        lte(rightsRecord.expiresAt, new Date(now.getTime() + LONGEST_WINDOW_DAYS * DAY_MS)),
      ),
    );
  if (!expiring.length) return;

  const sent = await db
    .select({ recordId: rightsExpiryWarning.rightsRecordId, withinDays: rightsExpiryWarning.withinDays })
    .from(rightsExpiryWarning)
    .where(
      inArray(
        rightsExpiryWarning.rightsRecordId,
        expiring.map(({ record }) => record.id),
      ),
    );
  const due = expiryWarningsDue({
    records: expiring.map(({ record }) => ({
      id: record.id,
      permittedUses: record.permittedUses as PermittedUse[],
      guardianPermission: record.guardianPermission,
      expiresAt: record.expiresAt,
      withdrawnAt: record.withdrawnAt,
    })),
    sent: sent as ExpiryWarning[],
    now,
  });
  if (!due.length) return;

  const editors = await activeEditors(db);
  const byRecord = new Map(expiring.map((row) => [row.record.id, row]));
  const letters = new Map<string, { withinDays: number; lines: string[] }[]>();
  for (const warning of due) {
    const { record, title } = byRecord.get(warning.recordId) as (typeof expiring)[number];
    const recorder = editors.find((editor) => editor.id === record.createdBy);
    const recipients = recorder ? [recorder.email] : editors.map((editor) => editor.email);
    const itemTitle = (title as { title?: string } | null)?.title ?? "An item";
    const line = [
      `${itemTitle}: the Rights Record from ${record.rightsHolder} expires on ${record.expiresAt?.toISOString().slice(0, 10)}.`,
      `  ${rightsPageUrl(env, record.subjectId)}`,
    ].join("\n");
    for (const email of recipients) {
      const groups = letters.get(email) ?? [];
      const group = groups.find((entry) => entry.withinDays === warning.withinDays);
      if (group) group.lines.push(line);
      else groups.push({ withinDays: warning.withinDays, lines: [line] });
      letters.set(email, groups);
    }
  }

  for (const [to, groups] of letters) {
    for (const { withinDays, lines } of groups) {
      await sendEmail(env, {
        to,
        subject: `Rights Records expiring within ${withinDays} days`,
        text: [
          `These Rights Records expire within ${withinDays} days. When a record expires, the item it covers can no longer be published or shown until a current Rights Record grants Publish.`,
          "",
          ...lines,
          "",
          "Renew the permission and record it, or plan to withdraw the item.",
        ].join("\n"),
      });
    }
  }

  await db.batch([
    db
      .insert(rightsExpiryWarning)
      .values(due.map((warning) => ({ rightsRecordId: warning.recordId, withinDays: warning.withinDays, sentAt: now })))
      .onConflictDoNothing(),
    ...due.map((warning) =>
      auditInsert(db, {
        actorId: null,
        action: "rights_record.expiry_warned",
        objectType: "rights_record",
        objectId: warning.recordId,
        details: { withinDays: warning.withinDays },
      }),
    ),
  ]);
}
