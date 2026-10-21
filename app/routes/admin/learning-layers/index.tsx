import type { ReactNode } from "react";
import { BulkActions, BulkChoice } from "~/components/bulk-actions";
import { bulkReviewerChoices } from "~/lib/bulk-actions.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { LAYER_LEVELS, layerSpan } from "~/lib/learning-layer-fields";
import { layersFor, requireLayerStaff, videosFor } from "~/lib/learning-layers.server";
import { layerQueues, type QueueEntry } from "~/lib/publication.server";
import type { Route } from "./+types/index";

export function meta() {
  return [{ title: "Learning Layers · NAISEMA staff" }];
}

/**
 * GET /admin/learning-layers — the Learning Layers someone may open (an Educator's assigned ones,
 * every one for an editor) and the Videos they may add one to. Editors also see what is waiting
 * for review, what is ready to publish and what is held up by a video that failed processing.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { db, actor, isEditor } = await requireLayerStaff(context.get(cloudflareContext).env, request);
  const [layers, videos, queues, reviewers] = await Promise.all([
    layersFor(db, actor),
    videosFor(db, actor),
    isEditor ? layerQueues(db) : null,
    isEditor ? bulkReviewerChoices(db) : [],
  ]);
  const videoTitles = new Map(videos.map((video) => [video.id, video.title]));
  return {
    isEditor,
    queues,
    reviewers,
    videos,
    layers: layers.map((layer) => ({
      ...layer,
      level: LAYER_LEVELS[layer.level],
      clip: layerSpan(layer.excerpt),
      videoTitle: videoTitles.get(layer.contentItemId) ?? null,
    })),
  };
}

/** Editors choose Learning Layers in the lists for a bulk action (BO-07); everyone else sees the plain page. */
function MaybeBulkForm({ editor, children }: { editor: boolean; children: ReactNode }) {
  return editor ? (
    <form method="post" action="/admin/bulk">
      {children}
    </form>
  ) : (
    children
  );
}

export default function LearningLayers({ loaderData }: Route.ComponentProps) {
  const { isEditor } = loaderData;
  return (
    <main id="main" className="page page-wide">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Learning Layers</h1>
      <p>
        <a href="/admin/expressions">Expressions</a>: the words and phrases Annotations link to.
      </p>
      {isEditor && (
        <p className="hint">
          Choose Learning Layers in the lists below to assign a reviewer to, withdraw or archive several at once. The
          actions are <a href="#layers-actions">under the list of every Learning Layer</a>.
        </p>
      )}
      <MaybeBulkForm editor={isEditor}>
        {loaderData.queues && (
          <>
            <Queue
              selectable={isEditor}
              heading="Waiting for review"
              empty="Nothing submitted is waiting for a review."
              entries={loaderData.queues.missingReview}
              detail={(entry) => [`still needs ${entry.waitingFor.join(", ")}.`, ...entry.blockers].join(" ")}
            />
            <Queue
              selectable={isEditor}
              heading="Approved but held up"
              empty="Nothing approved is held up."
              entries={loaderData.queues.heldUp}
              detail={(entry) => entry.blockers.join(" ")}
            />
            <Queue
              selectable={isEditor}
              heading="Ready to publish"
              empty="Nothing is ready to publish."
              entries={loaderData.queues.readyToPublish}
              detail={() => "every review and right is in place"}
            />
            <Queue
              selectable={isEditor}
              heading="Video failed processing"
              empty="No Learning Layer is held up by its video."
              entries={loaderData.queues.failedProcessing}
              detail={(entry) => entry.reason ?? "processing failed"}
            />
          </>
        )}
        <h2>{isEditor ? "Every Learning Layer" : "Learning Layers assigned to you"}</h2>
        {loaderData.layers.length ? (
          <ul className="item-list">
            {loaderData.layers.map((layer) => (
              <li key={layer.id}>
                {isEditor && <BulkChoice prefix="pick-layer" id={layer.id} title={layer.title} />}
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
        {isEditor && loaderData.layers.length > 0 && (
          <BulkActions kind="layer" prefix="layers" reviewers={loaderData.reviewers} />
        )}
      </MaybeBulkForm>
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

/** One of the editors' queues: each Learning Layer's current revision, its Video and what it waits on. */
function Queue({
  heading,
  empty,
  entries,
  detail,
  selectable,
}: {
  selectable: boolean;
  heading: string;
  empty: string;
  entries: QueueEntry[];
  detail: (entry: QueueEntry) => string;
}) {
  return (
    <section aria-label={heading}>
      <h2>{heading}</h2>
      {entries.length ? (
        <ul className="item-list">
          {entries.map((entry) => (
            <li key={entry.learningLayerId}>
              {selectable && (
                <BulkChoice
                  prefix={`pick-${heading}`}
                  id={entry.learningLayerId}
                  title={`${entry.title}, revision ${entry.number}`}
                />
              )}
              <a href={`/admin/learning-layers/${entry.learningLayerId}/revisions/${entry.number}`}>
                {`${entry.title}, revision ${entry.number}`}
              </a>
              <span className="meta">{[entry.videoTitle, detail(entry)].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}
