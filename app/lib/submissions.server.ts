import { desc, eq, inArray } from "drizzle-orm";
import { staff, submission } from "~db/schema";
import { audit } from "./audit.server";
import type { Database } from "./db.server";
import { sendEmail, teamAddresses } from "./email.server";
import { FORMS, type FormKey, type FormValues, type Handler, NOTICE } from "./forms";
import { can, type Staff } from "./roles";

/**
 * Stores what a public form sent, then tells whoever handles it by email (docs/phase-1a-defaults.md
 * §4). The person is told it arrived only once it is stored. The email names the form and links to
 * the inbox, and never carries what was sent, so nothing personal sits in a mailbox.
 */
export async function receiveSubmission(env: Env, db: Database, form: FormKey, values: FormValues, adminOrigin: string) {
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

export function listSubmissions(db: Database, actor: Staff) {
  const forms = readableForms(actor);
  if (!forms.length) return Promise.resolve([]);
  return db.select().from(submission).where(inArray(submission.form, forms)).orderBy(desc(submission.createdAt)).limit(200);
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
    db.update(submission).set({ done }).where(eq(submission.id, id)),
    audit(db, actor.email, done ? "submission.done" : "submission.reopened", { type: "submission", id }),
  ]);
  return true;
}
