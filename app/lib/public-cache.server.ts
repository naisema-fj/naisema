import { itemPath } from "./item-paths";

/**
 * Edge caching for public pages (ADR-0007): public HTML is cached for at most five minutes, and
 * publishing, withdrawing or moving an item purges the pages it appears on. Together with the
 * five-minute ceiling this keeps the 15-minute removal target (AC-03).
 *
 * The Cache API is per data centre, so a purge here clears this location at once and every other
 * location within five minutes. When CLOUDFLARE_ZONE_ID and CACHE_PURGE_TOKEN are set, the purge
 * also goes to Cloudflare's zone purge API, which clears every location.
 *
 * Cached pages are keyed by the deployed Worker version as well as the URL. A page names the
 * hashed stylesheet of the build that rendered it, so after a deploy the new version renders
 * afresh rather than serving pages that point at assets the deploy removed.
 */

export const PUBLIC_CACHE_SECONDS = 300;

/** The Workers default cache; app code is typed against the browser's CacheStorage, which lacks it. */
const edgeCache = () => (caches as unknown as { default: Cache }).default;

/** For a public answer that carries something short-lived or must be decided afresh each time. */
export const PRIVATE_NO_STORE = "private, no-store";

/** The Cache-Control a public route sends to be edge-cached; browsers keep it for a minute. */
export const PUBLIC_CACHE_CONTROL = `public, max-age=60, s-maxage=${PUBLIC_CACHE_SECONDS}`;

/**
 * The edge cache key for a public URL under this Worker version. Cached pages don't read the query
 * string (search, which does, is never cached), so it is dropped: one cached copy per page, which a
 * purge by path always reaches.
 */
export function publicCacheKey(env: Env, url: string) {
  const key = new URL(url);
  key.search = "";
  key.searchParams.set("__version", env.CF_VERSION_METADATA.id);
  return key.toString();
}

/**
 * Serves a public GET from the edge cache when it can, and caches cacheable answers. Data requests
 * (`*.data`, a client-side navigation's loader data) are never cached: purges only reach pages.
 */
export async function servePublic(request: Request, env: Env, ctx: ExecutionContext, render: () => Promise<Response>) {
  if (request.method !== "GET" || new URL(request.url).pathname.endsWith(".data")) return render();
  const cache = edgeCache();
  const key = publicCacheKey(env, request.url);
  const hit = await cache.match(key);
  if (hit) return hit;
  const response = await render();
  if (response.status === 200 && response.headers.get("Cache-Control") === PUBLIC_CACHE_CONTROL) {
    ctx.waitUntil(cache.put(key, response.clone()));
  }
  return response;
}

/** The public pages an item appears on: its own page, its area, the homepage and the sitemap. */
export const pagesShowing = (item: { type: string; area: string; slug: string; topicSlugs?: string[] }) => [
  "/",
  itemPath({ type: item.type, primaryArea: item.area, slug: item.slug }),
  ...(item.type === "page" ? [] : [`/${item.area}`]),
  ...(item.type === "creator" ? ["/connect/creators"] : []),
  ...(item.topicSlugs ?? []).map((slug) => `/topics/${slug}`),
  "/sitemap.xml",
];

/** The public site's main address, for linking to it from the admin host. */
export const primaryPublicOrigin = (env: Env) => env.PUBLIC_ORIGINS.split(",")[0]?.trim() ?? "";

/** Purges public pages from the edge cache, here at once and everywhere when a zone token is set. */
export async function purgePublicPages(env: Env, paths: string[]) {
  const origins = env.PUBLIC_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const urls = origins.flatMap((origin) => paths.map((path) => publicCacheKey(env, new URL(path, origin).toString())));
  await Promise.all(urls.map((url) => edgeCache().delete(url)));

  const zone = "CLOUDFLARE_ZONE_ID" in env ? (env.CLOUDFLARE_ZONE_ID as string | undefined) : undefined;
  const token = "CACHE_PURGE_TOKEN" in env ? (env.CACHE_PURGE_TOKEN as string | undefined) : undefined;
  if (zone && token) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ files: urls }),
    });
    if (!response.ok) console.error("Zone cache purge failed", response.status);
  }
}

/** A public route's `headers`: cacheable when it rendered, never when it answered with an error. */
export function publicHeaders({ errorHeaders }: { errorHeaders?: Headers }) {
  return { "Cache-Control": errorHeaders ? "no-store" : PUBLIC_CACHE_CONTROL };
}
