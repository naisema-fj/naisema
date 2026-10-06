import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { recordEvent } from "~/lib/events.server";
import { fileDownload, readyDownload } from "~/lib/media-delivery.server";
import { publicItem } from "~/lib/visibility.server";
import type { Route } from "./+types/resource-download";

/**
 * GET /resources/:id/download — a published Resource's file, served here rather than from its
 * media address so the Resource's eligibility is decided on every download (ADR-0007): once it is
 * withdrawn or its rights lapse, the file stops too. Never cached; counts `resource_downloaded`.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const db = getDb(env.DB);
  const found = await publicItem(db, params.id);
  const published = found?.item.type === "resource" ? found : null;
  const item = published?.item;
  const source = published?.snapshot.resource?.source;
  const asset = source?.kind === "file" ? await readyDownload(db, source.assetId) : undefined;
  const response = asset ? await fileDownload(env, asset, "no-store") : null;
  if (!item || !asset || !response) throw new Response("Not found", { status: 404 });
  recordEvent(env, "resource_downloaded", [item.id, asset.id]);
  return response;
}
