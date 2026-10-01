import { PRIMARY_AREAS } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { publicPath } from "~/lib/public.server";
import { PUBLIC_CACHE_CONTROL } from "~/lib/public-cache.server";
import { sitemapEntries } from "~/lib/search.server";
import type { Route } from "./+types/sitemap";

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The sitemap: the homepage, the six areas and every item in the public index (§5, app/lib/search.server.ts). */
export async function loader({ request, context }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const items = await sitemapEntries(getDb(context.get(cloudflareContext).env.DB));
  const urls = [
    { loc: `${origin}/` },
    ...PRIMARY_AREAS.map((area) => ({ loc: `${origin}/${area}` })),
    ...items.map((item) => ({
      loc: `${origin}${publicPath(item.area, item.slug)}`,
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
