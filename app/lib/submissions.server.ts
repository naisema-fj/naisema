import { and, asc, desc, eq, gt, inArray, isNull, ne } from "drizzle-orm";
import { consentRecord, mediaAsset, notice, submission, uploadLink, uploadLinkFile, user } from "~db/schema";
import { auditInsert } from "./audit.server";
import { fijiToday } from "./calendar";
import { consentInserts, shownNotices, withdrawalLink } from "./consent.server";
import type { Database } from "./db.server";
import { sendEmail } from "./email.server";
import { noticeTag, subscribe } from "./newsletter.server";
import { can } from "./permissions";
import { DAY_MS } from "./rights-rules";
import { hashToken, randomToken } from "./signed-tokens";
import { requireStaff } from "./staff.server";
import { activeHolders } from "./staff-roles.server";
import {
  CONSENT_PURPOSES,
  SUBMISSION_STATUSES,
  SUBMISSION_TYPES,
  type SubmissionInput,
  type SubmissionStatus,
  submissionSummary,
  takesUploads,
  UPLOAD_LINK_DAYS,
} from "./submission-fields";

/**
 * Submissions (CONTEXT.md; docs/phase-1a-defaults.md §4): stored with their Consent Records in one
 * batch before the visitor is told anything was received, then confirmed by email. They wait in a
 * staff queue, each with an owner and a due date, and are never published. For a contribution
 * proposal an editor can send a single-use, expiring upload link that puts files into quarantine.
 */

export type Submission = typeof submission.$inferSelect;

/** Days from receipt to the default due date, in Fiji's calendar (docs/decision-log.md). */
export const SUBMISSION_DUE_DAYS = 7;

const FORM_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The key a form is rendered with; sending it twice stores one Submission. */
export const newFormKey = () => crypto.randomUUID();

const addDays = (day: string, days: number) =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);

export type ReceiveResult =
  | { ok: true; id: string; duplicate: boolean; confirmed: boolean }
  | { ok: false; error: string };

/**
 * Stores a Submission and its Consent Records, then (only then) joins the newsletter if asked and
 * sends the confirmation. The same form sent twice (the same key) is stored once and confirmed once.
 */
export async function receiveSubmission(
  env: Env,
  db: Database,
  input: SubmissionInput,
  formKey: string,
  origin: string,
  now = new Date(),
): Promise<ReceiveResult> {
  if (!FORM_KEY.test(formKey)) return { ok: false, error: "Reload the page and send the form again." };
  const earlier = async () => {
    const found = await db.select().from(submission).where(eq(submission.formKey, formKey)).get();
    return found ? { ok: true as const, id: found.id, duplicate: true, confirmed: Boolean(found.confirmedAt) } : null;
  };
  const sent = await earlier();
  if (sent) return sent;
  const notices = await shownNotices(db, input.consents);
  if (!notices) {
    return { ok: false, error: "The wording you agreed to couldn't be found. Reload the page and send it again." };
  }

  const id = crypto.randomUUID();
  const email = input.email.toLowerCase();
  const consents = consentInserts(db, input.consents, { email, sourceForm: input.type, submissionId: id, at: now });
  try {
    await db.batch([
      db.insert(submission).values({
        id,
        type: input.type,
        formKey,
        name: input.name,
        email,
        fields: input.fields,
        dueOn: addDays(fijiToday(now), SUBMISSION_DUE_DAYS),
        receivedAt: now,
        updatedAt: now,
      }),
      ...consents.map((consent) => consent.insert),
      auditInsert(db, { actorId: null, action: "submission.received", objectType: "submission", objectId: id }),
    ]);
  } catch (error) {
    // The same form sent again while the first was still being stored.
    const stored = await earlier();
    if (stored) return stored;
    throw error;
  }

  const newsletter = input.consents.find((consent) => consent.purpose === "newsletter");
  if (newsletter) {
    const version = notices.get(newsletter.noticeId)?.version ?? 1;
    await subscribe(env, email, [noticeTag(version)]).catch((error) =>
      console.error("Newsletter sign-up failed", id, error),
    );
  }

  const confirmed = await sendConfirmation(env, input, consents, origin)
    .then(() => true)
    .catch((error) => {
      console.error("Submission confirmation failed", id, error);
      return false;
    });
  if (confirmed) await db.update(submission).set({ confirmedAt: new Date() }).where(eq(submission.id, id));
  return { ok: true, id, duplicate: false, confirmed };
}

async function sendConfirmation(
  env: Env,
  input: SubmissionInput,
  consents: { id: string; purpose: keyof typeof CONSENT_PURPOSES }[],
  origin: string,
) {
  const type = SUBMISSION_TYPES[input.type];
  const answers = submissionSummary(input.type, input.fields).map((line) => `${line.label}:\n${line.text}`);
  const withdrawals = await Promise.all(
    consents.map(
      async (consent) => `- ${CONSENT_PURPOSES[consent.purpose]}: ${await withdrawalLink(env, origin, consent.id)}`,
    ),
  );
  await sendEmail(env, {
    to: input.email,
    subject: `We've received your ${type.name.toLowerCase()}`,
    text: [
      `Bula ${input.name},`,
      `Thank you. Na iSema has received your ${type.name.toLowerCase()}, and someone on our team will read it. This is what you sent:`,
      answers.join("\n\n"),
      "You agreed to:",
      withdrawals.join("\n"),
      "To withdraw an agreement, open its link. If you didn't send this, you can ignore this email, or withdraw with the links above.",
      "Vinaka,\nNa iSema",
    ].join("\n\n"),
  });
}

// --- The staff queue ---

/** Open Submissions, soonest due first; then the most recently closed. */
export async function submissionQueue(db: Database, show: "open" | "closed") {
  const rows = await db
    .select({ submission, ownerName: user.name })
    .from(submission)
    .leftJoin(user, eq(user.id, submission.ownerId))
    .where(show === "open" ? ne(submission.status, "closed") : eq(submission.status, "closed"))
    .orderBy(...(show === "open" ? [asc(submission.dueOn), asc(submission.receivedAt)] : [desc(submission.updatedAt)]))
    .limit(200);
  return rows.map((row) => ({ ...row.submission, ownerName: row.ownerName }));
}

/** One Submission with its Consent Records, upload links and the files that arrived. */
export async function submissionDetail(db: Database, id: string) {
  const found = await db.select().from(submission).where(eq(submission.id, id)).get();
  if (!found) return null;
  const [consents, links] = await Promise.all([
    db
      .select({ record: consentRecord, version: notice.version })
      .from(consentRecord)
      .innerJoin(notice, eq(notice.id, consentRecord.noticeId))
      .where(eq(consentRecord.submissionId, id))
      .orderBy(asc(consentRecord.givenAt)),
    db.select().from(uploadLink).where(eq(uploadLink.submissionId, id)).orderBy(desc(uploadLink.issuedAt)),
  ]);
  const files = links.length
    ? await db
        .select({ asset: mediaAsset, linkId: uploadLinkFile.linkId })
        .from(uploadLinkFile)
        .innerJoin(mediaAsset, eq(mediaAsset.id, uploadLinkFile.assetId))
        .where(
          inArray(
            uploadLinkFile.linkId,
            links.map((link) => link.id),
          ),
        )
        .orderBy(asc(mediaAsset.createdAt))
    : [];
  return {
    submission: found,
    consents: consents.map((row) => ({ ...row.record, version: row.version })),
    links,
    files: files.map((row) => row.asset),
  };
}

/** Editors, who can own Submissions. */
export function possibleOwners(db: Database) {
  return activeHolders(db, "editor");
}

export type SubmissionChange = { status: string; ownerId: string; dueOn: string };

/** Sets a Submission's status, owner and due date. */
export async function updateSubmission(db: Database, actorId: string, id: string, change: SubmissionChange) {
  const found = await db.select().from(submission).where(eq(submission.id, id)).get();
  if (!found) return null;
  const errors: Record<string, string> = {};
  if (!Object.hasOwn(SUBMISSION_STATUSES, change.status)) errors.status = "Choose where it has got to.";
  const owners = await possibleOwners(db);
  if (change.ownerId && !owners.some((owner) => owner.id === change.ownerId)) {
    errors.ownerId = "Choose an editor, or nobody.";
  }
  const due = /^\d{4}-\d{2}-\d{2}$/.test(change.dueOn) ? new Date(`${change.dueOn}T00:00:00Z`) : null;
  if (!due || Number.isNaN(due.getTime())) errors.dueOn = "Enter the day it should be answered by.";
  if (Object.keys(errors).length) return { ok: false as const, errors };
  const status = change.status as SubmissionStatus;
  await db.batch([
    db
      .update(submission)
      .set({ status, ownerId: change.ownerId || null, dueOn: change.dueOn, updatedAt: new Date() })
      .where(eq(submission.id, id)),
    auditInsert(db, {
      actorId,
      action: "submission.updated",
      objectType: "submission",
      objectId: id,
      details: { status, ownerId: change.ownerId || null, dueOn: change.dueOn },
    }),
  ]);
  return { ok: true as const };
}

// --- Upload links for requested material ---

/**
 * Emails the contributor a single-use link to upload the material they proposed. Any earlier link
 * for the Submission stops working, so only the newest can be used.
 */
export async function sendUploadLink(
  env: Env,
  db: Database,
  actorId: string,
  id: string,
  origin: string,
  now = new Date(),
) {
  const found = await db.select().from(submission).where(eq(submission.id, id)).get();
  if (!found || !takesUploads(found.type)) return null;
  const token = randomToken();
  const linkId = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + UPLOAD_LINK_DAYS * DAY_MS);
  await db.batch([
    db
      .update(uploadLink)
      .set({ finishedAt: now })
      .where(and(eq(uploadLink.submissionId, id), isNull(uploadLink.finishedAt))),
    db.insert(uploadLink).values({
      id: linkId,
      submissionId: id,
      tokenHash: await hashToken(token),
      issuedBy: actorId,
      issuedAt: now,
      expiresAt,
    }),
    db
      .update(submission)
      .set({ status: found.status === "new" ? "in_progress" : found.status, updatedAt: now })
      .where(eq(submission.id, id)),
    auditInsert(db, { actorId, action: "upload_link.sent", objectType: "submission", objectId: id }),
  ]);
  await sendEmail(env, {
    to: found.email,
    subject: "Your link to upload to Na iSema",
    text: [
      `Bula ${found.name},`,
      "Thank you for offering to share your work with Na iSema. We'd like to see it. Upload your files with this private link:",
      `${origin}/upload/${token}`,
      `The link works until you tell us you've finished, or for ${UPLOAD_LINK_DAYS} days. Each file is checked for viruses before anyone opens it. Only send material you made, or have permission to share.`,
      "Vinaka,\nNa iSema",
    ].join("\n\n"),
  });
  return { linkId, expiresAt };
}

/** The upload link a token opens, while it still works. */
export async function openUploadLink(db: Database, token: string, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const row = await db
    .select({ link: uploadLink, name: submission.name })
    .from(uploadLink)
    .innerJoin(submission, eq(submission.id, uploadLink.submissionId))
    .where(
      and(
        eq(uploadLink.tokenHash, await hashToken(token)),
        isNull(uploadLink.finishedAt),
        gt(uploadLink.expiresAt, now),
      ),
    )
    .get();
  return row ?? null;
}

/** The files sent so far through a link. */
export async function linkFiles(db: Database, linkId: string) {
  const rows = await db
    .select({ asset: mediaAsset })
    .from(uploadLinkFile)
    .innerJoin(mediaAsset, eq(mediaAsset.id, uploadLinkFile.assetId))
    .where(eq(uploadLinkFile.linkId, linkId))
    .orderBy(asc(mediaAsset.createdAt));
  return rows.map((row) => row.asset);
}

/** Whether an upload belongs to a link; a link's uploads are only reachable through it. */
export async function linkOwnsAsset(db: Database, linkId: string, assetId: string) {
  const row = await db
    .select({ assetId: uploadLinkFile.assetId })
    .from(uploadLinkFile)
    .where(and(eq(uploadLinkFile.linkId, linkId), eq(uploadLinkFile.assetId, assetId)))
    .get();
  return Boolean(row);
}

/** The contributor has sent everything: the link stops working. */
export async function finishUploadLink(db: Database, linkId: string, submissionId: string) {
  await db.batch([
    db
      .update(uploadLink)
      .set({ finishedAt: new Date() })
      .where(and(eq(uploadLink.id, linkId), isNull(uploadLink.finishedAt))),
    auditInsert(db, {
      actorId: null,
      action: "upload_link.finished",
      objectType: "submission",
      objectId: submissionId,
    }),
  ]);
}

/** A file that arrived for a Submission and passed its scan, for staff to download. */
export async function submissionFile(db: Database, submissionId: string, assetId: string) {
  const row = await db
    .select({ asset: mediaAsset })
    .from(uploadLinkFile)
    .innerJoin(uploadLink, eq(uploadLink.id, uploadLinkFile.linkId))
    .innerJoin(mediaAsset, eq(mediaAsset.id, uploadLinkFile.assetId))
    .where(
      and(
        eq(uploadLinkFile.assetId, assetId),
        eq(uploadLink.submissionId, submissionId),
        eq(mediaAsset.status, "ready"),
      ),
    )
    .get();
  return row?.asset ?? null;
}

/** The staff gate plus the check for working the Submission queue. */
export async function requireSubmissionManager(env: Env, request: Request) {
  const staff = await requireStaff(env, request);
  if (!can(staff.actor, { action: "submission.manage" })) {
    throw new Response("Only editors can work on Submissions.", { status: 403 });
  }
  return staff;
}
