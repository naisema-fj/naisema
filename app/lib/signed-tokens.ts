/**
 * Tokens for links sent by email: a consent withdrawal link carries the record's id signed with
 * the app's secret, so it works without an account and can't be made up for someone else's record.
 * Upload links are random instead, stored only as a hash (`hashToken`).
 */

const encoder = new TextEncoder();

const base64Url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

async function signature(secret: string, use: string, value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return base64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(`${use}|${value}`)));
}

/** `{value}.{signature}`, for one use ("consent-withdrawal"), so a token for one use can't serve another. */
export async function signToken(secret: string, use: string, value: string) {
  return `${value}.${await signature(secret, use, value)}`;
}

/** The value a token signs, or null if it wasn't signed for this use with this secret. */
export async function verifyToken(secret: string, use: string, token: string): Promise<string | null> {
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || token.length > 300) return null;
  const value = token.slice(0, dot);
  const expected = encoder.encode(await signature(secret, use, value));
  const given = encoder.encode(token.slice(dot + 1));
  if (expected.byteLength !== given.byteLength) return null;
  // Compare every byte, so how long the check takes says nothing about how close a guess was.
  let difference = 0;
  for (let index = 0; index < expected.byteLength; index++) difference |= expected[index] ^ given[index];
  return difference === 0 ? value : null;
}

/** A new random token for a link, 32 bytes, URL-safe. */
export const randomToken = () => base64Url(crypto.getRandomValues(new Uint8Array(32)));

/** How a random token is stored: its SHA-256, so a copy of the database can't be used to open the link. */
export async function hashToken(token: string) {
  return base64Url(await crypto.subtle.digest("SHA-256", encoder.encode(token)));
}
