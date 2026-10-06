import { eq } from "drizzle-orm";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { loadLayerReview } from "~/lib/layer-review.server";
import { rangedResponse, type StoredFile } from "~/lib/media-delivery.server";
import { PRIVATE_NO_STORE } from "~/lib/public-cache.server";
import { reviewLinkForPlayback } from "~/lib/review-links.server";
import { videoItem } from "~/lib/video-items.server";
import { reviewLinkMayPlay } from "~/lib/visibility.server";
import { mediaAsset } from "~db/schema";
import type { Route } from "./+types/review-link-video";

/** The first request of a play: no range, or a range from the very start. */
const startsPlay = (request: Request) => {
  const range = request.headers.get("Range");
  return range === null || /^bytes=0-/.test(range);
};

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
  const review = await loadLayerReview(db, link.revisionId);
  const video = review && (await videoItem(db, review.layer.contentItemId));
  if (!video || !(await reviewLinkMayPlay(db, video))) throw new Response("Not found", { status: 404 });
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
