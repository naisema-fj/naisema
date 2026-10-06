import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { PRIVATE_NO_STORE } from "~/lib/public-cache.server";
import { publicLayer } from "~/lib/visibility.server";
import { toWebVtt } from "~/lib/webvtt";
import type { Route } from "./+types/layer-captions";

/**
 * GET /language/:layerId/captions/:language — a public Learning Layer's captions in Fijian or
 * English, generated from its published Revision's Segments for the player's native tracks, in the
 * video's own time (an Excerpt's Segments shifted by its in time). Never uploaded to Stream, never cached.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  if (params.language !== "fijian" && params.language !== "english") throw new Response("Not found", { status: 404 });
  const found = await publicLayer(getDb(context.get(cloudflareContext).env.DB), params.layerId);
  if (!found) throw new Response("Not found", { status: 404 });
  const { snapshot } = found;
  const vtt = toWebVtt(snapshot.segments, params.language, { offsetMs: snapshot.excerpt?.sourceStartMs ?? 0 });
  return new Response(vtt, {
    headers: { "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": PRIVATE_NO_STORE },
  });
}
