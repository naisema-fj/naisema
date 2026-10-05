import { and, eq, gt, sql } from "drizzle-orm";
import { learnerAccount, learnerSignInLink, user as userTable } from "~db/schema";
import { createLearnerAuth } from "./auth.server";
import { type Database, getDb } from "./db.server";
import { letterText, sendEmail } from "./email.server";
import { LEARNER_PATHS } from "./learner-progress";
import { hasStaffRole, sha256Hex } from "./learner-records.server";
import { type Actor, can } from "./permissions";

/**
 * Learner Accounts on the public site (#33): signing up and in by emailed link, the gate every
 * learner page and request passes, and deleting an account. A Learner is a user with no staff role
 * (ADR-0005); an address with a staff role, current or past, can't hold a Learner Account, so a
 * learner session can never carry staff access and deleting one can never remove a staff account.
 */

/** Sign-in links one address can be sent per window, so nobody can flood an inbox. */
export const LEARNER_LINKS_PER_WINDOW = 3;
const LINK_WINDOW_MS = 15 * 60 * 1000;
/** Activity is recorded at most this often, rather than on every request. */
const ACTIVE_EVERY_MS = 60 * 60 * 1000;

export type Learner = { actor: Actor; userId: string; email: string; db: Database };

/**
 * Emails a sign-in link to someone who declared they are 18 or older: it makes their Learner
 * Account when they first use it. An address with a staff role is told by email to use another,
 * so the page's reply never shows which addresses belong to staff; one that has had three links in
 * 15 minutes is sent nothing. The caller has checked the declaration and the address's form.
 */
export async function requestLearnerSignInLink(env: Env, request: Request, email: string): Promise<void> {
  const db = getDb(env.DB);
  const now = new Date();
  const emailHash = await sha256Hex(email);
  const recent = await db
    .select({ count: sql<number>`count(*)` })
    .from(learnerSignInLink)
    .where(
      and(
        eq(learnerSignInLink.emailHash, emailHash),
        gt(learnerSignInLink.sentAt, new Date(now.getTime() - LINK_WINDOW_MS)),
      ),
    )
    .get();
  if ((recent?.count ?? 0) >= LEARNER_LINKS_PER_WINDOW) return;
  await db.insert(learnerSignInLink).values({ emailHash, sentAt: now });

  const existing = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, email)).get();
  if (existing && (await hasStaffRole(db, existing.id))) {
    await sendEmail(env, {
      to: email,
      subject: "Signing in to Na iSema",
      text: letterText("", [
        "Someone asked to sign in to a Na iSema learning account with this address.",
        "This address belongs to a Na iSema staff account, so it can't also hold a learning account. To keep your learning separate, sign up with another email address.",
        "If you did not ask, you can ignore this email.",
      ]),
    });
    return;
  }
  if (existing && !(await db.select().from(learnerAccount).where(eq(learnerAccount.userId, existing.id)).get())) return;

  await createLearnerAuth(env, request).api.signInMagicLink({
    body: {
      email,
      callbackURL: LEARNER_PATHS.home,
      newUserCallbackURL: `${LEARNER_PATHS.home}?welcome=1`,
      errorCallbackURL: `${LEARNER_PATHS.signIn}?link=expired`,
    },
    headers: request.headers,
  });
}

/**
 * The signed-in Learner, or null: a learner session on this site whose user has a Learner Account
 * and no staff role. Records that the account is in use, which also clears an inactivity warning.
 */
export async function getLearner(env: Env, request: Request): Promise<Learner | null> {
  const result = await createLearnerAuth(env, request).api.getSession({ headers: request.headers });
  if (!result) return null;
  const db = getDb(env.DB);
  const account = await db.select().from(learnerAccount).where(eq(learnerAccount.userId, result.user.id)).get();
  if (!account || (await hasStaffRole(db, result.user.id))) return null;
  const now = new Date();
  if (account.inactivityWarnedAt || now.getTime() - account.lastActiveAt.getTime() > ACTIVE_EVERY_MS) {
    await db
      .update(learnerAccount)
      .set({ lastActiveAt: now, inactivityWarnedAt: null })
      .where(eq(learnerAccount.userId, account.userId));
  }
  return { actor: { userId: result.user.id, roles: [] }, userId: result.user.id, email: result.user.email, db };
}

/** The learner gate for pages: the signed-in Learner, or off to sign in. */
export async function requireLearner(env: Env, request: Request): Promise<Learner> {
  const learner = await getLearner(env, request);
  if (!learner) throw new Response(null, { status: 302, headers: { Location: LEARNER_PATHS.signIn } });
  return learner;
}

/**
 * The domain authorisation check (ADR-0005) for a learner acting on their own records. Every
 * learner read and write passes it, so the rule stays in one place even though, today, a learner
 * only ever reaches their own records.
 */
export function requireOwnRecords(
  learner: Learner,
  action: "learnerRecord.read" | "learnerRecord.write" | "learnerRecord.export" | "learnerRecord.delete",
) {
  if (!can(learner.actor, { action, learnerRecord: { ownerId: learner.userId } })) {
    throw new Response("Not allowed", { status: 403 });
  }
}

/** Ends the learner's session here; the headers returned clear its cookie, and say nothing else. */
export async function signOutLearner(env: Env, request: Request): Promise<Headers> {
  const { headers } = await createLearnerAuth(env, request).api.signOut({
    headers: request.headers,
    returnHeaders: true,
  });
  const cookies = new Headers();
  for (const cookie of headers.getSetCookie()) cookies.append("Set-Cookie", cookie);
  return cookies;
}

/** A learner's request that changes something must come from this site's own pages. */
export const fromThisSite = (request: Request) => request.headers.get("Origin") === new URL(request.url).origin;
