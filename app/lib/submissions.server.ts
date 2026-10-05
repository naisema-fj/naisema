import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { consentRecord, mediaAsset, notice, submission, uploadLink, uploadLinkFile, user } from "~db/schema";
import { issueToken, linkExpiry, linkState, tokenHashOf } from "./access-links";
import { auditInsert } from "./audit.server";
import { fijiToday } from "./calendar";
import { consentInserts, shownNotices, subscribeOrForget, withdrawalLink } from "./consent.server";
import type { Database } from "./db.server";
import { letterText, sendEmail } from "./email.server";
import { logError } from "./log.server";
import { can } from "./permissions";
import { DAY_MS } from "./rights-rules";
import { requireStaff } from "./staff.server";
import { activeHolders } from "./staff-roles.server";
import {
  CONSENT_PURPOSES,
  type ConsentPurpose,
  normaliseEmail,
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

/** Whether a YYYY-MM-DD is a day that exists (not 31 February, which Date would roll into March). */
const isCalendarDay = (day: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day;
};

const addDays = (day: string, days: number) =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);

export type Received = {
  ok: true;
  id: string;
  email: string;
  duplicate: boolean;
  confirmed: boolean;
  /** Whether asking to join the newsletter worked; null when it wasn't asked for. */
  newsletter: boolean | null;
};
export type ReceiveResult = Received | { ok: false; error: string };

/**
 * The Submission a form key already stored, as the result of sending it. A form sent twice (a
 * double click, a refresh) is answered from this before anything else is checked, because the
 * second send's Turnstile token has already been spent.
 */
export async function alreadyReceived(db: Database, formKey: string): Promise<Received | null> {
  if (!FORM_KEY.test(formKey)) return null;
  const found = await db.select().from(submission).where(eq(submission.formKey, formKey)).get();
  if (!found) return null;
  return {
    ok: true,
    id: found.id,
    email: found.email,
    duplicate: true,
    confirmed: Boolean(found.confirmedAt),
    newsletter: null,
  };
}

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
  const sent = await alreadyReceived(db, formKey);
  if (sent) return sent;
  const notices = await shownNotices(db, input.consents);
  if (!notices) {
    return { ok: false, error: "The wording you agreed to couldn't be found. Reload the page and send it again." };
  }

  const id = crypto.randomUUID();
  const email = normaliseEmail(input.email);
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
    const stored = await alreadyReceived(db, formKey);
    if (stored) return stored;
    throw error;
  }

  const newsletterConsent = consents.find((consent) => consent.purpose === "newsletter");
  const newsletterNotice = input.consents.find((consent) => consent.purpose === "newsletter");
  const newsletter =
    newsletterConsent && newsletterNotice
      ? await subscribeOrForget(
          env,
          db,
          email,
          newsletterConsent.id,
          notices.get(newsletterNotice.noticeId)?.version ?? 1,
        )
      : null;

  const confirmed = await sendConfirmation(env, input, consents, origin)
    .then(() => true)
    .catch((error) => {
      logError("Submission confirmation failed", { submissionId: id, error });
      return false;
    });
  if (confirmed) await db.update(submission).set({ confirmedAt: new Date() }).where(eq(submission.id, id));
  return { ok: true, id, email, duplicate: false, confirmed, newsletter };
}

async function sendConfirmation(
  env: Env,
  input: SubmissionInput,
  consents: { id: string; purpose: ConsentPurpose }[],
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
    text: letterText(input.name, [
      `Thank you. Na iSema has received your ${type.name.toLowerCase()}, and someone on our team will read it. This is what you sent:`,
      answers.join("\n\n"),
      "You agreed to:",
      withdrawals.join("\n"),
      "To withdraw an agreement, open its link. If you didn't send this, you can ignore this email, or withdraw with the links above.",
    ]),
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
  if (!isCalendarDay(change.dueOn)) errors.dueOn = "Enter the day it should be answered by.";
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
 * Emails the contributor a single-use link to upload the material they proposed. Once the email
 * has gone, any earlier link for the Submission stops working, so only the newest can be used; if
 * it can't be sent, the new link is dropped and the earlier one still works.
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
  const { token, tokenHash } = await issueToken();
  const linkId = crypto.randomUUID();
  const expiresAt = linkExpiry(now, UPLOAD_LINK_DAYS);
  await db.insert(uploadLink).values({
    id: linkId,
    submissionId: id,
    tokenHash,
    issuedBy: actorId,
    issuedAt: now,
    expiresAt,
  });
  try {
    await sendEmail(env, {
      to: found.email,
      subject: "Your link to upload to Na iSema",
      text: letterText(found.name, [
        "Thank you for offering to share your work with Na iSema. We'd like to see it. Upload your files with this private link:",
        `${origin}/upload/${token}`,
        `The link works until you tell us you've finished, or for ${UPLOAD_LINK_DAYS} days. Each file is checked for viruses before anyone opens it. Only send material you made, or have permission to share.`,
      ]),
    });
  } catch (error) {
    await db.delete(uploadLink).where(eq(uploadLink.id, linkId));
    throw error;
  }
  await db.batch([
    db
      .update(uploadLink)
      .set({ finishedAt: now })
      .where(and(eq(uploadLink.submissionId, id), isNull(uploadLink.finishedAt), ne(uploadLink.id, linkId))),
    db
      .update(submission)
      .set({ status: found.status === "new" ? "in_progress" : found.status, updatedAt: now })
      .where(eq(submission.id, id)),
    auditInsert(db, { actorId, action: "upload_link.sent", objectType: "submission", objectId: id }),
  ]);
  return { linkId, expiresAt };
}

/**
 * The upload link a token opens, while it still works (app/lib/access-links.ts): it is closed once
 * the contributor finishes or a newer one is sent.
 */
export async function openUploadLink(db: Database, token: string, now = new Date()) {
  const tokenHash = await tokenHashOf(token);
  if (!tokenHash) return null;
  const row = await db
    .select({ link: uploadLink, name: submission.name })
    .from(uploadLink)
    .innerJoin(submission, eq(submission.id, uploadLink.submissionId))
    .where(eq(uploadLink.tokenHash, tokenHash))
    .get();
  return row && linkState({ expiresAt: row.link.expiresAt, closedAt: row.link.finishedAt }, now) === "active"
    ? row
    : null;
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

/** How many files one upload link takes, so a leaked link can't fill the quarantine. */
export const UPLOAD_LINK_FILES = 20;

/** How many uploads a link has started. */
export async function linkFileCount(db: Database, linkId: string) {
  const rows = await db
    .select({ assetId: uploadLinkFile.assetId })
    .from(uploadLinkFile)
    .where(eq(uploadLinkFile.linkId, linkId));
  return rows.length;
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
