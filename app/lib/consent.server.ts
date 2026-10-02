import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { consentRecord, notice } from "~db/schema";
import { auditInsert } from "./audit.server";
import type { Database } from "./db.server";
import { noticeTag, subscribe, unsubscribe } from "./newsletter.server";
import { can } from "./permissions";
import { signToken, verifyToken } from "./signed-tokens";
import { requireStaff } from "./staff.server";
import { CONSENT_PURPOSES, type ConsentPurpose, type GivenConsent, SUBMISSION_LIMITS } from "./submission-fields";

/**
 * Consent Records (CONTEXT.md; docs/phase-1a-defaults.md §4): one per purpose a person agrees to,
 * naming the notice version they were shown, the form, the time and any withdrawal. Kept in their
 * own table, apart from Submissions. Notices are versioned content: publishing new wording adds a
 * version and leaves the old ones as they were.
 */

export type Notice = typeof notice.$inferSelect;
export type ConsentRecord = typeof consentRecord.$inferSelect;

const WITHDRAWAL = "consent-withdrawal";

/** The latest version of each purpose's notice: what a form shows now. */
export async function currentNotices(db: Database): Promise<Record<ConsentPurpose, Notice>> {
  const rows = await db.select().from(notice).orderBy(desc(notice.version));
  const latest = {} as Record<ConsentPurpose, Notice>;
  for (const row of rows) latest[row.purpose] ??= row;
  return latest;
}

/** Every version of every notice, newest first, for staff. */
export function allNotices(db: Database) {
  return db.select().from(notice).orderBy(notice.purpose, desc(notice.version));
}

/**
 * The notices consents were given under, if each is a real version of its own purpose's notice. The
 * version shown is recorded even if a newer one was published while the form was open.
 */
export async function shownNotices(db: Database, consents: GivenConsent[]) {
  if (!consents.length) return new Map<string, Notice>();
  const rows = await db
    .select()
    .from(notice)
    .where(
      inArray(
        notice.id,
        consents.map((consent) => consent.noticeId),
      ),
    );
  const byId = new Map(rows.map((row) => [row.id, row]));
  return consents.every((consent) => byId.get(consent.noticeId)?.purpose === consent.purpose) ? byId : null;
}

/** The inserts that record consents given on one form, to run in a batch with what they came with. */
export function consentInserts(
  db: Database,
  consents: GivenConsent[],
  given: { email: string; sourceForm: string; submissionId: string | null; at: Date },
) {
  return consents.map((consent) => {
    const id = crypto.randomUUID();
    return {
      id,
      purpose: consent.purpose,
      insert: db.insert(consentRecord).values({
        id,
        purpose: consent.purpose,
        noticeId: consent.noticeId,
        email: given.email,
        sourceForm: given.sourceForm,
        submissionId: given.submissionId,
        givenAt: given.at,
      }),
    };
  });
}

/** The link, sent by email, that lets a person withdraw one consent without an account. */
export async function withdrawalLink(env: Env, origin: string, recordId: string) {
  return `${origin}/consent/${await signToken(env.BETTER_AUTH_SECRET, WITHDRAWAL, recordId)}`;
}

/** The consent a withdrawal link is for, with the notice it was given under; null for a bad link. */
export async function consentForLink(env: Env, db: Database, token: string) {
  const id = await verifyToken(env.BETTER_AUTH_SECRET, WITHDRAWAL, token);
  if (!id) return null;
  const row = await db
    .select({ record: consentRecord, notice })
    .from(consentRecord)
    .innerJoin(notice, eq(notice.id, consentRecord.noticeId))
    .where(eq(consentRecord.id, id))
    .get();
  return row ?? null;
}

/**
 * Withdraws a consent. The newsletter is one list per address, so withdrawing any newsletter
 * consent withdraws them all for that address and takes it off the list.
 */
export async function withdrawConsent(
  env: Env,
  db: Database,
  recordId: string,
  via: "link" | "staff",
  actorId: string | null,
  now = new Date(),
) {
  const record = await db.select().from(consentRecord).where(eq(consentRecord.id, recordId)).get();
  if (!record) return null;
  if (record.purpose === "newsletter") {
    await unsubscribeAddress(env, db, record.email, via === "link" ? "unsubscribe" : via, actorId, now);
    return { ...record, withdrawnAt: record.withdrawnAt ?? now };
  }
  if (record.withdrawnAt) return record;
  await db.batch([
    db
      .update(consentRecord)
      .set({ withdrawnAt: now, withdrawnVia: via })
      .where(and(eq(consentRecord.id, recordId), isNull(consentRecord.withdrawnAt))),
    auditInsert(db, {
      actorId,
      action: "consent.withdrawn",
      objectType: "consent_record",
      objectId: recordId,
      details: { purpose: record.purpose, via },
    }),
  ]);
  return { ...record, withdrawnAt: now };
}

/** Takes an address off the newsletter and withdraws its newsletter consents. */
export async function unsubscribeAddress(
  env: Env,
  db: Database,
  email: string,
  via: "unsubscribe" | "staff",
  actorId: string | null,
  now = new Date(),
) {
  const address = email.trim().toLowerCase();
  await unsubscribe(env, address);
  const active = await db
    .select({ id: consentRecord.id })
    .from(consentRecord)
    .where(
      and(eq(consentRecord.email, address), eq(consentRecord.purpose, "newsletter"), isNull(consentRecord.withdrawnAt)),
    );
  if (!active.length) return;
  await db.batch([
    db
      .update(consentRecord)
      .set({ withdrawnAt: now, withdrawnVia: via })
      .where(
        inArray(
          consentRecord.id,
          active.map((row) => row.id),
        ),
      ),
    ...active.map((row) =>
      auditInsert(db, {
        actorId,
        action: "consent.withdrawn",
        objectType: "consent_record",
        objectId: row.id,
        details: { purpose: "newsletter", via },
      }),
    ),
  ]);
}

/**
 * Adds an address to the newsletter, after recording the consent it was given with. An address
 * that already agreed to this notice version isn't recorded again.
 */
export async function joinNewsletter(env: Env, db: Database, email: string, consent: GivenConsent, sourceForm: string) {
  const address = email.trim().toLowerCase();
  const shown = await shownNotices(db, [consent]);
  const shownNotice = shown?.get(consent.noticeId);
  if (!shownNotice) return false;
  const already = await db
    .select({ id: consentRecord.id })
    .from(consentRecord)
    .where(
      and(
        eq(consentRecord.email, address),
        eq(consentRecord.noticeId, consent.noticeId),
        isNull(consentRecord.withdrawnAt),
      ),
    )
    .get();
  if (!already) {
    const [record] = consentInserts(db, [consent], { email: address, sourceForm, submissionId: null, at: new Date() });
    await record.insert;
  }
  await subscribe(env, address, [noticeTag(shownNotice.version)]);
  return true;
}

/** A person's Consent Records, newest first, with the notices they agreed to: for the privacy contact. */
export function consentsOf(db: Database, email: string) {
  return db
    .select({ record: consentRecord, notice })
    .from(consentRecord)
    .innerJoin(notice, eq(notice.id, consentRecord.noticeId))
    .where(eq(consentRecord.email, email.trim().toLowerCase()))
    .orderBy(desc(consentRecord.givenAt));
}

/** Publishes new wording for a purpose's notice, as its next version. */
export async function publishNotice(db: Database, actorId: string, purpose: string, wording: string) {
  if (!Object.hasOwn(CONSENT_PURPOSES, purpose)) return { ok: false as const, error: "Choose what the notice is for." };
  const text = wording.replaceAll("\r\n", "\n").trim();
  if (!text) return { ok: false as const, error: "Enter the notice's wording." };
  if (text.length > SUBMISSION_LIMITS.text) {
    return {
      ok: false as const,
      error: `A notice can be at most ${SUBMISSION_LIMITS.text.toLocaleString("en")} characters.`,
    };
  }
  const current = (await currentNotices(db))[purpose as ConsentPurpose];
  if (current?.wording === text) return { ok: false as const, error: "That is the wording already in use." };
  const id = crypto.randomUUID();
  const version = (current?.version ?? 0) + 1;
  await db.batch([
    db.insert(notice).values({
      id,
      purpose: purpose as ConsentPurpose,
      version,
      wording: text,
      publishedBy: actorId,
      publishedAt: new Date(),
    }),
    auditInsert(db, {
      actorId,
      action: "notice.published",
      objectType: "notice",
      objectId: id,
      details: { purpose, version },
    }),
  ]);
  return { ok: true as const, version };
}

/** The staff gate plus a consent check: publishing notices, or finding a person's Consent Records. */
export async function requireConsentStaff(env: Env, request: Request, action: "notice.publish" | "consent.manage") {
  const staff = await requireStaff(env, request);
  if (!can(staff.actor, { action })) {
    throw new Response(
      action === "notice.publish"
        ? "Only the privacy contact or an administrator can publish notices."
        : "Only the privacy contact can look up Consent Records.",
      { status: 403 },
    );
  }
  return staff;
}
