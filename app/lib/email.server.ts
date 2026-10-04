import { emailOutbox } from "~db/schema";
import { getDb } from "./db.server";

export type OutgoingEmail = { to: string; subject: string; text: string };

/**
 * The single way the app sends email (ADR-0004). Deployed environments use the Cloudflare
 * Email Service binding; local development and tests write to the email_outbox table.
 */
export async function sendEmail(env: Env, email: OutgoingEmail): Promise<void> {
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

/** A letter to a member of the public: a greeting, by name when we have one, the paragraphs, a sign-off. */
export const letterText = (name: string, paragraphs: string[]) =>
  [`Bula${name ? ` ${name}` : ""},`, ...paragraphs, "Vinaka,\nNa iSema"].join("\n\n");
