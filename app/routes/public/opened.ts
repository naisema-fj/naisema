import { eq } from "drizzle-orm";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { recordEvent } from "~/lib/events.server";
import { contentItem } from "~db/schema";
import type { Route } from "./+types/opened";

/**
 * GET /e/opened/:id — the `content_opened` event, requested by an image on each content page so
 * views count even when the page itself came from the edge cache. IDs only; never cached.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const item = await getDb(env.DB)
    .select({ id: contentItem.id, type: contentItem.type, publicationState: contentItem.publicationState })
    .from(contentItem)
    .where(eq(contentItem.id, params.id))
    .get();
  if (item?.publicationState === "published") recordEvent(env, "content_opened", [item.id, item.type]);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
