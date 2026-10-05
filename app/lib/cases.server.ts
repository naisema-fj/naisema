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
import { adminUrl } from "./admin-url";
import { auditInsert, recordAudit } from "./audit.server";
import {
  APPEAL_DAYS,
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
  caseSourceForm,
  outcomeText,
  type Severity,
} from "./case-rules";
import { consentInserts, shownNotices } from "./consent.server";
import { activeHold } from "./content-holds.server";
import type { Database } from "./db.server";
import { letterText, sendEmail } from "./email.server";
import type { EvidenceFile } from "./evidence-file";
import { itemPath } from "./item-paths";
import { logError } from "./log.server";
import { quarantineFile } from "./media.server";
import { mediaPaths } from "./media-delivery.server";
import { type Actor, CASE_HANDLER, can } from "./permissions";
import { publicItemChanged } from "./public-change.server";
import { loadReview } from "./review.server";
import { signToken, verifyToken } from "./signed-tokens.server";
import { requireStaff } from "./staff.server";
import { activeHolders } from "./staff-roles.server";

/**
 * The Case queue (CONTEXT.md, Case; SAFE-01–03, DATA-03). A visitor's report or rights concern, or
 * a person's data request, becomes a Case that only the role handling its kind can open: the
 * safeguarding lead for reports and rights concerns, the privacy contact for data requests. An
 * administrator can't read one. Every view and change is audited. The case team triages it, acts
 * on it (holding the content back while it is reviewed if need be), and the person can appeal the
 * decision once, to someone other than whoever made it.
 *
 * A change of state is made only from the state it expects, and audited only when it happened
 * (as scan.server.ts settles uploads), so two people acting at once can't both succeed.
 */

export type CaseRow = typeof caseRecord.$inferSelect;
export type CaseChange = { ok: true } | { ok: false; error: string };

const APPEAL = "case-appeal";

/** A Case's short reference, as the person and staff quote it. */
export const caseReference = (id: string) => id.slice(0, 8).toUpperCase();

/** The kinds of Case an actor may open. */
export const readableKinds = (actor: Actor) =>
  (Object.keys(CASE_KINDS) as CaseKind[]).filter((kind) => can(actor, { action: "case.read", case: { kind } }));

/**
 * The staff gate plus the check that this person handles at least one kind of Case. A refusal is
 * audited, against the Case asked for when there is one.
 */
export async function requireCaseTeam(env: Env, request: Request, caseId: string | null = null) {
  const staff = await requireStaff(env, request);
  const kinds = readableKinds(staff.actor);
  if (!kinds.length) {
    await recordAudit(staff.db, {
      actorId: staff.actor.userId,
      action: "case.refused",
      objectType: "case",
      objectId: caseId,
    });
    throw new Response("Only the safeguarding lead and the privacy contact can open Cases.", { status: 403 });
  }
  return { ...staff, kinds };
}

/** The people who handle a kind of Case: the only possible owners, and who is told about it. */
export const caseHandlers = (db: Database, kind: CaseKind) => activeHolders(db, CASE_HANDLER[kind]);

/** Tells the people who handle a kind of Case that one needs them, without saying what is in it. */
async function notifyHandlers(
  env: Env,
  db: Database,
  found: { id: string; kind: CaseKind },
  subject: string,
  except?: string,
) {
  const link = adminUrl(env, `/admin/cases/${found.id}`);
  for (const handler of await caseHandlers(db, found.kind)) {
    if (handler.id === except) continue;
    await sendEmail(env, {
      to: handler.email,
      subject,
      text: `${subject}. Open it in the staff area (its contents aren't sent by email):\n\n${link}`,
    }).catch((error) => logError("Case notification failed", { staffId: handler.id, error }));
  }
}

/** Emails the person who opened a Case, if they left an address. Never fails the change it follows. */
async function tellReporter(
  env: Env,
  found: Pick<CaseRow, "id" | "reporterEmail" | "reporterName">,
  subject: string,
  paragraphs: string[],
) {
  if (!found.reporterEmail) return;
  await sendEmail(env, {
    to: found.reporterEmail,
    subject: `${subject} (${caseReference(found.id)})`,
    text: letterText(found.reporterName, paragraphs),
  }).catch((error) => logError("Case email failed", { caseId: found.id, error }));
}

export type ReceiveResult = { ok: true; id: string; reference: string } | { ok: false; error: string };

const FORM_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The Case a form key already opened. A form sent twice is answered from this before Turnstile,
 * which never accepts the same token twice (as for Submissions).
 */
export async function alreadyReceived(db: Database, formKey: string): Promise<ReceiveResult | null> {
  if (!FORM_KEY.test(formKey)) return null;
  const found = await db.select({ id: caseRecord.id }).from(caseRecord).where(eq(caseRecord.formKey, formKey)).get();
  return found ? { ok: true, id: found.id, reference: caseReference(found.id) } : null;
}

/**
 * Receives a Case from the public report form or the privacy route, with any consent given. The
 * item it is about must exist; the person is told its reference if they left an address.
 */
export async function receiveCase(
  env: Env,
  db: Database,
  input: CaseReport | CaseDataRequest,
  formKey: string,
  now = new Date(),
): Promise<ReceiveResult> {
  if (!FORM_KEY.test(formKey)) return { ok: false, error: "Reload the page and send the form again." };
  const sent = await alreadyReceived(db, formKey);
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
        sourceForm: caseSourceForm(input.kind),
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
        // Who a data request is about is the person asking; a report's, the case team decides.
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
    const stored = await alreadyReceived(db, formKey);
    if (stored) return stored;
    throw error;
  }
  const reference = caseReference(id);
  const kindName = CASE_KINDS[input.kind].toLowerCase();
  await notifyHandlers(env, db, { id, kind: input.kind }, `A new ${kindName} (${reference})`);
  await tellReporter(
    env,
    { id, reporterEmail: input.email, reporterName: input.name },
    `We've received your ${kindName}`,
    [
      `Thank you. Na iSema has received your ${kindName}, reference ${reference}. Only the people who handle these can read it.`,
      "We'll email you when we've decided what to do, and you can ask for that decision to be looked at again.",
    ],
  );
  return { ok: true, id, reference };
}

// --- The staff queue ---

/** Cases of the kinds the actor may open: open ones oldest first, or the most recently closed. Audited. */
export async function caseQueue(db: Database, actor: Actor, kinds: CaseKind[], show: "open" | "closed") {
  await recordAudit(db, { actorId: actor.userId, action: "case.queue_viewed", objectType: "case", details: { show } });
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

/** A Case the actor handles, or the response that says why not; a refusal is audited. */
export async function handledCase(db: Database, actor: Actor, id: string) {
  const found = await db.select().from(caseRecord).where(eq(caseRecord.id, id)).get();
  if (!found) throw new Response("Not found", { status: 404 });
  if (!can(actor, { action: "case.read", case: { kind: found.kind } })) {
    await recordAudit(db, { actorId: actor.userId, action: "case.refused", objectType: "case", objectId: id });
    throw new Response("You don't handle this kind of Case.", { status: 403 });
  }
  return found;
}

/** Whether the actor may hold back, or release, a Case's content: the safeguarding lead, on a Case they handle. */
const canHold = (actor: Actor, kind: CaseKind) =>
  can(actor, { action: "content.hidePendingReview" }) && can(actor, { action: "case.act", case: { kind } });

/** Everything the case team sees on a Case's page. Records that it was viewed. */
export async function caseDetail(db: Database, actor: Actor, id: string, now = new Date()) {
  const found = await handledCase(db, actor, id);
  await recordAudit(db, { actorId: actor.userId, action: "case.viewed", objectType: "case", objectId: id });
  const [item, evidence, itemHold, handlers, people] = await Promise.all([
    found.contentItemId
      ? db.select().from(contentItem).where(eq(contentItem.id, found.contentItemId)).get()
      : undefined,
    db
      .select({ asset: mediaAsset, addedAt: caseEvidence.addedAt })
      .from(caseEvidence)
      .innerJoin(mediaAsset, eq(mediaAsset.id, caseEvidence.assetId))
      .where(eq(caseEvidence.caseId, id))
      .orderBy(asc(caseEvidence.addedAt)),
    found.contentItemId ? activeHold(db, found.contentItemId) : null,
    caseHandlers(db, found.kind),
    db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(
        inArray(
          user.id,
          [found.ownerId, found.decidedBy, found.appealDecidedBy].filter((value): value is string => value !== null),
        ),
      ),
  ]);
  // A data request is about what Na iSema holds for the address: show the privacy contact where to look.
  const requesterData =
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
  const emailOf = (userId: string | null) => people.find((person) => person.id === userId)?.email ?? null;
  return {
    case: found,
    reference: caseReference(found.id),
    item: item ? { id: item.id, path: itemPath(item), state: item.publicationState } : null,
    /** Whether the content is held back, and whether by this Case or another. */
    hold: itemHold ? (itemHold.caseId === id ? ("this" as const) : ("another" as const)) : null,
    evidence: evidence.map((row) => ({ ...row.asset, addedAt: row.addedAt })),
    handlers,
    ownerEmail: emailOf(found.ownerId),
    decidedByEmail: emailOf(found.decidedBy),
    appealDecidedByEmail: emailOf(found.appealDecidedBy),
    appealOpen: appealOpen(found, now),
    requesterData,
    can: {
      act: can(actor, { action: "case.act", case: { kind: found.kind } }),
      hold: canHold(actor, found.kind) && Boolean(item),
      decideAppeal: found.decidedBy
        ? can(actor, { action: "case.decideAppeal", case: { kind: found.kind, decidedBy: found.decidedBy } })
        : false,
    },
  };
}

/** The Case, if the actor may act on it and it can move to `to`; otherwise why not. */
async function movable(db: Database, actor: Actor, id: string, to: CaseState): Promise<CaseRow | string> {
  const found = await handledCase(db, actor, id);
  if (!can(actor, { action: "case.act", case: { kind: found.kind } })) return "You can't act on this kind of Case.";
  if (!canMove(found.state, to)) return `A ${found.state} Case can't be ${to} now.`;
  return found;
}

/**
 * Moves a Case from `from` to the values given, only if it is still in `from`, and audits the move
 * only if it happened. False when someone else changed it first.
 */
async function moveCase(
  db: Database,
  id: string,
  from: CaseState,
  values: Partial<typeof caseRecord.$inferInsert>,
  audit: { actorId: string | null; action: string; details?: Record<string, unknown> },
) {
  const moved = await db
    .update(caseRecord)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(caseRecord.id, id), eq(caseRecord.state, from)))
    .returning({ id: caseRecord.id });
  if (!moved.length) return false;
  await recordAudit(db, { ...audit, objectType: "case", objectId: id });
  return true;
}

const CHANGED_ELSEWHERE: CaseChange = { ok: false, error: "Someone else changed this Case first. Look at it again." };

/** Triage: how serious it is, who owns it, and who it affects. */
export async function triageCase(
  db: Database,
  actor: Actor,
  id: string,
  triage: { severity: Severity; ownerId: string; affectedPerson: string },
): Promise<CaseChange> {
  const found = await movable(db, actor, id, "triaged");
  if (typeof found === "string") return { ok: false, error: found };
  const moved = await moveCase(
    db,
    id,
    "received",
    { state: "triaged", ...triage },
    {
      actorId: actor.userId,
      action: "case.triaged",
      details: { severity: triage.severity, ownerId: triage.ownerId },
    },
  );
  return moved ? { ok: true } : CHANGED_ELSEWHERE;
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
  const moved = await moveCase(
    db,
    id,
    "triaged",
    { state: "actioned", ...decision, decidedBy: actor.userId, decidedAt: new Date() },
    { actorId: actor.userId, action: "case.actioned", details: { outcome: decision.outcome } },
  );
  if (!moved) return CHANGED_ELSEWHERE;
  await tellReporter(env, found, `What we decided about your ${CASE_KINDS[found.kind].toLowerCase()}`, [
    `${outcomeText(found.kind, decision.outcome)}.`,
    `If you disagree, you can ask for this decision to be looked at again by someone who didn't make it. Do that within ${APPEAL_DAYS} days with this link:\n${await appealLink(env, origin, id)}`,
  ]);
  return { ok: true };
}

/** Closes a decided Case. It can still be appealed within the appeal period. */
export async function closeCase(db: Database, actor: Actor, id: string): Promise<CaseChange> {
  const found = await movable(db, actor, id, "closed");
  if (typeof found === "string") return { ok: false, error: found };
  if (found.state !== "actioned") return { ok: false, error: "An appeal is closed by deciding it." };
  const moved = await moveCase(
    db,
    id,
    "actioned",
    { state: "closed", closedAt: new Date() },
    {
      actorId: actor.userId,
      action: "case.closed",
    },
  );
  return moved ? { ok: true } : CHANGED_ELSEWHERE;
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
  now = new Date(),
): Promise<CaseChange> {
  if (actor && !can(actor, { action: "case.act", case: { kind: found.kind } })) {
    return { ok: false, error: "You can't act on this kind of Case." };
  }
  if (!appealOpen(found, now)) return { ok: false, error: "This decision can no longer be appealed." };
  const moved = await moveCase(
    db,
    found.id,
    found.state,
    { state: "appealed", appealReasons: reasons, appealedAt: now, closedAt: null },
    { actorId: actor?.userId ?? null, action: "case.appealed", details: { via: actor ? "staff" : "link" } },
  );
  if (!moved) return { ok: false, error: "This decision has already been appealed." };
  await notifyHandlers(
    env,
    db,
    found,
    `An appeal on ${CASE_KINDS[found.kind].toLowerCase()} ${caseReference(found.id)} needs someone who didn't decide it`,
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
  const moved = await moveCase(
    db,
    id,
    "appealed",
    {
      state: "closed",
      appealOutcome: decision.outcome,
      appealRationale: decision.rationale,
      appealDecidedBy: actor.userId,
      appealDecidedAt: now,
      closedAt: now,
    },
    { actorId: actor.userId, action: "case.appeal_decided", details: { outcome: decision.outcome } },
  );
  if (!moved) return CHANGED_ELSEWHERE;
  await tellReporter(env, found, "Your appeal", [
    `Someone who didn't make the first decision has looked at it again. ${APPEAL_OUTCOMES[decision.outcome]}.`,
  ]);
  return { ok: true };
}

// --- Holding content back pending review ---

/** The public addresses of the media library files an item's published Revision uses. */
async function publishedMediaPaths(db: Database, contentItemId: string) {
  const item = await db.select().from(contentItem).where(eq(contentItem.id, contentItemId)).get();
  const review = item?.currentPublishedRevisionId ? await loadReview(db, item.currentPublishedRevisionId) : null;
  return (review?.mediaAssetIds ?? []).flatMap(mediaPaths);
}

/** Holds the Case's content back from the public, its media files too, until the hold is lifted (SAFE-03). */
export async function hideContent(env: Env, db: Database, actor: Actor, id: string): Promise<CaseChange> {
  const found = await handledCase(db, actor, id);
  if (!canHold(actor, found.kind))
    return { ok: false, error: "Only the safeguarding lead can hide content pending review." };
  if (!found.contentItemId) return { ok: false, error: "This Case isn't about a piece of content." };
  try {
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
  } catch (error) {
    // At most one hold per item (content_hold_active_idx): someone hid it first.
    if (await activeHold(db, found.contentItemId)) return { ok: false, error: "It is already hidden." };
    throw error;
  }
  await publicItemChanged(env, db, found.contentItemId, await publishedMediaPaths(db, found.contentItemId));
  return { ok: true };
}

/** Lifts this Case's hold, so the content is public again if it is otherwise eligible. */
export async function showContent(env: Env, db: Database, actor: Actor, id: string): Promise<CaseChange> {
  const found = await handledCase(db, actor, id);
  if (!canHold(actor, found.kind))
    return { ok: false, error: "Only the safeguarding lead can show hidden content again." };
  if (!found.contentItemId) return { ok: false, error: "This Case isn't about a piece of content." };
  const hold = await activeHold(db, found.contentItemId);
  if (!hold) return { ok: false, error: "It isn't hidden." };
  if (hold.caseId !== id) {
    return { ok: false, error: `Another Case (${caseReference(hold.caseId)}) is holding it back; lift it there.` };
  }
  const lifted = await db
    .update(contentHold)
    .set({ liftedBy: actor.userId, liftedAt: new Date() })
    .where(and(eq(contentHold.id, hold.id), isNull(contentHold.liftedAt)))
    .returning({ id: contentHold.id });
  if (!lifted.length) return { ok: false, error: "It isn't hidden." };
  await recordAudit(db, {
    actorId: actor.userId,
    action: "content.shown_after_review",
    objectType: "content_item",
    objectId: found.contentItemId,
    details: { caseId: id },
  });
  await publicItemChanged(env, db, found.contentItemId, await publishedMediaPaths(db, found.contentItemId));
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
  const found = await handledCase(db, actor, id);
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

/** A Case's evidence file for the case team, once it has passed its scan. Every attempt is audited. */
export async function readCaseEvidence(env: Env, db: Database, actor: Actor, id: string, assetId: string) {
  await handledCase(db, actor, id);
  const row = await db
    .select({ asset: mediaAsset })
    .from(caseEvidence)
    .innerJoin(mediaAsset, eq(mediaAsset.id, caseEvidence.assetId))
    .where(and(eq(caseEvidence.caseId, id), eq(caseEvidence.assetId, assetId)))
    .get();
  if (!row) return null;
  const ready = row.asset.status === "ready";
  const object = ready ? await env.EVIDENCE.get(row.asset.destinationKey) : null;
  await recordAudit(db, {
    actorId: actor.userId,
    action: "case.evidence_read",
    objectType: "case",
    objectId: id,
    details: { assetId, delivered: Boolean(object) },
  });
  if (!ready) {
    return {
      unavailable: row.asset.statusReason ?? "This evidence is still being scanned for viruses. Try again shortly.",
    };
  }
  return object ? { object, name: row.asset.name, type: row.asset.type } : null;
}
