import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { PRIVATE_NO_STORE } from "~/lib/public-cache.server";
import { publicLayer } from "~/lib/visibility.server";
import type { Route } from "./+types/layer-english";

/**
 * GET /language/:layerId/english/:segmentId — the English of one line of a public Learning Layer,
 * as JSON, for the player to show when a learner asks for it in a stage that leaves English off the
 * page (VID-04/09). One line at a time, so asking for one brings no others. Never cached; refused
 * once the Learning Layer isn't public.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const found = await publicLayer(getDb(context.get(cloudflareContext).env.DB), params.layerId);
  const line = found?.snapshot.segments.find((segment) => segment.id === params.segmentId);
  const headers = { "Cache-Control": PRIVATE_NO_STORE };
  if (!line) return Response.json({ error: "This line isn't available." }, { status: 404, headers });
  return Response.json({ english: line.english }, { headers });
}
