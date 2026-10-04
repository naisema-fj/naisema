import { TURNSTILE_TEST_KEYS } from "./turnstile";

/** Turnstile's server-side check of a form's token (app/lib/turnstile.ts). */

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** Whether a form's Turnstile token shows a person sent it. Fails closed: no answer is a refusal. */
export async function verifyTurnstile(
  secret: string,
  token: string,
  remoteIp: string | null,
  fetcher: Fetcher = (input, init) => fetch(input, init),
): Promise<boolean> {
  if (!token || token.length > 2048) return false;
  if (secret === TURNSTILE_TEST_KEYS.passingSecret) return true;
  if (secret === TURNSTILE_TEST_KEYS.failingSecret || secret === TURNSTILE_TEST_KEYS.spentSecret) return false;
  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const response = await fetcher(SITEVERIFY, { method: "POST", body });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
