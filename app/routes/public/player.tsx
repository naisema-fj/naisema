import { LearnerPlayer } from "~/components/learner-player";
import { isPrimaryArea } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import { itemPath } from "~/lib/content-rules";
import { getDb } from "~/lib/db.server";
import { PRIVATE_NO_STORE } from "~/lib/http";
import { learnerView, readStage } from "~/lib/immersion";
import { languageName, languageTag } from "~/lib/language-variety";
import { LAYER_LANGUAGE_VARIETY } from "~/lib/learning-layer-fields";
import { playWindow } from "~/lib/player-rules";
import { findPublicLayer } from "~/lib/public-layer.server";
import type { RouteHandle } from "~/lib/route-handle";
import type { Route } from "./+types/player";

export const handle: RouteHandle = { video: true };

/** The page carries a nonce for its scripts, so it is never kept. */
export function headers() {
  return { "Cache-Control": PRIVATE_NO_STORE };
}

/**
 * GET /:area/:slug/language?stage=: a Video's Learning Layer in the immersion player, open to
 * everyone, while the Video is public. Each stage is its own page, sent only what that stage shows
 * (app/lib/immersion.ts), so English a stage leaves out is never on the page.
 */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  if (!isPrimaryArea(params.area)) throw new Response("Not found", { status: 404 });
  const db = getDb(context.get(cloudflareContext).env.DB);
  const found = await findPublicLayer(db, params.area, params.slug);
  if (found.kind === "gone") throw new Response("Withdrawn", { status: 410 });
  if (found.kind === "missing") throw new Response("Not found", { status: 404 });
  const { item, revision, layer, footage } = found;
  const view = learnerView(layer, readStage(new URL(request.url).searchParams.get("stage")));
  const storyPath = itemPath(item);
  return {
    layerId: item.id,
    revisionId: revision.id,
    playerPath: `${storyPath}/language`,
    title: layer.title,
    videoTitle: revision.title,
    storyPath,
    playback: { src: footage.src, type: footage.type },
    width: footage.width,
    height: footage.height,
    orientation: footage.orientation,
    span: playWindow(layer.excerpt, footage.durationMs),
    language: { tag: languageTag(LAYER_LANGUAGE_VARIETY), name: languageName(LAYER_LANGUAGE_VARIETY) },
    view,
    tracks: {
      taught: `/videos/${item.id}/captions/fijian`,
      english: view.englishTrack ? `/videos/${item.id}/captions/english` : null,
    },
  };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "NAISEMA" }];
  return [
    { title: `${loaderData.title}: explore the language of ${loaderData.videoTitle} · NAISEMA` },
    { name: "description", content: `Fijian captions, a transcript and word meanings for ${loaderData.videoTitle}.` },
  ];
}

export default function Player({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main" className="article-page player-page">
      <LearnerPlayer {...loaderData} />
    </main>
  );
}
