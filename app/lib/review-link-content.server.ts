import { eq } from "drizzle-orm";
import { videoAsset } from "~db/schema";
import { footageOf } from "./article-fields";
import type { Database } from "./db.server";
import { readyEpisodeAudio } from "./media-delivery.server";
import { loadReview } from "./review.server";
import { reviewLinkPlayback } from "./review-link-playback.server";
import { revisionDisplay } from "./revision-display.server";
import { reviewLinkMayPlay } from "./visibility.server";

/**
 * What a Review Link to a Content Item Revision shows (#44): the Revision as its staff page does,
 * and its audio or video where they may still be played to someone outside. Playback stops once the
 * Publish grant on the item or the file is withdrawn, or the item is on hold; the caller has already
 * checked the link itself is active.
 */
export async function contentLinkPage(env: Env, db: Database, token: string, contentRevisionId: string) {
  const review = await loadReview(db, contentRevisionId);
  if (!review) return null;
  const { content } = review;
  const itemId = review.contentItem.id;

  const audioId = content.episode && !content.episode.videoAssetId ? content.episode.audioAssetId : null;
  const audio =
    audioId &&
    (await readyEpisodeAudio(db, audioId)) &&
    (await reviewLinkMayPlay(db, { id: itemId, video: { id: audioId } }))
      ? { src: `/review/${token}/audio` }
      : null;

  const footageId = footageOf(content);
  const footage = footageId ? await db.select().from(videoAsset).where(eq(videoAsset.id, footageId)).get() : null;
  const playback =
    footage && (await reviewLinkMayPlay(db, { id: itemId, video: { id: footage.id } }))
      ? await reviewLinkPlayback(env, token, footage)
      : null;

  return {
    number: review.number,
    contentType: review.contentItem.type,
    snapshot: content,
    display: await revisionDisplay(db, content, false),
    audio,
    hasFootage: footageId !== null,
    playback,
  };
}
