/**
 * Cloudflare Stream's two signatures: the one on its webhook deliveries, which we check, and the
 * signed playback token, which we make with a Stream signing key so every video can require signed
 * playback (ADR-0008) without an API call per view.
 */

const encoder = new TextEncoder();

const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

/** Compares two strings in time that doesn't depend on where they differ. */
function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

/**
 * Checks a `Webhook-Signature` header (`time=<seconds>,sig1=<hex>`): an HMAC-SHA256, keyed with
 * the webhook secret, of the time, a full stop and the raw body.
 */
export async function verifyStreamSignature(secret: string, header: string | null, body: string) {
  if (!secret || !header) return false;
  const fields = new Map(
    header.split(",").map((field) => {
      const at = field.indexOf("=");
      return [field.slice(0, at).trim(), field.slice(at + 1).trim()] as const;
    }),
  );
  const time = fields.get("time");
  const signature = fields.get("sig1");
  if (!time || !/^\d+$/.test(time) || !signature) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${time}.${body}`)));
  return equal(expected, signature.toLowerCase());
}

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const jsonPart = (value: unknown) => base64url(encoder.encode(JSON.stringify(value)));

/**
 * A playback token for one video (an RS256 JSON Web Token), signed with a Stream signing key: its
 * ID and its private key as Stream gives it, a base64-encoded JWK.
 */
export async function signPlaybackToken(input: {
  keyId: string;
  jwk: string;
  videoId: string;
  now: Date;
  seconds: number;
}) {
  const unsigned = `${jsonPart({ alg: "RS256", kid: input.keyId })}.${jsonPart({
    sub: input.videoId,
    kid: input.keyId,
    exp: Math.floor(input.now.getTime() / 1000) + input.seconds,
  })}`;
  const key = await crypto.subtle.importKey(
    "jwk",
    JSON.parse(atob(input.jwk)) as JsonWebKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned));
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}
