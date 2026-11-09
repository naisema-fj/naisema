import { logError, logInfo } from "./log.server";

/**
 * Operational email from `EMAIL_FROM` through Cloudflare Email Service (ADR-0004): form
 * notifications to the team. Local development and tests have no sending binding and log the
 * subject instead. A failed send is logged and never loses what the person sent, which is already
 * stored.
 */

type EmailEnv = Env & {
  EMAIL?: { send(message: { from: string; to: string | string[]; subject: string; text: string }): Promise<unknown> };
  NOTIFY_EMAILS?: string;
};

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
    await EMAIL.send({ from: env.EMAIL_FROM, to: message.to, subject: message.subject, text: message.text });
    return true;
  } catch (error) {
    logError("Email failed", { subject: message.subject, error });
    return false;
  }
}
