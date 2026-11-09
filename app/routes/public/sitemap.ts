import { cloudflareContext } from "~/lib/cloudflare";
import { itemPath } from "~/lib/content-rules";
import { publicItems } from "~/lib/content.server";
import { getDb } from "~/lib/db.server";
import { PRIMARY_AREAS } from "~/lib/areas";
import type { Route } from "./+types/sitemap";

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** GET /sitemap.xml: the areas and every eligible item, from the same rule the pages use. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const items = await publicItems(getDb(context.get(cloudflareContext).env.DB), { limit: 2000 });
  const urls = [
    `${origin}/`,
    ...PRIMARY_AREAS.map((area) => `${origin}/${area}`),
    ...items.map(({ item }) => `${origin}${itemPath(item)}`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${escape(url)}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-cache" } });
}
