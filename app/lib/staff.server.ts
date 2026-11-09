import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { redirect } from "react-router";
import { signInLink, staffSession, staff as staffTable } from "~db/schema";
import { audit } from "./audit.server";
import { type Database, getDb } from "./db.server";
import { sendEmail } from "./email.server";
import { can, type Permission, type Staff } from "./roles";

/**
 * Staff sign in with a link emailed to them (ADR-0016). Only addresses on the staff list get a
 * link; it works once, for 15 minutes, and opens a 14-day session held in an HttpOnly cookie. Only
 * hashes of the link's token and the session's ID are stored, so a copy of the database signs no
 * one in. Each request then reads the session and the person's roles from the `staff` table, so
 * someone taken off the list is signed out at once.
 *
 * Development and tests can also name the person with the X-Dev-Staff-Email header, and only
 * there: an environment with email sending (staging, production) never reads it.
 */

export const DEV_STAFF_HEADER = "X-Dev-Staff-Email";
export const SESSION_COOKIE = "naisema_staff";
const LINK_MINUTES = 15;
const SESSION_DAYS = 14;
/** At most this many links to one address in a link's lifetime, so nobody's inbox is flooded. */
const LINKS_PER_ADDRESS = 3;

type MailEnv = Env & { EMAIL?: unknown };
const isDevelopment = (env: Env) => env.ENVIRONMENT === "development" && !(env as MailEnv).EMAIL;

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const readCookie = (request: Request, name: string) =>
  (request.headers.get("Cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? null;

/**
 * Emails a sign-in link to `email` if it belongs to an active staff member, and says nothing
 * either way, so the form can't be used to find out who works on NAISEMA. In development, where
 * nothing is sent, the link is returned to show on the page instead.
 */
export async function sendSignInLink(env: Env, db: Database, email: string, adminOrigin: string) {
  const address = email.trim().toLowerCase();
  const person = await db.query.staff.findFirst({ where: eq(staffTable.email, address) });
  const now = Date.now();
  // Expired links and sessions are tidied here, since nothing else runs on a schedule.
  await db.batch([
    db.delete(signInLink).where(lt(signInLink.expiresAt, new Date(now))),
    db.delete(staffSession).where(lt(staffSession.expiresAt, new Date(now))),
  ]);
  if (!person?.active) return { devLink: null };
  const recent = await db
    .select({ tokenHash: signInLink.tokenHash })
    .from(signInLink)
    .where(and(eq(signInLink.email, address), gt(signInLink.expiresAt, new Date(now))));
  if (recent.length >= LINKS_PER_ADDRESS) return { devLink: null };
  const token = randomToken();
  await db.insert(signInLink).values({
    tokenHash: await sha256(token),
    email: address,
    expiresAt: new Date(now + LINK_MINUTES * 60_000),
  });
  const link = `${adminOrigin}/admin/sign-in/link?token=${token}`;
  if (isDevelopment(env)) return { devLink: link };
  await sendEmail(env, {
    to: [address],
    subject: "Your NAISEMA sign-in link",
    text: `Bula ${person.name},\n\nSign in to the NAISEMA staff site with this link. It works once, for ${LINK_MINUTES} minutes:\n\n${link}\n\nIf you didn't ask for it, you can ignore this email.\n`,
  });
  return { devLink: null };
}

/**
 * Uses a sign-in link: once, before it expires, for someone still on the staff list. Returns the
 * session cookie to set, or null if the link doesn't work.
 */
export async function redeemSignInLink(db: Database, token: string, secure: boolean) {
  if (!token || token.length > 100) return null;
  const tokenHash = await sha256(token);
  const now = new Date();
  // Marking it used in the same statement that checks it means a link can't be used twice at once.
  const used = await db
    .update(signInLink)
    .set({ usedAt: now })
    .where(and(eq(signInLink.tokenHash, tokenHash), isNull(signInLink.usedAt), gt(signInLink.expiresAt, now)))
    .returning({ email: signInLink.email });
  const email = used[0]?.email;
  if (!email) return null;
  const person = await db.query.staff.findFirst({ where: eq(staffTable.email, email) });
  if (!person?.active) return null;
  const sessionId = randomToken();
  await db.batch([
    db.insert(staffSession).values({
      idHash: await sha256(sessionId),
      email,
      expiresAt: new Date(now.getTime() + SESSION_DAYS * 86_400_000),
    }),
    audit(db, email, "staff.signed_in", { type: "staff", id: email }),
  ]);
  return [
    `${SESSION_COOKIE}=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_DAYS * 86_400}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

/** Ends this browser's session. Returns the cookie that clears it. */
export async function signOut(db: Database, request: Request) {
  const sessionId = readCookie(request, SESSION_COOKIE);
  if (sessionId) await db.delete(staffSession).where(eq(staffSession.idHash, await sha256(sessionId)));
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Signs someone out everywhere, as when they leave the staff list. */
export const endSessions = (db: Database, email: string) =>
  db.delete(staffSession).where(eq(staffSession.email, email));

async function requestEmail(env: Env, db: Database, request: Request) {
  if (isDevelopment(env)) {
    const named = request.headers.get(DEV_STAFF_HEADER)?.trim().toLowerCase();
    if (named) return named;
  }
  const sessionId = readCookie(request, SESSION_COOKIE);
  if (!sessionId) return null;
  const session = await db.query.staffSession.findFirst({
    where: and(eq(staffSession.idHash, await sha256(sessionId)), gt(staffSession.expiresAt, new Date())),
  });
  return session?.email ?? null;
}

/** The signed-in staff member, or null if the request isn't from an active one. */
export async function getStaff(env: Env, request: Request): Promise<Staff | null> {
  const db = getDb(env.DB);
  const email = await requestEmail(env, db, request);
  if (!email) return null;
  const row = await db.query.staff.findFirst({ where: eq(staffTable.email, email) });
  if (!row?.active) return null;
  return { email: row.email, name: row.name, roles: row.roles, languageVariety: row.languageVariety };
}

/**
 * The signed-in staff member, who must hold `permission` when one is named. Someone not signed in
 * is sent to sign in; someone whose roles don't allow the page gets a 403.
 */
export async function requireStaff(env: Env, request: Request, permission?: Permission): Promise<Staff> {
  const person = await getStaff(env, request);
  if (!person) throw redirect("/admin/sign-in");
  if (permission && !can(person, permission)) {
    throw new Response("Your roles don't allow this page.", { status: 403 });
  }
  return person;
}
