import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { playbackFor, publicVideoItem } from "~/lib/public-video.server";
import type { Route } from "./+types/video-playback";

/**
 * GET /videos/:itemId/playback — a fresh, short-lived address for a public Video, as JSON, for the
 * players to ask for when theirs runs out. Never cached; refused once the Video isn't public.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const video = await publicVideoItem(getDb(env.DB), params.itemId);
  const playback = video && (await playbackFor(env, video));
  if (!playback) return Response.json({ error: "This video isn't available." }, { status: 404, headers: NO_STORE });
  return Response.json(playback, { headers: NO_STORE });
}

const NO_STORE = { "Cache-Control": "private, no-store" };
