import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { twoFactor } from "better-auth/plugins/two-factor";
import * as schema from "~db/schema";
import { learnerAccount } from "~db/schema";
import { recordAudit } from "./audit.server";
import { getDb } from "./db.server";
import { sendEmail } from "./email.server";
import { sha256Hex } from "./learner-records.server";

export const AUTH_BASE_PATH = "/api/auth";
const COOKIE_PREFIX = "naisema";
const MAGIC_LINK_MINUTES = 15;

/**
 * Better Auth for staff on the admin host (ADR-0005). Identity only: sessions, magic links
 * and TOTP enrolment. Roles and the two-factor requirement live in staff.server.ts.
 */
export function createAuth(env: Env, request: Request) {
  const origin = new URL(request.url).origin;
  const db = getDb(env.DB);

  return betterAuth({
    appName: "NAISEMA",
    baseURL: origin,
    basePath: AUTH_BASE_PATH,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: { enabled: false },
    session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 60 },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 30 },
    advanced: {
      cookiePrefix: COOKIE_PREFIX,
      // Cloudflare sets CF-Connecting-IP at the edge; it is the client IP rate limits key on.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      useSecureCookies: origin.startsWith("https://"),
      database: { generateId: () => crypto.randomUUID() },
    },
    databaseHooks: {
      session: {
        create: {
          after: async (created) => {
            await recordAudit(db, {
              actorId: created.userId,
              action: "session.created",
              objectType: "session",
              objectId: created.id,
            });
          },
        },
      },
    },
    plugins: [
      magicLink({
        // Staff accounts are created by an administrator, never by signing in.
        disableSignUp: true,
        expiresIn: MAGIC_LINK_MINUTES * 60,
        sendMagicLink: async ({ email, url }) => {
          await sendEmail(env, {
            to: email,
            subject: "Your NAISEMA sign-in link",
            text: [
              "Use this link to sign in to NAISEMA staff tools:",
              "",
              url,
              "",
              `The link works once and expires in ${MAGIC_LINK_MINUTES} minutes.`,
              "If you did not ask to sign in, you can ignore this email.",
            ].join("\n"),
          });
        },
      }),
      twoFactor({ issuer: "NAISEMA", allowPasswordless: true }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

/** Where Better Auth answers for Learner Accounts on the public site; only the emailed link is reachable (workers/app.ts). */
export const LEARNER_AUTH_BASE_PATH = "/account/auth";
const LEARNER_COOKIE_PREFIX = "naisema-learner";
const LEARNER_LINK_MINUTES = 30;

/**
 * Better Auth for Learner Accounts on the public site (#33, ADR-0005): sign-up and sign-in by
 * emailed link, nothing else. Its own base path and cookie keep it apart from staff sessions, and
 * its links are stored as "learner:" and a SHA-256 hash, so a staff link never opens a learner
 * session and a learner link never opens a staff one. Its request limits are counted apart too. A user it creates gets a Learner Account,
 * declared 18 or older: the sign-in form sends no link without that declaration
 * (app/lib/learners.server.ts).
 */
export function createLearnerAuth(env: Env, request: Request) {
  const origin = new URL(request.url).origin;
  const db = getDb(env.DB);

  return betterAuth({
    appName: "NAISEMA",
    baseURL: origin,
    basePath: LEARNER_AUTH_BASE_PATH,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: { enabled: false },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    // Counted in a table of its own, so learners signing in never use up staff members' limits.
    rateLimit: { enabled: true, storage: "database", modelName: "learnerRateLimit", window: 60, max: 30 },
    advanced: {
      cookiePrefix: LEARNER_COOKIE_PREFIX,
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      useSecureCookies: origin.startsWith("https://"),
      database: { generateId: () => crypto.randomUUID() },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (created) => {
            const now = new Date();
            await db
              .insert(learnerAccount)
              .values({ userId: created.id, adultDeclaredAt: now, lastActiveAt: now })
              .onConflictDoNothing();
          },
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: LEARNER_LINK_MINUTES * 60,
        storeToken: { type: "custom-hasher", hash: learnerTokenKey },
        sendMagicLink: async ({ email, url }) => {
          await sendEmail(env, {
            to: email,
            subject: "Your NAISEMA sign-in link",
            text: [
              "Bula,",
              "",
              "Use this link to sign in to your NAISEMA learning account:",
              "",
              url,
              "",
              `The link works once and expires in ${LEARNER_LINK_MINUTES} minutes.`,
              "If you did not ask to sign in, you can ignore this email: no account is made until the link is used.",
              "",
              "Vinaka,",
              "NAISEMA",
            ].join("\n"),
          });
        },
      }),
    ],
  });
}

export type LearnerAuth = ReturnType<typeof createLearnerAuth>;

/** How a learner sign-in link's token is stored: marked as a learner's, and hashed. */
const learnerTokenKey = async (token: string) => `learner:${await sha256Hex(token)}`;

/** The session token in a Set-Cookie header Better Auth issued, if it issued one. */
export function sessionTokenFromSetCookie(headers: Headers): string | null {
  const name = new RegExp(`^(?:__Secure-)?${COOKIE_PREFIX}\\.session_token=([^;]+)`);
  for (const cookie of headers.getSetCookie()) {
    const match = cookie.match(name);
    // The cookie value is "<token>.<signature>".
    if (match) return decodeURIComponent(match[1]).split(".")[0];
  }
  return null;
}
