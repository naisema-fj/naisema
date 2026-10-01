import { eq } from "drizzle-orm";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { audioResponse, readyEpisodeAudio } from "~/lib/media-delivery.server";
import { eligiblePublished } from "~/lib/public.server";
import { contentItem } from "~db/schema";
import type { Route } from "./+types/episode-audio";

/**
 * GET /episodes/:id/audio — a published Episode's audio for the native `<audio>` player, from R2
 * with byte ranges (docs/phase-1a-defaults.md §9). Served through the Episode, so its eligibility
 * is decided on every request (ADR-0007), and never cached.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const db = getDb(env.DB);
  const item = await db.select().from(contentItem).where(eq(contentItem.id, params.id)).get();
  const published = item?.type === "episode" ? await eligiblePublished(db, item, new Date()) : null;
  const episode = published?.snapshot.episode;
  const asset = episode ? await readyEpisodeAudio(db, episode.audioAssetId) : undefined;
  const response = asset ? await audioResponse(env, request, asset, "no-store") : null;
  if (!response) throw new Response("Not found", { status: 404 });
  return response;
}
