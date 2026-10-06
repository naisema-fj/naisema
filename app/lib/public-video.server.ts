import { ProviderError, videoProvider } from "./video-provider.server";
import type { PublicFootage } from "./visibility.server";

/**
 * Playing public footage (ADR-0008, #28's serving rule). Whether there is any to play is the
 * visibility decision, asked on every request (app/lib/visibility.server.ts), so a withdrawal or a
 * rights lapse stops playback within the life of one short playback address.
 */

/** The address public footage plays from: Stream's signed address, or locally the site's own route. */
export async function playbackFor(env: Env, video: PublicFootage): Promise<{ src: string; hls: boolean } | null> {
  if (!video.asset.providerId) return null;
  // Each local address differs, as each signed one does, so a player asking again really reloads.
  if (env.VIDEO_PROVIDER === "local") return { src: `/videos/${video.item.id}/stream?v=${Date.now()}`, hls: false };
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
