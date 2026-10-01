import { createContext, useContext } from "react";

/** The per-response CSP nonce; every inline script rendered on the server must carry it. */
export const NonceContext = createContext<string | undefined>(undefined);

export function useNonce() {
  return useContext(NonceContext);
}

export function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Only an environment that sets ALLOW_INDEXING = "true" (production) may be indexed;
 * staging, previews and local builds are always kept out of search engines.
 */
/**
 * `nonce` is null for a page that ships no client JavaScript: it then allows no scripts at all,
 * which also means a cached public page carries no reusable nonce.
 */
export function applySecurityHeaders(
  headers: Headers,
  nonce: string | null,
  { allowIndexing }: { allowIndexing: boolean },
) {
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      nonce ? `script-src 'self' 'nonce-${nonce}'` : "script-src 'none'",
      "style-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self'",
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
