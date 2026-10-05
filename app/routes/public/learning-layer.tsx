import { data, redirect } from "react-router";
import { LearnerPlayer } from "~/components/learner-player";
import { isPrimaryArea } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { learnerView, readStage } from "~/lib/immersion";
import { languageName, languageTag } from "~/lib/language-variety";
import { learnerLayerState } from "~/lib/learner-progress.server";
import { getLearner, requireOwnRecords } from "~/lib/learners.server";
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
 * GET /:area/:slug/language/:layerId?stage= — a Learning Layer's immersion player, open to everyone
 * without an account, while both its Video and the Learning Layer are public (VAC-01). Each stage
 * of the immersion route is its own page, sent only what that stage shows (app/lib/immersion.ts),
 * so English a stage leaves out is never on the page. A signed-in learner's progress comes from
 * their account (#33).
 */
export async function loader({ params, request, context }: Route.LoaderArgs) {
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
  const learner = await getLearner(env, request);
  if (learner) requireOwnRecords(learner, "learnerRecord.read");
  const view = learnerView(snapshot, readStage(new URL(request.url).searchParams.get("stage")));
  return data({
    layerId: layer.id,
    revisionId: layer.revisionId,
    playerPath: `/${params.area}/${params.slug}/language/${layer.id}`,
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
    view,
    tracks: {
      taught: `/language/${layer.id}/captions/fijian`,
      english: view.englishTrack ? `/language/${layer.id}/captions/english` : null,
    },
    contentItemId: video.id,
    learner: learner
      ? {
          userId: learner.userId,
          ...(await learnerLayerState(db, learner.userId, { ...layer, contentItemId: video.id })),
        }
      : null,
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
