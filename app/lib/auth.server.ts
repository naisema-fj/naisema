import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { twoFactor } from "better-auth/plugins/two-factor";
import * as schema from "~db/schema";
import { recordAudit } from "./audit.server";
import { getDb } from "./db.server";
import { sendEmail } from "./email.server";

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
    appName: "Na iSema",
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
            subject: "Your Na iSema sign-in link",
            text: [
              "Use this link to sign in to Na iSema staff tools:",
              "",
              url,
              "",
              `The link works once and expires in ${MAGIC_LINK_MINUTES} minutes.`,
              "If you did not ask to sign in, you can ignore this email.",
            ].join("\n"),
          });
        },
      }),
      twoFactor({ issuer: "Na iSema", allowPasswordless: true }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

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
