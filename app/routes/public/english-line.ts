import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { PRIVATE_NO_STORE } from "~/lib/http";
import { findPublicLayerById } from "~/lib/public-layer.server";
import type { Route } from "./+types/english-line";

/**
 * GET /videos/:itemId/english/:segmentId: one line's English, for a learner who asks for it in a
 * stage that leaves English off the page. Asking for one line brings no others.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const found = await findPublicLayerById(getDb(context.get(cloudflareContext).env.DB), params.itemId);
  const line =
    found.kind === "shown" ? found.layer.segments.find((segment) => segment.id === params.segmentId) : undefined;
  const headers = { "Cache-Control": PRIVATE_NO_STORE };
  if (!line) return Response.json({ error: "This line isn't available." }, { status: 404, headers });
  return Response.json({ english: line.english }, { headers });
}
