import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { redirect } from "react-router";
import { auditEvent, roleAssignment, session as sessionTable, staffSession, user as userTable } from "~db/schema";
import { recordAudit } from "./audit.server";
import { type Auth, createAuth, sessionTokenFromSetCookie } from "./auth.server";
import { type Database, getDb } from "./db.server";
import { type Actor, can, type RoleAssignment } from "./permissions";
import { toRoleAssignment } from "./staff-roles.server";

export const ADMIN_PATHS = {
  home: "/admin",
  signIn: "/admin/sign-in",
  twoFactor: "/admin/two-factor",
  twoFactorSetup: "/admin/two-factor/setup",
} as const;

/** Sign-in links one address can be sent per window, so nobody can flood a staff inbox. */
export const MAGIC_LINKS_PER_WINDOW = 3;
const MAGIC_LINK_WINDOW_MS = 15 * 60 * 1000;

/** Wrong codes allowed per session before the session is ended (ADR-0013). */
export const MAX_TWO_FACTOR_ATTEMPTS = 5;

type SignedIn = {
  auth: Auth;
  db: Database;
  user: { id: string; email: string; name: string; twoFactorEnabled?: boolean | null };
  sessionId: string;
  verified: boolean;
};

export async function getSignedIn(env: Env, request: Request): Promise<SignedIn | null> {
  const auth = createAuth(env, request);
  const result = await auth.api.getSession({ headers: request.headers });
  if (!result) return null;
  const db = getDb(env.DB);
  const staffState = await db.select().from(staffSession).where(eq(staffSession.sessionId, result.session.id)).get();
  return { auth, db, user: result.user, sessionId: result.session.id, verified: Boolean(staffState?.verifiedAt) };
}

export async function activeRoles(db: Database, userId: string): Promise<RoleAssignment[]> {
  const rows = await db
    .select()
    .from(roleAssignment)
    .where(and(eq(roleAssignment.userId, userId), isNull(roleAssignment.revokedAt)));
  return rows.map(toRoleAssignment);
}

/**
 * Emails a sign-in link to a current staff member. Silently does nothing for unknown addresses,
 * accounts with no active role, or addresses that have hit the throttle, so the reply never
 * reveals which of those applied. Each link sent is audited, which is also the throttle's count.
 */
export async function requestStaffSignInLink(env: Env, request: Request, email: string): Promise<void> {
  const db = getDb(env.DB);
  const member = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, email)).get();
  if (!member || (await activeRoles(db, member.id)).length === 0) return;

  const recent = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditEvent)
    .where(
      and(
        eq(auditEvent.action, "magic_link.sent"),
        eq(auditEvent.objectId, member.id),
        gt(auditEvent.createdAt, new Date(Date.now() - MAGIC_LINK_WINDOW_MS)),
      ),
    )
    .get();
  if ((recent?.count ?? 0) >= MAGIC_LINKS_PER_WINDOW) return;

  await createAuth(env, request).api.signInMagicLink({
    body: { email, callbackURL: ADMIN_PATHS.home },
    headers: request.headers,
  });
  await recordAudit(db, { actorId: null, action: "magic_link.sent", objectType: "user", objectId: member.id });
}

type StaffStep = "signIn" | "twoFactorSetup" | "twoFactor" | "done";

/** Where a person is in the staff sign-in sequence: email link, then enrolment, then a code. */
export function staffStep(signedIn: SignedIn | null): StaffStep {
  if (!signedIn) return "signIn";
  if (!signedIn.user.twoFactorEnabled) return "twoFactorSetup";
  if (!signedIn.verified) return "twoFactor";
  return "done";
}

const STEP_PATHS: Record<StaffStep, string> = {
  signIn: ADMIN_PATHS.signIn,
  twoFactorSetup: ADMIN_PATHS.twoFactorSetup,
  twoFactor: ADMIN_PATHS.twoFactor,
  done: ADMIN_PATHS.home,
};

/** For the sign-in step pages: continue only if this is the person's current step, else send them on. */
export async function requireStaffStep(env: Env, request: Request, step: Exclude<StaffStep, "signIn" | "done">) {
  const signedIn = await getSignedIn(env, request);
  const current = staffStep(signedIn);
  if (current !== step || !signedIn) throw redirect(STEP_PATHS[current]);
  return signedIn;
}

/**
 * The staff gate. Returns an Actor whose roles are active only because this session has
 * signed in by magic link AND passed the two-factor check; otherwise redirects to the next step.
 */
export async function requireStaff(env: Env, request: Request) {
  const signedIn = await getSignedIn(env, request);
  const current = staffStep(signedIn);
  if (current !== "done" || !signedIn) throw redirect(STEP_PATHS[current]);

  const actor: Actor = { userId: signedIn.user.id, roles: await activeRoles(signedIn.db, signedIn.user.id) };
  if (!can(actor, { action: "staffArea.enter" })) {
    await recordAudit(signedIn.db, {
      actorId: signedIn.user.id,
      action: "staff_area.refused",
      objectType: "session",
      objectId: signedIn.sessionId,
    });
    throw new Response("This account has no staff access.", { status: 403 });
  }
  return { ...signedIn, actor };
}

export type CodeCheck =
  | { ok: true; headers: Headers }
  | { ok: false; reason: "invalid"; attemptsLeft: number }
  | { ok: false; reason: "locked" };

/**
 * Checks an authenticator code for the current session and records the outcome. Also completes
 * enrolment: on a user's first successful code Better Auth replaces the session, so the new
 * session is the one marked as verified and its cookie is returned to be sent to the browser.
 */
export async function checkStaffCode(signedIn: SignedIn, request: Request, code: string): Promise<CodeCheck> {
  const { auth, db, user, sessionId } = signedIn;
  let headers: Headers;
  try {
    ({ headers } = await auth.api.verifyTOTP({ headers: request.headers, body: { code }, returnHeaders: true }));
  } catch {
    const staffState = await db
      .insert(staffSession)
      .values({ sessionId, userId: user.id, failedAttempts: 1 })
      .onConflictDoUpdate({
        target: staffSession.sessionId,
        set: { failedAttempts: sql`${staffSession.failedAttempts} + 1` },
      })
      .returning()
      .get();
    await recordAudit(db, {
      actorId: user.id,
      action: "two_factor.failed",
      objectType: "session",
      objectId: sessionId,
    });
    if (staffState.failedAttempts >= MAX_TWO_FACTOR_ATTEMPTS) {
      await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));
      await recordAudit(db, {
        actorId: user.id,
        action: "session.ended_after_failed_codes",
        objectType: "session",
        objectId: sessionId,
      });
      return { ok: false, reason: "locked" };
    }
    return { ok: false, reason: "invalid", attemptsLeft: MAX_TWO_FACTOR_ATTEMPTS - staffState.failedAttempts };
  }

  const verifiedSessionId = (await sessionIdForToken(db, sessionTokenFromSetCookie(headers))) ?? sessionId;
  await db
    .insert(staffSession)
    .values({ sessionId: verifiedSessionId, userId: user.id, verifiedAt: new Date(), failedAttempts: 0 })
    .onConflictDoUpdate({ target: staffSession.sessionId, set: { verifiedAt: new Date(), failedAttempts: 0 } });
  await recordAudit(db, {
    actorId: user.id,
    action: user.twoFactorEnabled ? "two_factor.verified" : "two_factor.enrolled",
    objectType: "session",
    objectId: verifiedSessionId,
  });
  return { ok: true, headers };
}

async function sessionIdForToken(db: Database, token: string | null): Promise<string | null> {
  if (!token) return null;
  const row = await db.select({ id: sessionTable.id }).from(sessionTable).where(eq(sessionTable.token, token)).get();
  return row?.id ?? null;
}

/** Turns a code check into the page's response: on to staff home, back to sign-in, or an error to show. */
export function respondToCodeCheck(result: CodeCheck) {
  if (result.ok) throw redirect(ADMIN_PATHS.home, { headers: result.headers });
  if (result.reason === "locked") throw redirect(ADMIN_PATHS.signIn);
  return `That code didn't match. ${result.attemptsLeft} attempts left.`;
}
