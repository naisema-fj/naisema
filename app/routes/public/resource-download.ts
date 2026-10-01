import { eq } from "drizzle-orm";
import { redirect } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { recordEvent } from "~/lib/events.server";
import { filePath } from "~/lib/media-delivery.server";
import { eligiblePublished } from "~/lib/public.server";
import { contentItem } from "~db/schema";
import type { Route } from "./+types/resource-download";

/**
 * GET /resources/:id/download — a published Resource's file. Counts the download
 * (`resource_downloaded`, IDs only), then sends the visitor to the scanned file itself.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const db = getDb(env.DB);
  const item = await db.select().from(contentItem).where(eq(contentItem.id, params.id)).get();
  const published = item?.type === "resource" ? await eligiblePublished(db, item, new Date()) : null;
  const source = published?.snapshot.resource?.source;
  if (!item || source?.kind !== "file") throw new Response("Not found", { status: 404 });
  recordEvent(env, "resource_downloaded", [item.id, source.assetId]);
  throw redirect(filePath(source.assetId), { headers: { "Cache-Control": "no-store" } });
}
