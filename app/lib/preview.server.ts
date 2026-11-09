/**
 * Preview links for Knowledge Holders and other reviewers outside the team: an address that shows
 * one exact Revision for 14 days, without signing in (ADR-0015). The token is the Revision's ID and
 * expiry, signed with PREVIEW_SECRET, so nothing is stored; rotating the secret ends every link.
 */

export const PREVIEW_DAYS = 14;

const encoder = new TextEncoder();

async function key(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

const toBase64url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export async function previewToken(secret: string, revisionId: string, now = Date.now()) {
  const expires = now + PREVIEW_DAYS * 86_400_000;
  const payload = `${revisionId}.${expires}`;
  const signature = await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(payload));
  return { token: `${payload}.${toBase64url(signature)}`, expiresAt: new Date(expires) };
}

/** The Revision a token shows, or why it shows nothing. */
export async function readPreviewToken(
  secret: string,
  token: string,
  now = Date.now(),
): Promise<{ ok: true; revisionId: string; expiresAt: Date } | { ok: false; reason: "invalid" | "expired" }> {
  const [revisionId, expires, signature] = token.split(".");
  if (!revisionId || !expires || !signature || !/^\d+$/.test(expires)) return { ok: false, reason: "invalid" };
  const expected = toBase64url(
    await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(`${revisionId}.${expires}`)),
  );
  if (expected.length !== signature.length) return { ok: false, reason: "invalid" };
  let difference = 0;
  for (let index = 0; index < expected.length; index++)
    difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  if (difference) return { ok: false, reason: "invalid" };
  if (Number(expires) < now) return { ok: false, reason: "expired" };
  return { ok: true, revisionId, expiresAt: new Date(Number(expires)) };
}
