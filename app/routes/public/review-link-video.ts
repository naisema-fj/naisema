import { eq } from "drizzle-orm";
import { footageOf } from "~/lib/article-fields";
import { cloudflareContext } from "~/lib/cloudflare";
import type { Database } from "~/lib/db.server";
import { getDb } from "~/lib/db.server";
import { loadLayerReview } from "~/lib/layer-review.server";
import { rangedResponse, type StoredFile } from "~/lib/media-delivery.server";
import { PRIVATE_NO_STORE } from "~/lib/public-cache.server";
import { loadReview } from "~/lib/review.server";
import { reviewLinkForPlayback } from "~/lib/review-links.server";
import { videoItem } from "~/lib/video-items.server";
import { reviewLinkMayPlay } from "~/lib/visibility.server";
import { mediaAsset, videoAsset } from "~db/schema";
import type { Route } from "./+types/review-link-video";

/** The first request of a play: no range, or a range from the very start. */
const startsPlay = (request: Request) => {
  const range = request.headers.get("Range");
  return range === null || /^bytes=0-/.test(range);
};

/** The footage of the Video a Learning Layer is on, with the item it belongs to, or null. */
async function layerFootage(db: Database, layerRevisionId: string) {
  const review = await loadLayerReview(db, layerRevisionId);
  const video = review && (await videoItem(db, review.layer.contentItemId));
  return video && { id: video.id, video: video.video };
}

/** The footage a Content Item Revision plays (a Video's, or a video Episode's), with its item, or null. */
async function contentFootage(db: Database, contentRevisionId: string) {
  const review = await loadReview(db, contentRevisionId);
  const assetId = review && footageOf(review.content);
  const asset = assetId ? await db.select().from(videoAsset).where(eq(videoAsset.id, assetId)).get() : undefined;
  return review && asset ? { id: review.contentItem.id, video: asset } : null;
}

/**
 * GET /review/:token/video — the local stand-in's playback for a Review Link, in development and
 * tests only: the master, with byte ranges, while the link is active and the footage may still be
 * shown. Each play is logged. Where Stream plays videos, the page uses Stream's signed address and
 * this answers 404.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  if (env.VIDEO_PROVIDER !== "local") throw new Response("Not found", { status: 404 });
  const db = getDb(env.DB);
  const link = await reviewLinkForPlayback(db, params.token, startsPlay(request));
  if (!link) throw new Response("This Review Link no longer opens.", { status: 403 });
  // The footage this link shows: a Learning Layer's Video, or a Content Item Revision's own.
  const footage = link.contentRevisionId
    ? await contentFootage(db, link.contentRevisionId)
    : link.revisionId
      ? await layerFootage(db, link.revisionId)
      : null;
  if (!footage || !(await reviewLinkMayPlay(db, footage))) throw new Response("Not found", { status: 404 });
  const video = footage;
  const asset = await db.select().from(mediaAsset).where(eq(mediaAsset.id, video.video.id)).get();
  const response =
    video.video.state === "ready" && asset
      ? await rangedResponse(
          env.VIDEO_MASTERS,
          request,
          {
            id: asset.id,
            destinationKey: video.video.masterKey,
            size: asset.size,
            type: asset.type,
          } satisfies StoredFile,
          PRIVATE_NO_STORE,
        )
      : null;
  if (!response) throw new Response("Not found", { status: 404 });
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
