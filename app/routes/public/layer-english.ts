import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { PRIVATE_NO_STORE } from "~/lib/public-cache.server";
import { publicLayerById } from "~/lib/public-video.server";
import type { Route } from "./+types/layer-english";

/**
 * GET /language/:layerId/english — a public Learning Layer's English lines, as JSON, for the player
 * to show when a learner asks for them in a stage that leaves English off the page (VID-04/09).
 * Never cached; refused once the Learning Layer isn't public.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const found = await publicLayerById(getDb(context.get(cloudflareContext).env.DB), params.layerId);
  const headers = { "Cache-Control": PRIVATE_NO_STORE };
  if (!found) return Response.json({ error: "This isn't available." }, { status: 404, headers });
  const lines = found.snapshot.segments.map((segment) => ({ segmentId: segment.id, english: segment.english }));
  return Response.json({ lines }, { headers });
}
