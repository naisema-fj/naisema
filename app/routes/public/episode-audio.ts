import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { rangedResponse, readyEpisodeAudio } from "~/lib/media-delivery.server";
import { publicItem } from "~/lib/visibility.server";
import type { Route } from "./+types/episode-audio";

/**
 * GET /episodes/:id/audio — a published Episode's audio for the native `<audio>` player, from R2
 * with byte ranges (docs/phase-1a-defaults.md §9). Served through the Episode, so its eligibility
 * is decided on every request (ADR-0007), and never cached.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const db = getDb(env.DB);
  const found = await publicItem(db, params.id);
  const published = found?.item.type === "episode" ? found : null;
  const episode = published?.snapshot.episode;
  const asset = episode ? await readyEpisodeAudio(db, episode.audioAssetId) : undefined;
  const response = asset ? await rangedResponse(env.MEDIA, request, asset, "no-store") : null;
  if (!response) throw new Response("Not found", { status: 404 });
  return response;
}
