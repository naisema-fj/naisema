import { cloudflareContext } from "~/lib/cloudflare";
import { LAYER_LEVELS, layerSpan } from "~/lib/learning-layer-fields";
import { layersFor, requireLayerStaff, videosFor } from "~/lib/learning-layers.server";
import type { Route } from "./+types/index";

export function meta() {
  return [{ title: "Learning Layers · Na iSema staff" }];
}

/**
 * GET /admin/learning-layers — the Learning Layers someone may open (an Educator's assigned ones,
 * every one for an editor) and the Videos they may add one to.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { db, actor, isEditor } = await requireLayerStaff(context.get(cloudflareContext).env, request);
  const [layers, videos] = await Promise.all([layersFor(db, actor), videosFor(db, actor)]);
  const videoTitles = new Map(videos.map((video) => [video.id, video.title]));
  return {
    isEditor,
    videos,
    layers: layers.map((layer) => ({
      ...layer,
      level: LAYER_LEVELS[layer.level],
      clip: layerSpan(layer.excerpt),
      videoTitle: videoTitles.get(layer.contentItemId) ?? null,
    })),
  };
}

export default function LearningLayers({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main" className="page page-wide">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Learning Layers</h1>
      <h2>{loaderData.isEditor ? "Every Learning Layer" : "Learning Layers assigned to you"}</h2>
      {loaderData.layers.length ? (
        <ul className="item-list">
          {loaderData.layers.map((layer) => (
            <li key={layer.id}>
              <a href={`/admin/learning-layers/${layer.id}`}>{layer.title}</a>
              <span className="meta">
                {[
                  layer.videoTitle,
                  layer.level,
                  layer.clip,
                  `${layer.segmentCount} ${layer.segmentCount === 1 ? "Segment" : "Segments"}`,
                  layer.draftCount ? `${layer.draftCount} unreviewed` : null,
                  `revision ${layer.revisionNumber}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          {loaderData.isEditor
            ? "No Learning Layers yet."
            : "None yet. An editor assigns you to a Video or a Learning Layer."}
        </p>
      )}
      <h2>{loaderData.isEditor ? "Videos" : "Videos you can add Learning Layers to"}</h2>
      {loaderData.videos.length ? (
        <ul className="item-list">
          {loaderData.videos.map((video) => (
            <li key={video.id}>
              <a href={`/admin/videos/${video.id}/learning-layers`}>{video.title}</a>
            </li>
          ))}
        </ul>
      ) : (
        <p>{loaderData.isEditor ? "No Videos yet. Add one under Content." : "None yet."}</p>
      )}
    </main>
  );
}
