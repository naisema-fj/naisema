/**
 * Cloudflare Turnstile on every public form (docs/phase-1a-defaults.md §4). The widget puts a
 * token in the form as `cf-turnstile-response`; the server checks it with Siteverify before
 * anything is stored.
 *
 * Local development and tests use Cloudflare's published test keys, which the real Siteverify
 * also honours. They are answered here without a network call, so a machine that can't reach
 * Cloudflare still runs the forms; a deployed environment never has a test secret.
 */

export const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js";
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare's test keys (developers.cloudflare.com/turnstile/troubleshooting/testing). */
export const TURNSTILE_TEST_KEYS = {
  /** A site key whose widget always passes, and the token it gives. */
  siteKey: "1x00000000000000000000AA",
  token: "XXXX.DUMMY.TOKEN.XXXX",
  /** A secret that accepts any token. */
  passingSecret: "1x0000000000000000000000000000000AA",
  /** A secret that refuses every token. */
  failingSecret: "2x0000000000000000000000000000000AA",
  /** A secret that answers as if the token had been used already. */
  spentSecret: "3x0000000000000000000000000000000AA",
} as const;

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
