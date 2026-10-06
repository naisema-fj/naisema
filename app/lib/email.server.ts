import { emailFailure, emailOutbox } from "~db/schema";
import { getDb } from "./db.server";

export type OutgoingEmail = { to: string; subject: string; text: string };

/**
 * The single way the app sends email (ADR-0004). Deployed environments use the Cloudflare
 * Email Service binding; local development and tests write to the email_outbox table. A send that
 * fails is recorded, by its subject only, for the hourly monitor (app/lib/monitor.server.ts), and
 * the error is thrown on for the caller to handle.
 */
export async function sendEmail(env: Env, email: OutgoingEmail): Promise<void> {
  try {
    await deliver(env, email);
  } catch (error) {
    await getDb(env.DB)
      .insert(emailFailure)
      .values({ subject: email.subject, failedAt: new Date() })
      .catch(() => {});
    throw error;
  }
}

async function deliver(env: Env, email: OutgoingEmail) {
  if (env.EMAIL_OUTBOX === "true") {
    await getDb(env.DB)
      .insert(emailOutbox)
      .values({ ...email, createdAt: new Date() });
    return;
  }
  if (!("EMAIL" in env) || !env.EMAIL) {
    throw new Error("Email sending is not configured for this environment");
  }
  await env.EMAIL.send({ from: env.EMAIL_FROM, to: email.to, subject: email.subject, text: email.text });
}

/**
 * Sends the same email to each address, each on its own so one refusal doesn't stop the rest.
 * Returns how many were sent; the failures are recorded by sendEmail.
 */
export async function sendToEach(env: Env, recipients: string[], email: Omit<OutgoingEmail, "to">) {
  const results = await Promise.allSettled(recipients.map((to) => sendEmail(env, { ...email, to })));
  return results.filter((result) => result.status === "fulfilled").length;
}

/**
 * Who technical alerts go to: ALERT_EMAILS, comma-separated, set as a secret in deployed
 * environments. The technical owner, and their backup once named (docs/decision-log.md).
 */
export const alertRecipients = (env: Env) =>
  (env.ALERT_EMAILS ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

/** A letter to a member of the public: a greeting, by name when we have one, the paragraphs, a sign-off. */
export const letterText = (name: string, paragraphs: string[]) =>
  [`Bula${name ? ` ${name}` : ""},`, ...paragraphs, "Vinaka,\nNAISEMA"].join("\n\n");
