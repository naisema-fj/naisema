import { data, redirect } from "react-router";
import { LearnerPlayer } from "~/components/learner-player";
import { isPrimaryArea } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { languageName, languageTag } from "~/lib/language-variety";
import { playWindow } from "~/lib/player-rules";
import { findPublicLayer, videoPlaybackPath } from "~/lib/public.server";
import { PRIVATE_NO_STORE } from "~/lib/public-cache.server";
import { playbackFor, publicVideoItem } from "~/lib/public-video.server";
import type { RouteHandle } from "~/lib/route-handle";
import type { Route } from "./+types/learning-layer";

export const handle: RouteHandle = { video: true };

/** The page carries a signed playback address and a nonce for its scripts, so it is never kept. */
export function headers() {
  return { "Cache-Control": PRIVATE_NO_STORE };
}

/**
 * GET /:area/:slug/language/:layerId — a Learning Layer's immersion player, open to everyone
 * without an account, while both its Video and the Learning Layer are public (VAC-01).
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  if (!isPrimaryArea(params.area)) throw new Response("Not found", { status: 404 });
  const { env } = context.get(cloudflareContext);
  const db = getDb(env.DB);
  const found = await findPublicLayer(db, params.area, params.slug, params.layerId);
  if (found.kind === "moved") throw redirect(found.to, 301);
  if (found.kind === "withdrawn") throw new Response("Withdrawn", { status: 410 });
  if (found.kind === "missing") throw new Response("Not found", { status: 404 });
  const { video, layer } = found;
  const item = await publicVideoItem(db, video.id);
  if (!item || !video.video) throw new Response("Not found", { status: 404 });
  const { snapshot } = layer;
  return data({
    title: snapshot.title,
    videoTitle: video.title,
    storyPath: `/${params.area}/${params.slug}`,
    playback: await playbackFor(env, item),
    refreshPath: videoPlaybackPath(video.id),
    width: video.video.width,
    height: video.video.height,
    orientation: video.video.orientation,
    span: playWindow(snapshot.excerpt, video.video.durationMs),
    language: { tag: languageTag(layer.languageVariety), name: languageName(layer.languageVariety) },
    segments: snapshot.segments,
    annotations: snapshot.annotations,
    expressions: snapshot.expressions,
    tracks: {
      taught: `/language/${layer.id}/captions/fijian`,
      english: `/language/${layer.id}/captions/english`,
    },
  });
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Na iSema" }];
  return [
    { title: `${loaderData.title}: explore the language of ${loaderData.videoTitle} · Na iSema` },
    { name: "description", content: `Fijian captions, a transcript and word meanings for ${loaderData.videoTitle}.` },
  ];
}

export default function LearningLayerPlayer({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main" className="article-page player-page">
      <LearnerPlayer {...loaderData} />
    </main>
  );
}
