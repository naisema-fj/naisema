import { cloudflareContext } from "~/lib/cloudflare";
import type { Route } from "./+types/robots";

/** Only production may be crawled; every other environment asks crawlers to stay away. */
export function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const origin = new URL(request.url).origin;
  const body =
    env.ALLOW_INDEXING === "true"
      ? `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${origin}/sitemap.xml\n`
      : "User-agent: *\nDisallow: /\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
