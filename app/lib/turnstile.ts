/**
 * Cloudflare Turnstile on every public form (docs/phase-1a-defaults.md §4). The widget puts a
 * token in the form as `cf-turnstile-response`; the server checks it with Siteverify before
 * anything is stored (turnstile.server.ts).
 *
 * Local development and tests use Cloudflare's published test keys, which the real Siteverify
 * also honours. The server answers them without a network call, so a machine that can't reach
 * Cloudflare still runs the forms; a deployed environment never has a test secret.
 */

export const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js";
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

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
