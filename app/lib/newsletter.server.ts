import { newsletterOutbox } from "~db/schema";
import { getDb } from "./db.server";

/**
 * The newsletter list, kept by an external double-opt-in tool (Buttondown; docs/phase-1a-defaults.md
 * §4, documented under DATA-04) and separate from operational email (ADR-0004). The tool emails a
 * new subscriber to confirm before sending anything. Local development, tests and staging write to
 * the newsletter_outbox table instead (NEWSLETTER_OUTBOX).
 */

const BUTTONDOWN = "https://api.buttondown.com/v1/subscribers";

/** The tag that records which version of the newsletter notice a subscriber agreed to. */
export const noticeTag = (version: number) => `notice-newsletter-v${version}`;

function buttondown(env: Env) {
  const key = "BUTTONDOWN_API_KEY" in env ? env.BUTTONDOWN_API_KEY : undefined;
  if (!key) throw new Error("The newsletter tool is not configured for this environment");
  return { Authorization: `Token ${key}`, "Content-Type": "application/json" };
}

/** Adds an address to the list, unconfirmed until the person answers the tool's email. */
export async function subscribe(env: Env, email: string, tags: string[]): Promise<void> {
  if (env.NEWSLETTER_OUTBOX === "true") {
    await getDb(env.DB).insert(newsletterOutbox).values({ action: "subscribe", email, tags, createdAt: new Date() });
    return;
  }
  const response = await fetch(BUTTONDOWN, {
    method: "POST",
    headers: buttondown(env),
    body: JSON.stringify({ email_address: email, tags }),
  });
  // Someone already on the list who signs up again is still on it.
  if (!response.ok && response.status !== 409) {
    throw new Error(`The newsletter tool refused a subscription (${response.status})`);
  }
}

/** Takes an address off the list. One that isn't on it needs nothing more. */
export async function unsubscribe(env: Env, email: string): Promise<void> {
  if (env.NEWSLETTER_OUTBOX === "true") {
    await getDb(env.DB)
      .insert(newsletterOutbox)
      .values({ action: "unsubscribe", email, tags: [], createdAt: new Date() });
    return;
  }
  const response = await fetch(`${BUTTONDOWN}/${encodeURIComponent(email)}`, {
    method: "DELETE",
    headers: buttondown(env),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`The newsletter tool refused an unsubscribe (${response.status})`);
  }
}
