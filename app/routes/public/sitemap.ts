import { PRIMARY_AREAS } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import { publicItems } from "~/lib/content.server";
import { itemPath } from "~/lib/content-rules";
import { getDb } from "~/lib/db.server";
import { vosaSlugs } from "~/lib/vosa.server";
import type { Route } from "./+types/sitemap";

const xmlText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * GET /sitemap.xml: the areas and every eligible item, from the same rule the pages use, and Vosa
 * with each of its headwords (each page says whether it is reviewed yet, change note 0002).
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const db = getDb(context.get(cloudflareContext).env.DB);
  const items = await publicItems(db, { limit: 2000 });
  const words = await vosaSlugs(db);
  const urls = [
    `${origin}/`,
    `${origin}/how-it-works`,
    ...PRIMARY_AREAS.map((area) => `${origin}/${area}`),
    ...items.map(({ item }) => `${origin}${itemPath(item)}`),
    `${origin}/vosa`,
    ...words.map((slug) => `${origin}/vosa/${encodeURIComponent(slug)}`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${xmlText(url)}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
