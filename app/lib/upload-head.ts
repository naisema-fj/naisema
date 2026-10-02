/**
 * A file's first bytes as an upload request sends them, base64-encoded, for the content check
 * before anything is stored. Anything unusable reads as empty, which fails that check.
 */
export function decodeHead(value: unknown) {
  if (typeof value !== "string" || value.length > 64) return new Uint8Array();
  try {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  } catch {
    return new Uint8Array();
  }
}
