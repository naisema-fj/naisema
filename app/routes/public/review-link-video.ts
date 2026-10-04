import { eq } from "drizzle-orm";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { loadLayerReview } from "~/lib/layer-review.server";
import { rangedResponse, type StoredFile } from "~/lib/media-delivery.server";
import { activeReviewLink } from "~/lib/review-links.server";
import { videoItem } from "~/lib/video-items.server";
import { mediaAsset } from "~db/schema";
import type { Route } from "./+types/review-link-video";

/**
 * GET /review/:token/video — the local stand-in's playback for a Review Link, in development and
 * tests only: the master, with byte ranges, while the link is active. Where Stream plays videos,
 * the page uses Stream's signed address instead and this answers 404.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  if (env.VIDEO_PROVIDER !== "local") throw new Response("Not found", { status: 404 });
  const db = getDb(env.DB);
  const link = await activeReviewLink(db, params.token);
  if (!link) throw new Response("This Review Link no longer opens.", { status: 403 });
  const review = await loadLayerReview(db, link.revisionId);
  const video = review && (await videoItem(db, review.layer.contentItemId));
  const asset = video && (await db.select().from(mediaAsset).where(eq(mediaAsset.id, video.video.id)).get());
  const response =
    video?.video.state === "ready" && asset
      ? await rangedResponse(
          env.VIDEO_MASTERS,
          request,
          {
            id: asset.id,
            destinationKey: video.video.masterKey,
            size: asset.size,
            type: asset.type,
          } satisfies StoredFile,
          "private, no-store",
        )
      : null;
  if (!response) throw new Response("Not found", { status: 404 });
  return response;
}
