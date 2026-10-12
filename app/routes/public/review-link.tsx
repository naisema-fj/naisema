import { data } from "react-router";
import { ContentRevisionView } from "~/components/content-revision-view";
import { LayerRevisionView } from "~/components/layer-revision-view";
import { VideoPreview } from "~/components/video-preview";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { loadLayerReview } from "~/lib/layer-review.server";
import { PRIVATE_NO_STORE } from "~/lib/public-cache.server";
import { contentLinkPage } from "~/lib/review-link-content.server";
import { reviewLinkPlayback } from "~/lib/review-link-playback.server";
import { openReviewLink } from "~/lib/review-links.server";
import { formatDay } from "~/lib/rights-rules";
import { formatTimecode } from "~/lib/segment-rules";
import { videoItem } from "~/lib/video-items.server";
import { reviewLinkMayPlay } from "~/lib/visibility.server";
import type { Route } from "./+types/review-link";

// Plays the video, and is never indexed, whatever the environment.
export const handle = { video: true, noindex: true };
// A Review Link shows a draft to one person: never keep a copy of it anywhere.
export const headers = () => ({ "Cache-Control": PRIVATE_NO_STORE });

export function meta() {
  return [{ title: "Draft for review · NAISEMA" }, { name: "robots", content: "noindex, nofollow" }];
}

const CLOSED = {
  unknown: { status: 404, message: "This Review Link doesn't exist. Check the address, or ask for a new link." },
  expired: { status: 410, message: "This Review Link has expired. Ask the person who sent it for a new one." },
  revoked: { status: 410, message: "This Review Link has been withdrawn. Ask the person who sent it for a new one." },
} as const;

/**
 * GET /review/:token — one exact Revision, of a Learning Layer or of a Content Item, view-only and
 * watermarked "Draft for review", for someone without a staff account, such as a Knowledge Holder.
 * Every opening is logged, including those of expired and revoked links.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const db = getDb(env.DB);
  const opened = await openReviewLink(db, params.token);
  if (!opened.ok)
    return data({ open: false as const, ...CLOSED[opened.reason] }, { status: CLOSED[opened.reason].status });
  const missing = () => data({ open: false as const, ...CLOSED.unknown }, { status: 404 });

  if (opened.link.contentRevisionId) {
    const page = await contentLinkPage(env, db, params.token, opened.link.contentRevisionId);
    if (!page) return missing();
    return { open: true as const, kind: "content" as const, expiresAt: opened.link.expiresAt, ...page };
  }

  const review = opened.link.revisionId ? await loadLayerReview(db, opened.link.revisionId) : null;
  const video = review && (await videoItem(db, review.layer.contentItemId));
  if (!review || !video) return missing();
  // Footage whose rights were withdrawn, or on a Video hidden pending a Case, never plays here.
  let playback = (await reviewLinkMayPlay(db, video)) ? await reviewLinkPlayback(env, params.token, video.video) : null;
  // An Excerpt plays from its in time to its out time where the browser plays the file itself.
  const { excerpt } = review.snapshot;
  if (playback && excerpt && !playback.hls) {
    playback = { ...playback, src: `${playback.src}#t=${excerpt.sourceStartMs / 1000},${excerpt.sourceEndMs / 1000}` };
  }
  return {
    open: true as const,
    kind: "layer" as const,
    videoTitle: video.title,
    number: review.number,
    snapshot: review.snapshot,
    expiresAt: opened.link.expiresAt,
    languageVariety: review.layer.languageVariety,
    playback,
  };
}

export default function ReviewLink({ loaderData }: Route.ComponentProps) {
  if (!loaderData.open) {
    return (
      <main id="main" className="page">
        <h1>Review Link</h1>
        <p>{loaderData.message}</p>
      </main>
    );
  }
  if (loaderData.kind === "content") return <ContentLink page={loaderData} />;
  const { snapshot, playback } = loaderData;
  return (
    <main id="main" className="page review-link-page">
      <p className="draft-watermark" role="note">
        Draft for review. Not published. Please don't share this link.
      </p>
      <p>
        {`You're seeing revision ${loaderData.number} of a Learning Layer on ${loaderData.videoTitle}, exactly as it will be reviewed. You can't change anything here. This link works until ${formatDay(loaderData.expiresAt)}.`}
      </p>
      <h1>{snapshot.title}</h1>
      {snapshot.excerpt && (
        <p>
          {`This Learning Layer uses ${formatTimecode(snapshot.excerpt.sourceStartMs)} to ${formatTimecode(snapshot.excerpt.sourceEndMs)} of the video. The Segment times below count from ${formatTimecode(snapshot.excerpt.sourceStartMs)}.`}
        </p>
      )}
      {playback ? (
        <VideoPreview
          src={playback.src}
          hls={playback.hls}
          label={`The video: ${loaderData.videoTitle}`}
          className="draft-video"
        >
          <span className="draft-watermark-overlay" aria-hidden="true">
            Draft for review
          </span>
        </VideoPreview>
      ) : (
        <p>The video can't be played right now. The words and Activities below are as they will be reviewed.</p>
      )}
      <LayerRevisionView snapshot={snapshot} languageVariety={loaderData.languageVariety} />
      <p className="draft-watermark" role="note">
        Draft for review
      </p>
    </main>
  );
}

type ContentPage = Extract<Awaited<ReturnType<typeof loader>>, { open: true; kind: "content" }>;

/** A Content Item Revision, as its staff page shows it, with its recording or video where they may play. */
function ContentLink({ page }: { page: ContentPage }) {
  const { snapshot, display, playback, audio } = page;
  const player = page.hasFootage
    ? playback && (
        <VideoPreview
          src={playback.src}
          hls={playback.hls}
          label={`The video: ${snapshot.title}`}
          className="draft-video"
        >
          <span className="draft-watermark-overlay" aria-hidden="true">
            Draft for review
          </span>
        </VideoPreview>
      )
    : undefined;
  return (
    <main id="main" className="page review-link-page">
      <p className="draft-watermark" role="note">
        Draft for review. Not published. Please don't share this link.
      </p>
      <p>
        {`You're seeing revision ${page.number}, exactly as it will be reviewed. You can't change anything here. This link works until ${formatDay(page.expiresAt)}.`}
      </p>
      <ContentRevisionView
        snapshot={snapshot}
        topics={display.topics}
        embeds={display.embeds}
        fileName={display.fileName}
        sampleTitle={display.sampleTitle}
        audioPath={audio?.src ?? null}
        player={player}
      />
      <p className="draft-watermark" role="note">
        Draft for review
      </p>
    </main>
  );
}
