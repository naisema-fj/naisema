import { and, eq, isNull, sql } from "drizzle-orm";
import { redirect } from "react-router";
import { roleAssignment, session as sessionTable, staffSession } from "~db/schema";
import { recordAudit } from "./audit.server";
import { type Auth, createAuth } from "./auth.server";
import { type Database, getDb } from "./db.server";
import type { Actor, RoleAssignment, StaffRole } from "./permissions";

export const ADMIN_PATHS = {
  home: "/admin",
  signIn: "/admin/sign-in",
  twoFactor: "/admin/two-factor",
  twoFactorSetup: "/admin/two-factor/setup",
} as const;

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
  const state = await db.select().from(staffSession).where(eq(staffSession.sessionId, result.session.id)).get();
  return { auth, db, user: result.user, sessionId: result.session.id, verified: Boolean(state?.verifiedAt) };
}

export async function activeRoles(db: Database, userId: string): Promise<RoleAssignment[]> {
  const rows = await db
    .select()
    .from(roleAssignment)
    .where(and(eq(roleAssignment.userId, userId), isNull(roleAssignment.revokedAt)));
  return rows.map((row) => ({
    role: row.role as StaffRole,
    ...(row.reviewType ? { reviewType: row.reviewType as RoleAssignment["reviewType"] } : {}),
    ...(row.languageVariety ? { languageVariety: row.languageVariety } : {}),
  }));
}

/**
 * The staff gate. Returns an Actor whose roles are active only because this session has
 * signed in by magic link AND passed the two-factor check; otherwise redirects to the next step.
 */
export async function requireStaff(env: Env, request: Request) {
  const signedIn = await getSignedIn(env, request);
  if (!signedIn) throw redirect(ADMIN_PATHS.signIn);
  if (!signedIn.user.twoFactorEnabled) throw redirect(ADMIN_PATHS.twoFactorSetup);
  if (!signedIn.verified) throw redirect(ADMIN_PATHS.twoFactor);

  const roles = await activeRoles(signedIn.db, signedIn.user.id);
  if (roles.length === 0) {
    throw new Response("This account has no staff access.", { status: 403 });
  }
  const actor: Actor = { userId: signedIn.user.id, roles };
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
    const state = await db
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
    if (state.failedAttempts >= MAX_TWO_FACTOR_ATTEMPTS) {
      await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));
      await recordAudit(db, {
        actorId: user.id,
        action: "session.ended_after_failed_codes",
        objectType: "session",
        objectId: sessionId,
      });
      return { ok: false, reason: "locked" };
    }
    return { ok: false, reason: "invalid", attemptsLeft: MAX_TWO_FACTOR_ATTEMPTS - state.failedAttempts };
  }

  const verifiedSessionId = (await sessionIdFromCookies(db, headers)) ?? sessionId;
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

/** Finds the session named by a Set-Cookie header Better Auth returned, if it issued one. */
async function sessionIdFromCookies(db: Database, headers: Headers): Promise<string | null> {
  for (const cookie of headers.getSetCookie()) {
    const match = cookie.match(/^(?:__Secure-)?naisema\.session_token=([^;]+)/);
    if (!match) continue;
    const token = decodeURIComponent(match[1]).split(".")[0];
    const row = await db.select({ id: sessionTable.id }).from(sessionTable).where(eq(sessionTable.token, token)).get();
    if (row) return row.id;
  }
  return null;
}
