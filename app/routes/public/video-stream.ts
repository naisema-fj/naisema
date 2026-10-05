import { eq } from "drizzle-orm";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { rangedResponse, type StoredFile } from "~/lib/media-delivery.server";
import { PRIVATE_NO_STORE } from "~/lib/public-cache.server";
import { publicFootage } from "~/lib/visibility.server";
import { mediaAsset } from "~db/schema";
import type { Route } from "./+types/video-stream";

/**
 * GET /videos/:itemId/stream — the local stand-in's playback of a public Video, in development and
 * tests only: the master, with byte ranges, while the Video is public. Where Stream plays videos,
 * players use Stream's signed address and this answers 404.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  if (env.VIDEO_PROVIDER !== "local") throw new Response("Not found", { status: 404 });
  const db = getDb(env.DB);
  const video = await publicFootage(db, params.itemId);
  const asset = video && (await db.select().from(mediaAsset).where(eq(mediaAsset.id, video.asset.id)).get());
  const response =
    video && asset
      ? await rangedResponse(
          env.VIDEO_MASTERS,
          request,
          {
            id: asset.id,
            destinationKey: video.asset.masterKey,
            size: asset.size,
            type: asset.type,
          } satisfies StoredFile,
          PRIVATE_NO_STORE,
        )
      : null;
  if (!response) throw new Response("Not found", { status: 404 });
  return response;
}
