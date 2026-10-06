import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { recordEvent } from "~/lib/events.server";
import { publicItem } from "~/lib/visibility.server";
import type { Route } from "./+types/opened";

/**
 * GET /e/opened/:id — the `content_opened` event, requested by an image on each content page so
 * views count even when the page itself came from the edge cache. Only an item that is public right
 * now is counted (ADR-0007), by its ID alone; never cached.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const db = getDb(env.DB);
  const published = await publicItem(db, params.id);
  if (published) recordEvent(env, "content_opened", [published.item.id]);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
