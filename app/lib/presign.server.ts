/**
 * Pre-signed GET addresses (AWS Signature Version 4 in the query string), so Cloudflare Stream can
 * fetch a video master straight from the private R2 bucket for a short time, without the bucket
 * ever being public (ADR-0008). R2's S3 API checks them with an access key scoped to that bucket.
 */

const encoder = new TextEncoder();

const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

async function hmac(key: ArrayBuffer | Uint8Array<ArrayBuffer>, value: string) {
  const imported = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", imported, encoder.encode(value));
}

const sha256 = async (value: string) => hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));

/** RFC 3986 encoding, as Signature Version 4 requires: only unreserved characters are left as they are. */
const encodeRfc3986 = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

/** An object key as a path: each segment encoded, the slashes kept. */
export const encodeKey = (key: string) => key.split("/").map(encodeRfc3986).join("/");

export type PresignInput = {
  host: string;
  /** Already encoded, starting with "/". */
  path: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresSeconds: number;
  now: Date;
};

export async function presignedGet({
  host,
  path,
  region,
  accessKeyId,
  secretAccessKey,
  expiresSeconds,
  now,
}: PresignInput) {
  const amzDate = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${region}/s3/aws4_request`;
  const query = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresSeconds)],
    ["X-Amz-SignedHeaders", "host"],
  ]
    .map(([name, value]) => `${encodeRfc3986(name)}=${encodeRfc3986(value)}`)
    .sort()
    .join("&");
  const canonicalRequest = ["GET", path, query, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256(canonicalRequest)].join("\n");
  let key: ArrayBuffer = await hmac(encoder.encode(`AWS4${secretAccessKey}`), day);
  for (const part of [region, "s3", "aws4_request"]) key = await hmac(key, part);
  const signature = hex(await hmac(key, stringToSign));
  return `https://${host}${path}?${query}&X-Amz-Signature=${signature}`;
}

/** A pre-signed GET for an object in an R2 bucket, through the account's S3-compatible endpoint. */
export function r2PresignedGet(input: {
  accountId: string;
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresSeconds: number;
  now: Date;
}) {
  return presignedGet({
    host: `${input.accountId}.r2.cloudflarestorage.com`,
    path: `/${encodeRfc3986(input.bucket)}/${encodeKey(input.key)}`,
    region: "auto",
    accessKeyId: input.accessKeyId,
    secretAccessKey: input.secretAccessKey,
    expiresSeconds: input.expiresSeconds,
    now: input.now,
  });
}
