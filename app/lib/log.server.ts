/**
 * The app's own logs, which reach Workers Logs (`observability` in wrangler.jsonc). Everything
 * passes through `redact` first, so personal details, form bodies and tokens are never logged
 * (docs/phase-1a-defaults.md §7). Log IDs, not people: a record's ID is enough to look it up.
 */

/** Keys whose values are withheld whatever they hold. Compared lower-case. */
const WITHHELD_KEYS = new Set([
  "email",
  "to",
  "from",
  "name",
  "phone",
  "address",
  "ip",
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "body",
  "text",
  "message_body",
  "form",
  "request",
  "headers",
]);

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** The routes whose next path segment is a link token (app/routes.ts). */
const TOKEN_ROUTES = /\/(consent|upload|cases\/appeal)\/[^/?#\s]+/g;
/** A query string: search words, and playback or link tokens. */
const QUERY = /\?[^\s#"']+/g;
/**
 * Random or signed tokens (access-links.ts, signed-tokens.server.ts): long URL-safe runs with an upper-case letter
 * or underscore, which record IDs (UUIDs) and slugs (lower-case) never have.
 */
const LONG_TOKEN = /[A-Za-z0-9_.-]{32,}/g;
const looksLikeToken = (run: string) => /[A-Z_]/.test(run);

const MAX_DEPTH = 6;

function redactText(text: string) {
  return text
    .replace(EMAIL, "[email]")
    .replace(TOKEN_ROUTES, (_match, route: string) => `/${route}/[token]`)
    .replace(QUERY, "?[query]")
    .replace(LONG_TOKEN, (run) => (looksLikeToken(run) ? "[token]" : run));
}

/** A copy of `value` that is safe to log. */
export function redact(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return redactText(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[nested]";
  if (
    value instanceof Request ||
    value instanceof Response ||
    value instanceof FormData ||
    value instanceof Headers ||
    value instanceof URLSearchParams ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value)
  ) {
    return "[redacted]";
  }
  if (value instanceof URL) return redactText(value.href);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactText(value.message),
      ...(value.stack ? { stack: redactText(value.stack) } : {}),
      ...(value instanceof AggregateError ? { errors: value.errors.map((error) => redact(error, depth + 1)) } : {}),
      ...(value.cause !== undefined ? { cause: redact(value.cause, depth + 1) } : {}),
    };
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      WITHHELD_KEYS.has(key.toLowerCase()) ? "[redacted]" : redact(item, depth + 1),
    ]),
  );
}

/**
 * Logs a failure: what happened (a fixed phrase, such as "Upload scan failed") and the IDs and
 * error that explain it. Written as one JSON object, which Workers Logs turns into fields.
 */
export function logError(event: string, details: Record<string, unknown> = {}) {
  console.error(JSON.stringify({ level: "error", event, ...(redact(details) as Record<string, unknown>) }));
}

/** Logs something worth seeing that isn't a failure, redacted the same way. */
export function logInfo(event: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: "info", event, ...(redact(details) as Record<string, unknown>) }));
}
