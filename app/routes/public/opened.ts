import { eq } from "drizzle-orm";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { recordEvent } from "~/lib/events.server";
import { eligiblePublished } from "~/lib/public.server";
import { contentItem } from "~db/schema";
import type { Route } from "./+types/opened";

/**
 * GET /e/opened/:id — the `content_opened` event, requested by an image on each content page so
 * views count even when the page itself came from the edge cache. Only an item that is public right
 * now is counted (ADR-0007), by its ID alone; never cached.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const db = getDb(env.DB);
  const item = await db.select().from(contentItem).where(eq(contentItem.id, params.id)).get();
  if (item && (await eligiblePublished(db, item, new Date()))) recordEvent(env, "content_opened", [item.id]);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
