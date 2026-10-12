import { ProviderError, videoProvider } from "./video-provider.server";

/**
 * Where a Review Link plays a video from: the local stand-in's own address in development and
 * tests, otherwise Stream's signed address. Null if the video can't be played right now. The caller
 * has already checked the link is active and that the footage may still be shown to anyone outside.
 */
export async function reviewLinkPlayback(
  env: Env,
  token: string,
  video: { id: string; providerId: string | null; state: string },
): Promise<{ src: string; hls: boolean } | null> {
  if (video.state !== "ready" || !video.providerId) return null;
  if (env.VIDEO_PROVIDER === "local") return { src: `/review/${token}/video`, hls: false };
  try {
    const signed = await videoProvider(env).playback({ id: video.id, providerId: video.providerId }, new Date());
    return { src: signed.url, hls: signed.hls };
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error;
    return null;
  }
}
