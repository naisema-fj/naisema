/**
 * Links that open something without an account: a Review Link shows one exact Revision (ADR-0003),
 * and an upload link takes a contributor's files for one Submission. Each carries a random token,
 * not a signed one, so it needs no key and is closed by a row; only the token's SHA-256 is kept, so
 * its address is shown once and a copy of the database can't open it. A link works from when it is
 * issued until it expires or is closed: a Review Link when an editor revokes it, an upload link when
 * the contributor finishes or a newer one is sent. How long each lasts, and what opening it logs,
 * is its own (review-links.server.ts, submissions.server.ts).
 */

const encoder = new TextEncoder();

/** Bytes as base64url, without padding. */
export const base64Url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

/** A token as `issueToken` makes them: 32 random bytes, base64url. Anything else is never looked up. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

const sha256 = async (token: string) => base64Url(await crypto.subtle.digest("SHA-256", encoder.encode(token)));

/** A new link's token, to put in its address once, and the hash to store it under. */
export async function issueToken() {
  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  return { token, tokenHash: await sha256(token) };
}

/** The hash a link with this token is stored under, or null for a token no link could have. */
export const tokenHashOf = async (token: string) => (TOKEN.test(token) ? sha256(token) : null);

/** When a link issued now expires. */
export const linkExpiry = (now: Date, days: number) => new Date(now.getTime() + days * 86_400_000);

export type LinkState = "active" | "expired" | "closed";

/** A link works until it is closed or reaches its expiry; at that very moment it has expired. */
export function linkState(link: { expiresAt: Date; closedAt: Date | null }, now: Date): LinkState {
  if (link.closedAt) return "closed";
  return link.expiresAt > now ? "active" : "expired";
}
