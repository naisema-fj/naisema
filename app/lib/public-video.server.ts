import { eq } from "drizzle-orm";
import { contentItem, learningLayer } from "~db/schema";
import type { Database } from "./db.server";
import { layerEligibility, loadLayerReview } from "./layer-review.server";
import { eligiblePublished } from "./public.server";
import { readyVideo } from "./video-assets.server";
import { ProviderError, videoProvider } from "./video-provider.server";

/**
 * Playing public Videos and their Learning Layers (ADR-0008, #28's serving rule). Every request asks
 * the eligibility decision again (ADR-0007), so a withdrawal or rights lapse stops playback within
 * the life of one short playback address.
 */

/** An item public right now that plays footage (a Video, or a video Episode), with that footage ready, or null. */
export async function publicVideoItem(db: Database, contentItemId: string, now = new Date()) {
  const item = await db.select().from(contentItem).where(eq(contentItem.id, contentItemId)).get();
  if (!item) return null;
  const published = await eligiblePublished(db, item, now);
  const assetId = published?.snapshot.video?.videoAssetId ?? published?.snapshot.episode?.videoAssetId;
  const asset = assetId ? await readyVideo(db, assetId) : undefined;
  return asset ? { item, asset } : null;
}

/** The address a public Video plays from: Stream's signed address, or locally the site's own route. */
export async function playbackFor(
  env: Env,
  video: NonNullable<Awaited<ReturnType<typeof publicVideoItem>>>,
): Promise<{ src: string; hls: boolean } | null> {
  if (!video.asset.providerId) return null;
  if (env.VIDEO_PROVIDER === "local") return { src: `/videos/${video.item.id}/stream`, hls: false };
  try {
    const signed = await videoProvider(env).playback(
      { id: video.asset.id, providerId: video.asset.providerId },
      new Date(),
    );
    return { src: signed.url, hls: signed.hls };
  } catch (error) {
    if (error instanceof ProviderError) return null;
    throw error;
  }
}

/**
 * A Learning Layer that is public right now, by its ID: published, its published Revision eligible,
 * and its Video public too. Returns its published Revision's review and its Video, or null.
 */
export async function publicLayerById(db: Database, learningLayerId: string, now = new Date()) {
  const layer = await db.select().from(learningLayer).where(eq(learningLayer.id, learningLayerId)).get();
  if (layer?.publicationState !== "published" || !layer.currentPublishedRevisionId) return null;
  const video = await publicVideoItem(db, layer.contentItemId, now);
  if (!video) return null;
  const review = await loadLayerReview(db, layer.currentPublishedRevisionId);
  if (!review || !(await layerEligibility(db, review, now)).eligible) return null;
  return { review, video };
}
