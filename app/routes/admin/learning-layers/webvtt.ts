import { cloudflareContext } from "~/lib/cloudflare";
import { openLearningLayer, requireLayerStaff } from "~/lib/learning-layers.server";
import { downloadName } from "~/lib/upload-rules";
import { toWebVtt } from "~/lib/webvtt";
import type { Route } from "./+types/webvtt";

/**
 * GET /admin/learning-layers/:id/webvtt/:language — the saved draft's Segments as a WebVTT file in
 * Fijian or English, for the editors and Educators who may open the Learning Layer. The cue IDs
 * are the Segment IDs, so an edited English file imports back onto the same Segments.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db, actor } = await requireLayerStaff(context.get(cloudflareContext).env, request);
  if (params.language !== "fijian" && params.language !== "english") throw new Response("Not found", { status: 404 });
  const opened = await openLearningLayer(db, actor, params.id);
  if (!opened.ok) throw new Response(opened.status === 404 ? "Not found" : "Forbidden", { status: opened.status });
  const { snapshot } = opened.layer.currentRevision;
  const name = downloadName(`${snapshot.title}-${params.language === "fijian" ? "fj" : "en"}.vtt`);
  return new Response(toWebVtt(snapshot.segments, params.language), {
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
