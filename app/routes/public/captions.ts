import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { PRIVATE_NO_STORE } from "~/lib/http";
import { findPublicLayerById } from "~/lib/public-layer.server";
import { toWebVtt } from "~/lib/webvtt";
import type { Route } from "./+types/captions";

/**
 * GET /videos/:itemId/captions/:language: a public Learning Layer's captions in Fijian or English,
 * generated from its published Revision's Segments for the player's native tracks, in the video's
 * own time (an Excerpt's Segments shifted by its in time). Never stored anywhere else, never cached.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  if (params.language !== "fijian" && params.language !== "english") throw new Response("Not found", { status: 404 });
  const found = await findPublicLayerById(getDb(context.get(cloudflareContext).env.DB), params.itemId);
  if (found.kind !== "shown") throw new Response("Not found", { status: 404 });
  const { layer } = found;
  const vtt = toWebVtt(layer.segments, params.language, { offsetMs: layer.excerpt?.sourceStartMs ?? 0 });
  return new Response(vtt, { headers: { "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": PRIVATE_NO_STORE } });
}
