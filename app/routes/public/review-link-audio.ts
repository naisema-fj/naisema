import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { rangedResponse, readyEpisodeAudio } from "~/lib/media-delivery.server";
import { PRIVATE_NO_STORE } from "~/lib/public-cache.server";
import { loadReview } from "~/lib/review.server";
import { reviewLinkForPlayback } from "~/lib/review-links.server";
import { reviewLinkMayPlay } from "~/lib/visibility.server";
import type { Route } from "./+types/review-link-audio";

/** The first request of a play: no range, or a range from the very start. */
const startsPlay = (request: Request) => {
  const range = request.headers.get("Range");
  return range === null || /^bytes=0-/.test(range);
};

/**
 * GET /review/:token/audio — an audio Episode's recording, for a Review Link to that Revision, while
 * the link is active and only while the Publish grant on the item or the file hasn't been withdrawn
 * and the item isn't on hold. Each play is logged. Never cached or indexed.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const db = getDb(env.DB);
  const link = await reviewLinkForPlayback(db, params.token, startsPlay(request));
  if (!link?.contentRevisionId) throw new Response("This Review Link no longer opens.", { status: 403 });
  const review = await loadReview(db, link.contentRevisionId);
  const episode = review?.content.episode;
  if (!review || !episode || episode.videoAssetId) throw new Response("Not found", { status: 404 });
  const mayPlay = await reviewLinkMayPlay(db, { id: review.contentItem.id, video: { id: episode.audioAssetId } });
  const asset = mayPlay ? await readyEpisodeAudio(db, episode.audioAssetId) : undefined;
  const response = asset ? await rangedResponse(env.MEDIA, request, asset, PRIVATE_NO_STORE) : null;
  if (!response) throw new Response("Not found", { status: 404 });
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
