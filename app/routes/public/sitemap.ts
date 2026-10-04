import { PRIMARY_AREAS } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { providerPath } from "~/lib/listing-fields";
import { providerSitemap } from "~/lib/providers.server";
import { itemPath } from "~/lib/public.server";
import { PUBLIC_CACHE_CONTROL } from "~/lib/public-cache.server";
import { sitemapEntries } from "~/lib/search.server";
import type { Route } from "./+types/sitemap";

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The sitemap: the homepage, the six areas, Connect's listings and listed Providers, and every item
 * in the public index (§5, app/lib/search.server.ts).
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const db = getDb(context.get(cloudflareContext).env.DB);
  const [items, providers] = await Promise.all([sitemapEntries(db), providerSitemap(db)]);
  const urls = [
    { loc: `${origin}/` },
    ...PRIMARY_AREAS.map((area) => ({ loc: `${origin}/${area}` })),
    ...["/connect/offerings", "/connect/providers", "/connect/creators"].map((path) => ({ loc: `${origin}${path}` })),
    ...providers.map((row) => ({
      loc: `${origin}${providerPath(row.slug)}`,
      lastmod: row.updatedAt.toISOString().slice(0, 10),
    })),
    ...items.map((item) => ({
      loc: `${origin}${itemPath(item)}`,
      lastmod: item.publishedAt ? new Date(item.publishedAt).toISOString().slice(0, 10) : undefined,
    })),
  ];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      (url) =>
        `<url><loc>${escapeXml(url.loc)}</loc>${"lastmod" in url && url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ""}</url>`,
    ),
    "</urlset>",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": PUBLIC_CACHE_CONTROL },
  });
}
