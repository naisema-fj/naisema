import { env, SELF } from "cloudflare:test";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import type { RoleAssignment } from "~/lib/permissions";

export const ADMIN = "http://admin.localhost";

/** A minimal cookie jar so a test can act as one browser across requests. */
export class Browser {
  cookies = new Map<string, string>();
  /** Each simulated browser has its own client IP, as Cloudflare would report it. */
  ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;

  async fetch(path: string, init: RequestInit & { form?: Record<string, string>; multipart?: FormData } = {}) {
    const url = path.startsWith("http") ? path : `${ADMIN}${path}`;
    const headers = new Headers(init.headers);
    headers.set("CF-Connecting-IP", this.ip);
    if (this.cookies.size) headers.set("Cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    let body = init.body;
    if (init.multipart) {
      body = init.multipart;
      if (!headers.has("Origin")) headers.set("Origin", new URL(url).origin);
    }
    if (init.form) {
      body = new URLSearchParams(init.form);
      headers.set("Content-Type", "application/x-www-form-urlencoded");
      if (!headers.has("Origin")) headers.set("Origin", new URL(url).origin);
    }
    const response = await SELF.fetch(url, {
      ...init,
      method: init.form || init.multipart ? "POST" : init.method,
      body,
      headers,
      redirect: "manual",
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const [name, ...value] = pair.split("=");
      const joined = value.join("=");
      if (/max-age=0/i.test(cookie) || joined === "") this.cookies.delete(name);
      else this.cookies.set(name, joined);
    }
    return response;
  }
}

export async function seedStaff(email: string, roles: RoleAssignment[]) {
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?1, ?2, ?3, 0, ?4, ?4)",
  )
    .bind(id, email.split("@")[0], email, now)
    .run();
  for (const role of roles) {
    await env.DB.prepare(
      "INSERT INTO role_assignment (id, user_id, role, review_type, language_variety, granted_by, granted_at) VALUES (?1, ?2, ?3, ?4, ?5, 'test', ?6)",
    )
      .bind(crypto.randomUUID(), id, role.role, role.reviewType ?? null, role.languageVariety ?? null, now)
      .run();
  }
  return id;
}

export async function emailsTo(address: string) {
  const { results } = await env.DB.prepare('SELECT subject, text FROM email_outbox WHERE "to" = ?1 ORDER BY id')
    .bind(address)
    .all<{ subject: string; text: string }>();
  return results;
}

export async function signInWithMagicLink(browser: Browser, email: string) {
  await browser.fetch("/admin/sign-in", { form: { email } });
  const emails = await emailsTo(email);
  const link = emails.at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`No magic link emailed to ${email}`);
  return browser.fetch(link);
}

/** Reads the authenticator secret from the setup page, as a person would type it in. */
export async function startTwoFactorSetup(browser: Browser) {
  const page = await (await browser.fetch("/admin/two-factor/setup", { form: { intent: "start" } })).text();
  const secret = page.match(/data-totp-secret="([A-Z2-7]+)"/)?.[1];
  if (!secret) throw new Error("No authenticator secret on the setup page");
  return secret;
}

/** What an authenticator app shows: the key it was given is base32, so decode it first. */
export const codeFor = (base32Key: string) => createOTP(new TextDecoder().decode(base32.decode(base32Key))).totp();

export async function auditActions(actorId: string) {
  const { results } = await env.DB.prepare("SELECT action FROM audit_event WHERE actor_id = ?1 ORDER BY created_at")
    .bind(actorId)
    .all<{ action: string }>();
  return results.map((row) => row.action);
}

export async function auditActionsAbout(objectId: string) {
  const { results } = await env.DB.prepare("SELECT action FROM audit_event WHERE object_id = ?1 ORDER BY created_at")
    .bind(objectId)
    .all<{ action: string }>();
  return results.map((row) => row.action);
}

/** Seeds a staff member and returns a browser that has signed in and passed two-factor. */
export async function signedInStaff(email: string, roles: RoleAssignment[]) {
  const userId = await seedStaff(email, roles);
  const browser = new Browser();
  await signInWithMagicLink(browser, email);
  const secret = await startTwoFactorSetup(browser);
  await browser.fetch("/admin/two-factor/setup", { form: { intent: "verify", code: await codeFor(secret) } });
  return { userId, email, browser, secret };
}
