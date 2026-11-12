import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { staff, submission } from "~db/schema";
import { audit } from "./audit.server";
import type { Database } from "./db.server";
import { sendEmail, teamAddresses } from "./email.server";
import { FORMS, type FormKey, type FormValues, type Handler, NOTICE, RETENTION_MONTHS } from "./forms";
import { logError } from "./log.server";
import { can, type Staff } from "./roles";

/**
 * Stores what a public form sent, then tells whoever handles it by email (docs/phase-1a-defaults.md
 * §4). The person is told it arrived only once it is stored. The email names the form and links to
 * the inbox, and never carries what was sent, so nothing personal sits in a mailbox.
 *
 * What the privacy notice promises (NOTICE in forms.ts) is kept here: a Submission is deleted 12
 * months after it is dealt with, and the privacy contact can find and delete everything one person
 * sent when they ask.
 */

/** Who deleting for retention is recorded as in the audit log. */
export const RETENTION_ACTOR = "retention (12 months after it was dealt with)";

/**
 * Deletes every Submission dealt with more than 12 months ago, each recorded in the audit log.
 * Nothing runs on a schedule (ADR-0015), so this runs whenever a form is sent or the inbox is
 * opened, as sign-in tidies expired links.
 */
export async function deleteExpiredSubmissions(db: Database, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RETENTION_MONTHS);
  const expired = await db
    .select({ id: submission.id })
    .from(submission)
    .where(and(eq(submission.done, true), lt(submission.doneAt, cutoff)))
    .limit(100);
  if (!expired.length) return 0;
  const ids = expired.map((row) => row.id);
  await db.batch([
    db.delete(submission).where(inArray(submission.id, ids)),
    ...ids.map((id) => audit(db, RETENTION_ACTOR, "submission.deleted", { type: "submission", id })),
  ]);
  return ids.length;
}

export async function receiveSubmission(
  env: Env,
  db: Database,
  form: FormKey,
  values: FormValues,
  adminOrigin: string,
) {
  const id = crypto.randomUUID();
  const { name, email, ...fields } = values;
  await db.insert(submission).values({
    id,
    form,
    name: name ?? null,
    email: email ?? null,
    fields,
    noticeVersion: NOTICE.version,
  });
  const to = await handlerAddresses(env, db, FORMS[form].handler);
  await sendEmail(env, {
    to,
    subject: `NAISEMA: a new "${FORMS[form].title}" form`,
    text: `Someone sent the "${FORMS[form].title}" form. Read it at ${adminOrigin}/admin/submissions/${id}\n`,
  });
  // What the person sent is stored already, so a failure here mustn't tell them it wasn't.
  await deleteExpiredSubmissions(db).catch((error) => logError("Retention deletion failed", { error }));
  return id;
}

/** Who is emailed: the staff holding the handling role, or the team's addresses for the team. */
async function handlerAddresses(env: Env, db: Database, handler: Handler) {
  if (handler === "team") return teamAddresses(env);
  const role = handler === "safeguarding" ? "safeguarding" : "admin";
  const people = await db.select().from(staff).where(eq(staff.active, true));
  const chosen = people.filter((person) => person.roles.includes(role)).map((person) => person.email);
  return chosen.length ? chosen : teamAddresses(env);
}

/** The forms a person may read: reports only for safeguarding, privacy requests only for administrators. */
export function readableForms(actor: Staff): FormKey[] {
  return (Object.keys(FORMS) as FormKey[]).filter((key) => {
    const handler: Handler = FORMS[key].handler;
    if (handler === "safeguarding") return can(actor, "reports.read");
    if (handler === "privacy") return can(actor, "staff.manage");
    return can(actor, "submissions.read");
  });
}

/**
 * Who may delete a Submission before its time, as when someone asks for what they sent to be
 * deleted: administrators, who are the privacy contact, for every form they can read, and the
 * Safeguarding Lead for reports, which only they read.
 */
export function mayDelete(actor: Staff, form: string) {
  if (!readableForms(actor).includes(form as FormKey)) return false;
  return can(actor, "staff.manage") || (form === "report" && can(actor, "reports.read"));
}

/** The newest Submissions a person may read, or only those from one email address. */
export async function listSubmissions(db: Database, actor: Staff, filter: { email?: string } = {}) {
  await deleteExpiredSubmissions(db);
  const forms = readableForms(actor);
  if (!forms.length) return [];
  const email = filter.email?.trim().toLowerCase();
  return db
    .select()
    .from(submission)
    .where(and(inArray(submission.form, forms), email ? eq(submission.email, email) : undefined))
    .orderBy(desc(submission.createdAt))
    .limit(200);
}

/** One Submission, for someone who may read its form; opening it is audited. */
export async function openSubmission(db: Database, actor: Staff, id: string) {
  const row = await db.query.submission.findFirst({ where: eq(submission.id, id) });
  if (!row || !readableForms(actor).includes(row.form as FormKey)) return null;
  await audit(db, actor.email, "submission.opened", { type: "submission", id });
  return row;
}

export async function markDone(db: Database, actor: Staff, id: string, done: boolean) {
  const row = await openSubmission(db, actor, id);
  if (!row) return false;
  await db.batch([
    db
      .update(submission)
      .set({ done, doneAt: done ? new Date() : null })
      .where(eq(submission.id, id)),
    audit(db, actor.email, done ? "submission.done" : "submission.reopened", { type: "submission", id }),
  ]);
  return true;
}

/**
 * Deletes one Submission for good, with the reason (such as a privacy request) in the audit log,
 * which keeps only its ID. Returns false if the person may not delete it.
 */
export async function deleteSubmission(db: Database, actor: Staff, id: string, reason: string) {
  const row = await db.query.submission.findFirst({ where: eq(submission.id, id) });
  if (!row || !mayDelete(actor, row.form)) return false;
  await db.batch([
    db.delete(submission).where(eq(submission.id, id)),
    audit(
      db,
      actor.email,
      "submission.deleted",
      { type: "submission", id },
      { form: row.form, reason: reason.trim().slice(0, 500) },
    ),
  ]);
  return true;
}
