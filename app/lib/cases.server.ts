import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import {
  caseEvidence,
  caseRecord,
  consentRecord,
  contentHold,
  contentItem,
  mediaAsset,
  submission,
  user,
} from "~db/schema";
import { auditInsert, recordAudit } from "./audit.server";
import {
  APPEAL_OUTCOMES,
  type AppealOutcome,
  appealOpen,
  CASE_KINDS,
  type CaseDataRequest,
  type CaseKind,
  type CaseOutcome,
  type CaseReport,
  type CaseState,
  canMove,
  outcomesFor,
  type Severity,
} from "./case-rules";
import { consentInserts, shownNotices } from "./consent.server";
import { activeHold } from "./content-holds.server";
import type { Database } from "./db.server";
import { sendEmail } from "./email.server";
import type { EvidenceFile } from "./evidence-file";
import { itemPath } from "./item-paths";
import { quarantineFile } from "./media.server";
import { type Actor, CASE_HANDLER, can } from "./permissions";
import { publicItemChanged } from "./public-change.server";
import { signToken, verifyToken } from "./signed-tokens.server";
import { requireStaff } from "./staff.server";
import { activeHolders } from "./staff-roles.server";

/**
 * The Case queue (CONTEXT.md, Case; SAFE-01–03, DATA-03). A visitor's report or rights concern, or
 * a person's data request, becomes a Case that only the role handling its kind can open: the
 * safeguarding lead for reports and rights concerns, the privacy contact for data requests. An
 * administrator can't read one. Every view and change is audited. The case team triages it, acts
 * on it (hiding the content while it is reviewed if need be), and the person can appeal the
 * decision once, to someone other than whoever made it.
 */

export type CaseRow = typeof caseRecord.$inferSelect;

const APPEAL = "case-appeal";

/** A Case's short reference, as the person and staff quote it. */
export const caseReference = (id: string) => id.slice(0, 8).toUpperCase();

/** The kinds of Case an actor may open. */
export const readableKinds = (actor: Actor) =>
  (Object.keys(CASE_KINDS) as CaseKind[]).filter((kind) => can(actor, { action: "case.read", case: { kind } }));

/** The staff gate plus the check that this person handles at least one kind of Case. */
export async function requireCaseTeam(env: Env, request: Request) {
  const staff = await requireStaff(env, request);
  const kinds = readableKinds(staff.actor);
  if (!kinds.length)
    throw new Response("Only the safeguarding lead and the privacy contact can open Cases.", { status: 403 });
  return { ...staff, kinds };
}

/** Where staff open a Case, for the emails that tell them about it. */
function adminCaseUrl(env: Env, origin: string, id: string) {
  return `${new URL(origin).protocol}//${env.ADMIN_HOSTNAME}/admin/cases/${id}`;
}

/** Tells the people who handle a kind of Case that one needs them, without saying what is in it. */
async function notifyHandlers(env: Env, db: Database, kind: CaseKind, subject: string, link: string, except?: string) {
  const handlers = await activeHolders(db, CASE_HANDLER[kind]);
  for (const handler of handlers) {
    if (handler.id === except) continue;
    await sendEmail(env, {
      to: handler.email,
      subject,
      text: `${subject}. Open it in the staff area (its contents aren't sent by email):\n\n${link}`,
    }).catch((error) => console.error("Case notification failed", handler.id, error));
  }
}

export type OpenResult = { ok: true; id: string; reference: string } | { ok: false; error: string };

const FORM_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The Case a form key already opened. A form sent twice is answered from this before Turnstile,
 * which never accepts the same token twice (as for Submissions).
 */
export async function alreadyOpened(db: Database, formKey: string): Promise<OpenResult | null> {
  if (!FORM_KEY.test(formKey)) return null;
  const found = await db.select({ id: caseRecord.id }).from(caseRecord).where(eq(caseRecord.formKey, formKey)).get();
  return found ? { ok: true, id: found.id, reference: caseReference(found.id) } : null;
}

/**
 * Opens a Case from the public report form or the privacy route, with any consent given. The
 * item it is about must exist; the person is told its reference if they left an address.
 */
export async function openCase(
  env: Env,
  db: Database,
  input: CaseReport | CaseDataRequest,
  formKey: string,
  origin: string,
  now = new Date(),
): Promise<OpenResult> {
  if (!FORM_KEY.test(formKey)) return { ok: false, error: "Reload the page and send the form again." };
  const sent = await alreadyOpened(db, formKey);
  if (sent) return sent;
  const contentItemId = "contentItemId" in input ? input.contentItemId : null;
  if (contentItemId) {
    const item = await db
      .select({ id: contentItem.id })
      .from(contentItem)
      .where(eq(contentItem.id, contentItemId))
      .get();
    if (!item)
      return { ok: false, error: "We couldn't find what you're reporting. Go back to it and use its link again." };
  }
  if (!(await shownNotices(db, input.consents))) {
    return { ok: false, error: "The wording you agreed to couldn't be found. Reload the page and send it again." };
  }
  const id = crypto.randomUUID();
  const consents = input.email
    ? consentInserts(db, input.consents, {
        email: input.email,
        sourceForm: input.kind === "data_request" ? "data_request" : "report",
        submissionId: null,
        at: now,
      })
    : [];
  try {
    await db.batch([
      db.insert(caseRecord).values({
        id,
        kind: input.kind,
        formKey,
        reason: input.reason,
        details: input.details,
        contentItemId,
        affectedPerson: input.kind === "data_request" ? input.name : "",
        reporterName: input.name,
        reporterEmail: input.email,
        receivedAt: now,
        updatedAt: now,
      }),
      ...consents.map((consent) => consent.insert),
      auditInsert(db, {
        actorId: null,
        action: "case.received",
        objectType: "case",
        objectId: id,
        details: { kind: input.kind },
      }),
    ]);
  } catch (error) {
    // The same form sent again while the first was still being stored.
    const stored = await alreadyOpened(db, formKey);
    if (stored) return stored;
    throw error;
  }
  const reference = caseReference(id);
  await notifyHandlers(
    env,
    db,
    input.kind,
    `A new ${CASE_KINDS[input.kind].toLowerCase()} (${reference})`,
    adminCaseUrl(env, origin, id),
  );
  if (input.email) {
    await sendEmail(env, {
      to: input.email,
      subject: `We've received your ${CASE_KINDS[input.kind].toLowerCase()} (${reference})`,
      text: [
        `Bula${input.name ? ` ${input.name}` : ""},`,
        `Thank you. Na iSema has received your ${CASE_KINDS[input.kind].toLowerCase()}, reference ${reference}. Only the people who handle these can read it.`,
        "We'll email you when we've decided what to do, and you can ask for that decision to be looked at again.",
        "Vinaka,\nNa iSema",
      ].join("\n\n"),
    }).catch((error) => console.error("Case acknowledgement failed", id, error));
  }
  return { ok: true, id, reference };
}

// --- The staff queue ---

/** Cases of the kinds the actor may open: open ones oldest first, or the most recently closed. */
export async function caseQueue(db: Database, kinds: CaseKind[], show: "open" | "closed") {
  if (!kinds.length) return [];
  const rows = await db
    .select({ case: caseRecord, ownerName: user.name })
    .from(caseRecord)
    .leftJoin(user, eq(user.id, caseRecord.ownerId))
    .where(
      and(
        inArray(caseRecord.kind, kinds),
        show === "open" ? ne(caseRecord.state, "closed") : eq(caseRecord.state, "closed"),
      ),
    )
    .orderBy(show === "open" ? asc(caseRecord.receivedAt) : desc(caseRecord.closedAt))
    .limit(200);
  return rows.map((row) => ({ ...row.case, ownerName: row.ownerName }));
}

/** A Case the actor may open, or the response that says why not. Opening it is audited. */
export async function openCaseFor(db: Database, actor: Actor, id: string) {
  const found = await db.select().from(caseRecord).where(eq(caseRecord.id, id)).get();
  if (!found) throw new Response("Not found", { status: 404 });
  if (!can(actor, { action: "case.read", case: { kind: found.kind } })) {
    await recordAudit(db, { actorId: actor.userId, action: "case.refused", objectType: "case", objectId: id });
    throw new Response("You don't handle this kind of Case.", { status: 403 });
  }
  return found;
}

/** Everything the case team sees on a Case's page. Records that it was viewed. */
export async function caseDetail(db: Database, actor: Actor, id: string, now = new Date()) {
  const found = await openCaseFor(db, actor, id);
  await recordAudit(db, { actorId: actor.userId, action: "case.viewed", objectType: "case", objectId: id });
  const [item, evidence, holds, handlers, people] = await Promise.all([
    found.contentItemId
      ? db.select().from(contentItem).where(eq(contentItem.id, found.contentItemId)).get()
      : Promise.resolve(undefined),
    db
      .select({ asset: mediaAsset, addedAt: caseEvidence.addedAt })
      .from(caseEvidence)
      .innerJoin(mediaAsset, eq(mediaAsset.id, caseEvidence.assetId))
      .where(eq(caseEvidence.caseId, id))
      .orderBy(asc(caseEvidence.addedAt)),
    db.select().from(contentHold).where(eq(contentHold.caseId, id)).orderBy(asc(contentHold.placedAt)),
    activeHolders(db, CASE_HANDLER[found.kind]),
    db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(
        inArray(
          user.id,
          [found.ownerId, found.decidedBy, found.appealDecidedBy].filter((value): value is string => value !== null),
        ),
      ),
  ]);
  // A data request is about what Na iSema holds for the address: show the privacy contact where to look.
  const held =
    found.kind === "data_request" && found.reporterEmail
      ? await Promise.all([
          db
            .select({ id: submission.id, type: submission.type, receivedAt: submission.receivedAt })
            .from(submission)
            .where(eq(submission.email, found.reporterEmail)),
          db
            .select({
              id: consentRecord.id,
              purpose: consentRecord.purpose,
              givenAt: consentRecord.givenAt,
              withdrawnAt: consentRecord.withdrawnAt,
            })
            .from(consentRecord)
            .where(eq(consentRecord.email, found.reporterEmail)),
        ]).then(([submissions, consents]) => ({ submissions, consents }))
      : null;
  const name = (userId: string | null) => people.find((person) => person.id === userId)?.email ?? null;
  return {
    case: found,
    reference: caseReference(found.id),
    item: item ? { id: item.id, path: itemPath(item), state: item.publicationState } : null,
    hidden: Boolean(holds.find((hold) => !hold.liftedAt)),
    holds,
    evidence: evidence.map((row) => ({ ...row.asset, addedAt: row.addedAt })),
    handlers,
    ownerEmail: name(found.ownerId),
    decidedByEmail: name(found.decidedBy),
    appealDecidedByEmail: name(found.appealDecidedBy),
    appealOpen: appealOpen(found, now),
    held,
    can: {
      act: can(actor, { action: "case.act", case: { kind: found.kind } }),
      hide: can(actor, { action: "content.hidePendingReview" }) && Boolean(item),
      decideAppeal: found.decidedBy
        ? can(actor, { action: "case.decideAppeal", case: { kind: found.kind, decidedBy: found.decidedBy } })
        : false,
    },
  };
}

export type CaseChange = { ok: true } | { ok: false; error: string };

/** The Case, if the actor may act on it and it can move to `to`. */
async function movable(db: Database, actor: Actor, id: string, to: CaseState): Promise<CaseRow | string> {
  const found = await openCaseFor(db, actor, id);
  if (!can(actor, { action: "case.act", case: { kind: found.kind } })) return "You can't act on this kind of Case.";
  if (!canMove(found.state, to)) return `A ${found.state} Case can't be ${to} now.`;
  return found;
}

/** Triage: how serious it is, who owns it, and who it affects. */
export async function triageCase(
  db: Database,
  actor: Actor,
  id: string,
  triage: { severity: Severity; ownerId: string; affectedPerson: string },
): Promise<CaseChange> {
  const found = await movable(db, actor, id, "triaged");
  if (typeof found === "string") return { ok: false, error: found };
  const now = new Date();
  await db.batch([
    db
      .update(caseRecord)
      .set({ state: "triaged", ...triage, updatedAt: now })
      .where(and(eq(caseRecord.id, id), eq(caseRecord.state, "received"))),
    auditInsert(db, {
      actorId: actor.userId,
      action: "case.triaged",
      objectType: "case",
      objectId: id,
      details: { severity: triage.severity, ownerId: triage.ownerId },
    }),
  ]);
  return { ok: true };
}

/** A signed link the person uses to appeal the decision, without an account. */
const appealLink = async (env: Env, origin: string, id: string) =>
  `${origin}/cases/appeal/${await signToken(env.BETTER_AUTH_SECRET, APPEAL, id)}`;

/** The Case an appeal link is for, or null for a link that isn't one. */
export async function caseForAppealLink(env: Env, db: Database, token: string) {
  const id = await verifyToken(env.BETTER_AUTH_SECRET, APPEAL, token);
  if (!id) return null;
  return (await db.select().from(caseRecord).where(eq(caseRecord.id, id)).get()) ?? null;
}

/** Records the decision, and tells the person the outcome and how to appeal. */
export async function decideCase(
  env: Env,
  db: Database,
  actor: Actor,
  id: string,
  decision: { outcome: CaseOutcome; action: string; rationale: string },
  origin: string,
): Promise<CaseChange> {
  const found = await movable(db, actor, id, "actioned");
  if (typeof found === "string") return { ok: false, error: found };
  const now = new Date();
  await db.batch([
    db
      .update(caseRecord)
      .set({ state: "actioned", ...decision, decidedBy: actor.userId, decidedAt: now, updatedAt: now })
      .where(and(eq(caseRecord.id, id), eq(caseRecord.state, "triaged"))),
    auditInsert(db, {
      actorId: actor.userId,
      action: "case.actioned",
      objectType: "case",
      objectId: id,
      details: { outcome: decision.outcome },
    }),
  ]);
  if (found.reporterEmail) {
    const reference = caseReference(id);
    await sendEmail(env, {
      to: found.reporterEmail,
      subject: `What we decided about your ${CASE_KINDS[found.kind].toLowerCase()} (${reference})`,
      text: [
        `Bula${found.reporterName ? ` ${found.reporterName}` : ""},`,
        `${outcomesFor(found.kind)[decision.outcome]}.`,
        `If you disagree, you can ask for this decision to be looked at again by someone who didn't make it. Do that within 30 days with this link:\n${await appealLink(env, origin, id)}`,
        "Vinaka,\nNa iSema",
      ].join("\n\n"),
    }).catch((error) => console.error("Case decision email failed", id, error));
  }
  return { ok: true };
}

/** Closes a decided Case. It can still be appealed within the appeal period. */
export async function closeCase(db: Database, actor: Actor, id: string): Promise<CaseChange> {
  const found = await movable(db, actor, id, "closed");
  if (typeof found === "string") return { ok: false, error: found };
  if (found.state !== "actioned") return { ok: false, error: "An appeal is closed by deciding it." };
  const now = new Date();
  await db.batch([
    db.update(caseRecord).set({ state: "closed", closedAt: now, updatedAt: now }).where(eq(caseRecord.id, id)),
    auditInsert(db, { actorId: actor.userId, action: "case.closed", objectType: "case", objectId: id }),
  ]);
  return { ok: true };
}

/**
 * Records an appeal: from the person's own link (`actor` null) or, when they appealed another way
 * (a reply, a phone call, the affected creator), by the case team on their behalf. Everyone who
 * handles the kind except the decision's maker is told.
 */
export async function appealCase(
  env: Env,
  db: Database,
  found: CaseRow,
  reasons: string,
  actor: Actor | null,
  origin: string,
  now = new Date(),
): Promise<CaseChange> {
  if (actor && !can(actor, { action: "case.act", case: { kind: found.kind } })) {
    return { ok: false, error: "You can't act on this kind of Case." };
  }
  if (!appealOpen(found, now)) return { ok: false, error: "This decision can no longer be appealed." };
  const moved = await db.batch([
    db
      .update(caseRecord)
      .set({ state: "appealed", appealReasons: reasons, appealedAt: now, closedAt: null, updatedAt: now })
      .where(and(eq(caseRecord.id, found.id), isNull(caseRecord.appealedAt)))
      .returning({ id: caseRecord.id }),
    auditInsert(db, {
      actorId: actor?.userId ?? null,
      action: "case.appealed",
      objectType: "case",
      objectId: found.id,
      details: { via: actor ? "staff" : "link" },
    }),
  ]);
  if (!moved[0].length) return { ok: false, error: "This decision has already been appealed." };
  await notifyHandlers(
    env,
    db,
    found.kind,
    `An appeal on ${CASE_KINDS[found.kind].toLowerCase()} ${caseReference(found.id)} needs someone who didn't decide it`,
    adminCaseUrl(env, origin, found.id),
    found.decidedBy ?? undefined,
  );
  return { ok: true };
}

/** Decides an appeal, which only someone other than the original decision's maker can do; closes the Case. */
export async function decideAppeal(
  env: Env,
  db: Database,
  actor: Actor,
  id: string,
  decision: { outcome: AppealOutcome; rationale: string },
): Promise<CaseChange> {
  const found = await movable(db, actor, id, "closed");
  if (typeof found === "string") return { ok: false, error: found };
  if (found.state !== "appealed" || !found.decidedBy) return { ok: false, error: "There's no appeal to decide." };
  if (!can(actor, { action: "case.decideAppeal", case: { kind: found.kind, decidedBy: found.decidedBy } })) {
    return { ok: false, error: "You made the decision being appealed, so someone else must decide the appeal." };
  }
  const now = new Date();
  await db.batch([
    db
      .update(caseRecord)
      .set({
        state: "closed",
        appealOutcome: decision.outcome,
        appealRationale: decision.rationale,
        appealDecidedBy: actor.userId,
        appealDecidedAt: now,
        closedAt: now,
        updatedAt: now,
      })
      .where(and(eq(caseRecord.id, id), eq(caseRecord.state, "appealed"))),
    auditInsert(db, {
      actorId: actor.userId,
      action: "case.appeal_decided",
      objectType: "case",
      objectId: id,
      details: { outcome: decision.outcome },
    }),
  ]);
  if (found.reporterEmail) {
    await sendEmail(env, {
      to: found.reporterEmail,
      subject: `Your appeal (${caseReference(id)})`,
      text: [
        `Bula${found.reporterName ? ` ${found.reporterName}` : ""},`,
        `Someone who didn't make the first decision has looked at it again. ${APPEAL_OUTCOMES[decision.outcome]}.`,
        "Vinaka,\nNa iSema",
      ].join("\n\n"),
    }).catch((error) => console.error("Appeal decision email failed", id, error));
  }
  return { ok: true };
}

// --- Hiding content pending review ---

/** Hides the Case's content from the public until the hold is lifted (SAFE-03). */
export async function hideContent(env: Env, db: Database, actor: Actor, id: string): Promise<CaseChange> {
  const found = await openCaseFor(db, actor, id);
  if (
    !can(actor, { action: "content.hidePendingReview" }) ||
    !can(actor, { action: "case.act", case: { kind: found.kind } })
  ) {
    return { ok: false, error: "Only the safeguarding lead can hide content pending review." };
  }
  if (!found.contentItemId) return { ok: false, error: "This Case isn't about a piece of content." };
  if (await activeHold(db, found.contentItemId)) return { ok: false, error: "It is already hidden." };
  await db.batch([
    db.insert(contentHold).values({
      id: crypto.randomUUID(),
      contentItemId: found.contentItemId,
      caseId: id,
      placedBy: actor.userId,
      placedAt: new Date(),
    }),
    auditInsert(db, {
      actorId: actor.userId,
      action: "content.hidden_pending_review",
      objectType: "content_item",
      objectId: found.contentItemId,
      details: { caseId: id },
    }),
  ]);
  await publicItemChanged(env, db, found.contentItemId);
  return { ok: true };
}

/** Lifts the hold, so the content is public again if it is otherwise eligible. */
export async function showContent(env: Env, db: Database, actor: Actor, id: string): Promise<CaseChange> {
  const found = await openCaseFor(db, actor, id);
  if (
    !can(actor, { action: "content.hidePendingReview" }) ||
    !can(actor, { action: "case.act", case: { kind: found.kind } })
  ) {
    return { ok: false, error: "Only the safeguarding lead can show hidden content again." };
  }
  if (!found.contentItemId) return { ok: false, error: "This Case isn't about a piece of content." };
  const hold = await activeHold(db, found.contentItemId);
  if (!hold) return { ok: false, error: "It isn't hidden." };
  await db.batch([
    db
      .update(contentHold)
      .set({ liftedBy: actor.userId, liftedAt: new Date() })
      .where(and(eq(contentHold.id, hold.id), isNull(contentHold.liftedAt))),
    auditInsert(db, {
      actorId: actor.userId,
      action: "content.shown_after_review",
      objectType: "content_item",
      objectId: found.contentItemId,
      details: { caseId: id },
    }),
  ]);
  await publicItemChanged(env, db, found.contentItemId);
  return { ok: true };
}

// --- Restricted evidence ---

/** Adds restricted evidence to a Case. It is quarantined and scanned before anyone can open it. */
export async function addCaseEvidence(
  env: Env,
  db: Database,
  actor: Actor,
  id: string,
  file: EvidenceFile,
): Promise<CaseChange> {
  const found = await openCaseFor(db, actor, id);
  if (!can(actor, { action: "case.act", case: { kind: found.kind } }))
    return { ok: false, error: "You can't act on this kind of Case." };
  const asset = await quarantineFile(env, db, actor.userId, file, "evidence");
  await db.batch([
    db.insert(caseEvidence).values({ assetId: asset.id, caseId: id, addedBy: actor.userId, addedAt: new Date() }),
    auditInsert(db, {
      actorId: actor.userId,
      action: "case.evidence_added",
      objectType: "case",
      objectId: id,
      details: { assetId: asset.id },
    }),
  ]);
  return { ok: true };
}

/** A Case's evidence file for the case team, once it has passed its scan. Every read is audited. */
export async function readCaseEvidence(env: Env, db: Database, actor: Actor, id: string, assetId: string) {
  await openCaseFor(db, actor, id);
  const row = await db
    .select({ asset: mediaAsset })
    .from(caseEvidence)
    .innerJoin(mediaAsset, eq(mediaAsset.id, caseEvidence.assetId))
    .where(and(eq(caseEvidence.caseId, id), eq(caseEvidence.assetId, assetId)))
    .get();
  if (!row) return null;
  if (row.asset.status !== "ready") {
    return {
      unavailable: row.asset.statusReason ?? "This evidence is still being scanned for viruses. Try again shortly.",
    };
  }
  const object = await env.EVIDENCE.get(row.asset.destinationKey);
  if (!object) return null;
  await recordAudit(db, {
    actorId: actor.userId,
    action: "case.evidence_read",
    objectType: "case",
    objectId: id,
    details: { assetId },
  });
  return { object, name: row.asset.name, type: row.asset.type };
}
