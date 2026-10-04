import { TURNSTILE_ORIGIN } from "./turnstile";

/**
 * Only an environment that sets ALLOW_INDEXING = "true" (production) may be indexed;
 * staging, previews and local builds are always kept out of search engines.
 *
 * `nonce` is null for a page that ships no client JavaScript: it then allows no scripts at all,
 * which also means a cached public page carries no reusable nonce. A public form (`turnstile`)
 * also loads Cloudflare Turnstile's script and frame, and nothing else (app/lib/turnstile.ts).
 * A page that plays or reads video (`video`) may load media from `blob:` addresses, which is how
 * hls.js hands video to the browser and how a chosen file's length is read before it is uploaded,
 * and media and playlists from the video provider's origin when there is one.
 */
export function applySecurityHeaders(
  headers: Headers,
  nonce: string | null,
  {
    allowIndexing,
    turnstile = false,
    video = null,
  }: { allowIndexing: boolean; turnstile?: boolean; video?: { origin: string | null } | null },
) {
  const scripts = [...(nonce ? ["'self'", `'nonce-${nonce}'`] : []), ...(turnstile ? [TURNSTILE_ORIGIN] : [])];
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      scripts.length ? `script-src ${scripts.join(" ")}` : "script-src 'none'",
      ...(turnstile ? [`frame-src ${TURNSTILE_ORIGIN}`] : []),
      "style-src 'self'",
      "img-src 'self' data:",
      ...(video ? [["media-src 'self' blob:", video.origin].filter(Boolean).join(" ")] : []),
      ["connect-src 'self'", video?.origin].filter(Boolean).join(" "),
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (!allowIndexing) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }
}
