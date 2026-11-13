import { logError, logInfo } from "./log.server";

/**
 * Operational email from `EMAIL_FROM` through Cloudflare Email Service (ADR-0004): form
 * notifications to the team. Local development and tests have no sending binding and log the
 * subject instead. A failed send is logged and never loses what the person sent, which is already
 * stored.
 */

type EmailAddress = { email: string; name?: string };
type EmailEnv = Env & {
  EMAIL?: { send(message: { from: EmailAddress; to: string[]; subject: string; text: string }): Promise<unknown> };
  NOTIFY_EMAILS?: string;
};

/**
 * `EMAIL_FROM` ("NAISEMA <no-reply@naisema.com>") as the `{ email, name }` Email Service takes. It
 * doesn't accept the "Name <address>" form as a sender, so passing the setting through as it is
 * meant every send failed.
 */
export function senderAddress(from: string): EmailAddress {
  const match = /^\s*(.*?)\s*<([^<>\s]+@[^<>\s]+)>\s*$/.exec(from);
  if (!match) return { email: from.trim() };
  const name = match[1].replace(/^"(.*)"$/, "$1").trim();
  return name ? { email: match[2], name } : { email: match[2] };
}

/** The team addresses notifications go to: the NOTIFY_EMAILS secret, comma-separated. */
export const teamAddresses = (env: Env) =>
  ((env as EmailEnv).NOTIFY_EMAILS ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

export async function sendEmail(env: Env, message: { to: string[]; subject: string; text: string }) {
  const { EMAIL } = env as EmailEnv;
  if (!EMAIL || !message.to.length) {
    logInfo("Email not sent (no sending binding or recipient)", { subject: message.subject });
    return false;
  }
  try {
    await EMAIL.send({
      from: senderAddress(env.EMAIL_FROM),
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return true;
  } catch (error) {
    logError("Email failed", { subject: message.subject, error });
    return false;
  }
}
