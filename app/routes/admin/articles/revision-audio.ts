import { cloudflareContext } from "~/lib/cloudflare";
import { rangedResponse, readyEpisodeAudio } from "~/lib/media-delivery.server";
import { requireRevision } from "~/lib/revision-access.server";
import type { Route } from "./+types/revision-audio";

/**
 * GET /admin/articles/:id/revisions/:number/audio — an Episode Revision's audio, for its editors
 * and assigned reviewers to hear what they are approving, published or not. Never cached.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, revision } = await requireRevision(request, env, params);
  const episode = revision.snapshot.episode;
  const asset = episode ? await readyEpisodeAudio(db, episode.audioAssetId) : undefined;
  const response = asset ? await rangedResponse(env.MEDIA, request, asset, "private, no-store") : null;
  if (!response) throw new Response("Not found", { status: 404 });
  return response;
}
