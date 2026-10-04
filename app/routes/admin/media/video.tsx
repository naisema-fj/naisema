import { data, Form } from "react-router";
import { VideoPreview } from "~/components/video-preview";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireUploader } from "~/lib/media-access.server";
import { formatBytes } from "~/lib/upload-rules";
import { checkVideo, retryVideo, videoDetail } from "~/lib/video-assets.server";
import { ProviderError, videoProvider } from "~/lib/video-provider.server";
import { formatVideoLength, ORIENTATION_NAMES, VIDEO_PROVIDER_NAMES, VIDEO_STATE_NAMES } from "~/lib/video-rules";
import type { Route } from "./+types/video";

// Plays the preview from the video provider, so the page's policy allows its media.
export const handle = { video: true };
// The preview address is signed and short-lived: never keep a copy of the page.
export const headers = () => ({ "Cache-Control": "private, no-store" });

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.name ?? "Video"} · Na iSema staff` }];
}

async function requireVideo(env: Env, request: Request, id: string) {
  const staff = await requireUploader(env, request);
  const detail = await videoDetail(staff.db, id);
  if (!detail) throw new Response("Not found", { status: 404 });
  return { ...staff, detail };
}

/**
 * GET /admin/media/:id/video — a Video Asset: its master's facts, where processing has got to (and
 * why it failed), and once ready a preview through a signed address that lasts about ten minutes.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { detail } = await requireVideo(env, request, params.id);
  const { video } = detail;
  let preview: { src: string; hls: boolean } | null = null;
  let previewError: string | null = null;
  if (video.state === "ready" && video.providerId) {
    try {
      const playback = await videoProvider(env).playback({ id: video.id, providerId: video.providerId }, new Date());
      preview = { src: playback.url, hls: playback.hls };
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      previewError = error.message;
    }
  }
  return {
    id: video.id,
    name: detail.name,
    size: formatBytes(detail.size),
    owner: detail.ownerName,
    state: video.state,
    stateName: VIDEO_STATE_NAMES[video.state],
    reason: video.stateReason,
    length: formatVideoLength(video.durationMs),
    picture: `${video.width} × ${video.height}`,
    orientation: ORIENTATION_NAMES[video.orientation],
    provider: VIDEO_PROVIDER_NAMES[video.provider],
    providerId: video.providerId,
    environment: video.environment,
    preview,
    previewError,
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor, detail } = await requireVideo(env, request, params.id);
  const intent = (await request.formData()).get("intent");
  const provider = videoProvider(env);
  if (intent === "check") {
    const result = await checkVideo(db, detail.video.id, provider, actor.userId);
    return { message: result === "moved" ? "Updated from Stream." : "No change yet. Check again in a few minutes." };
  }
  if (intent === "retry") {
    const result = await retryVideo(db, detail.video.id, provider, actor.userId);
    return {
      message:
        result === "sent"
          ? "Sent for processing again."
          : result === "failed"
            ? "It was refused again; the reason is shown above."
            : "It couldn't be sent just now. It will be sent again automatically within a day.",
    };
  }
  return data({ message: "Choose what to do." }, { status: 400 });
}

export default function VideoAssetPage({ loaderData, actionData }: Route.ComponentProps) {
  const video = loaderData;
  return (
    <main id="main" className="page page-wide">
      <p>
        <a href="/admin/media">Back to the media library</a>
      </p>
      <h1>{video.name}</h1>
      <p role="status">
        <strong>{video.stateName}</strong>
        {video.reason && <span className="state-reason">{video.reason}</span>}
      </p>
      {actionData?.message && <p role="status">{actionData.message}</p>}
      {video.state === "processing" && (
        <Form method="post">
          <input type="hidden" name="intent" value="check" />
          <button type="submit">Check with Stream now</button>
        </Form>
      )}
      {video.state === "failed" && (
        <Form method="post">
          <input type="hidden" name="intent" value="retry" />
          <button type="submit">Try processing again</button>
        </Form>
      )}
      {video.preview && (
        <section aria-labelledby="preview-heading">
          <h2 id="preview-heading">Preview</h2>
          <VideoPreview src={video.preview.src} hls={video.preview.hls} label={`Preview of ${video.name}`} />
          <p className="hint">The preview link lasts about ten minutes. Reload the page for a new one.</p>
        </section>
      )}
      {video.previewError && <p role="alert">{video.previewError}</p>}
      <h2>Master</h2>
      <dl className="video-facts">
        <dt>Length</dt>
        <dd>{video.length}</dd>
        <dt>Picture</dt>
        <dd>{`${video.picture} (${video.orientation})`}</dd>
        <dt>File size</dt>
        <dd>{video.size}</dd>
        <dt>Uploaded by</dt>
        <dd>{video.owner}</dd>
        <dt>Processed by</dt>
        <dd>
          {video.provider}
          {video.providerId && <span className="video-id">Video ID {video.providerId}</span>}
        </dd>
        <dt>Environment</dt>
        <dd>{video.environment}</dd>
      </dl>
      <p className="hint">
        The master is kept as Na iSema's original in private storage. Stream holds only a copy for playing it.
      </p>
    </main>
  );
}
