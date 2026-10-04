import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { contentItem, mediaAsset, revision, rightsExpiryWarning, rightsRecord } from "~db/schema";
import { adminUrl } from "./admin-url";
import { auditInsert } from "./audit.server";
import { getDb } from "./db.server";
import { sendEmail } from "./email.server";
import { toFacts } from "./rights.server";
import {
  DAY_MS,
  EXPIRY_WARNING_DAYS,
  type ExpiryWarning,
  expiryWarningsDue,
  formatDay,
  type RightsSubject,
  rightsPagePath,
} from "./rights-rules";
import { activeHolders } from "./staff-roles.server";

const LONGEST_WINDOW_DAYS = Math.max(...EXPIRY_WARNING_DAYS);

/** Where staff open a subject's Rights Records, on this environment's admin host. */
const rightsPageUrl = (env: Env, subject: RightsSubject) => adminUrl(env, rightsPagePath(subject));

/**
 * The daily job (ADR-0007): emails editors about Rights Records that expire within 30 days, once
 * as each enters the 30-day window and again at 7 days. It only warns: expiry itself takes effect
 * through isEligible, with no unpublishing. Each warning goes to the editor who recorded the
 * record, or to every current editor if that person no longer is one.
 */
export async function sendExpiryWarnings(env: Env, now: Date) {
  const db = getDb(env.DB);
  const expiring = await db
    .select({ record: rightsRecord, title: revision.snapshot, fileName: mediaAsset.name })
    .from(rightsRecord)
    .leftJoin(
      contentItem,
      and(eq(rightsRecord.subjectType, "content_item"), eq(contentItem.id, rightsRecord.subjectId)),
    )
    .leftJoin(revision, eq(revision.id, contentItem.currentDraftRevisionId))
    .leftJoin(mediaAsset, and(eq(rightsRecord.subjectType, "media_asset"), eq(mediaAsset.id, rightsRecord.subjectId)))
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
    records: expiring.map(({ record }) => toFacts(record)),
    sent: sent as ExpiryWarning[],
    now,
  });
  if (!due.length) return;

  const editors = await activeHolders(db, "editor");
  const byRecord = new Map(expiring.map((row) => [row.record.id, row]));
  type Letter = { to: string; withinDays: number; warnings: ExpiryWarning[]; lines: string[] };
  const letters = new Map<string, Letter>();
  for (const warning of due) {
    const { record, title, fileName } = byRecord.get(warning.recordId) as (typeof expiring)[number];
    const recorder = editors.find((editor) => editor.id === record.createdBy);
    const recipients = recorder ? [recorder.email] : editors.map((editor) => editor.email);
    const itemTitle = fileName ? `The file ${fileName}` : ((title as { title?: string } | null)?.title ?? "An item");
    const line = [
      `${itemTitle}: the Rights Record from ${record.rightsHolder} expires on ${formatDay(record.expiresAt as Date)}.`,
      `  ${rightsPageUrl(env, { type: record.subjectType as RightsSubject["type"], id: record.subjectId })}`,
    ].join("\n");
    for (const to of recipients) {
      const key = `${to}|${warning.withinDays}`;
      const letter = letters.get(key) ?? { to, withinDays: warning.withinDays, warnings: [], lines: [] };
      letter.warnings.push(warning);
      letter.lines.push(line);
      letters.set(key, letter);
    }
  }

  // Each letter's warnings are recorded as soon as it is sent, so a failure part-way through
  // leaves the unsent ones to tomorrow's run. Failures are rethrown at the end so the cron run
  // shows as failed.
  const failures: unknown[] = [];
  for (const letter of letters.values()) {
    try {
      await sendEmail(env, {
        to: letter.to,
        subject: `Rights Records expiring within ${letter.withinDays} days`,
        text: [
          `These Rights Records expire within ${letter.withinDays} days. When a record expires, the item it covers can no longer be published or shown until a current Rights Record grants Publish.`,
          "",
          ...letter.lines,
          "",
          "Renew the permission and record it, or plan to withdraw the item.",
        ].join("\n"),
      });
    } catch (error) {
      failures.push(error);
      continue;
    }
    await db.batch([
      db
        .insert(rightsExpiryWarning)
        .values(letter.warnings.map((warning) => ({ ...toWarningRow(warning), sentAt: now })))
        .onConflictDoNothing(),
      ...letter.warnings.map((warning) =>
        auditInsert(db, {
          actorId: null,
          action: "rights_record.expiry_warned",
          objectType: "rights_record",
          objectId: warning.recordId,
          details: { withinDays: warning.withinDays, to: letter.to },
        }),
      ),
    ]);
  }
  if (failures.length) throw new AggregateError(failures, `${failures.length} expiry warning emails failed`);
}

const toWarningRow = (warning: ExpiryWarning) => ({
  rightsRecordId: warning.recordId,
  withinDays: warning.withinDays,
});
