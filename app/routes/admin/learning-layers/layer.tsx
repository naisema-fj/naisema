import { data, Form, redirect } from "react-router";
import { TimelineEditor } from "~/components/timeline-editor";
import type { AnnotationProblem, NoteProblem } from "~/lib/annotations";
import { cloudflareContext } from "~/lib/cloudflare";
import { listExpressions } from "~/lib/expressions.server";
import type { LayerDetailField } from "~/lib/learning-layer-fields";
import {
  educatorChoices,
  openLearningLayer,
  requireLayerStaff,
  saveLearningLayer,
  setAssignment,
} from "~/lib/learning-layers.server";
import type { SegmentProblem } from "~/lib/segment-rules";
import { ProviderError, videoProvider } from "~/lib/video-provider.server";
import type { Route } from "./+types/layer";

// Plays the video from the provider, so the page's policy allows its media.
export const handle = { video: true };
// The preview address is signed and short-lived: never keep a copy of the page.
export const headers = () => ({ "Cache-Control": "private, no-store" });

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.snapshot.title ?? "Learning Layer"} · Na iSema staff` }];
}

async function requireLayer(env: Env, request: Request, id: string) {
  const staff = await requireLayerStaff(env, request);
  const opened = await openLearningLayer(staff.db, staff.actor, id);
  if (!opened.ok) {
    throw new Response(
      opened.status === 404
        ? "Not found"
        : "Only editors and the Educators assigned to this Learning Layer can open it.",
      { status: opened.status },
    );
  }
  return { ...staff, layer: opened.layer };
}

/**
 * GET /admin/learning-layers/:id — a Learning Layer's timeline editor, for editors and the
 * Educators assigned to it (VAC-05), with a preview through a signed address.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, isEditor, layer } = await requireLayer(env, request, params.id);
  const { video } = layer.video;
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
  } else {
    previewError = "The video isn't ready to play, so it can't be previewed.";
  }
  const saved = new URL(request.url).searchParams.get("saved");
  return {
    id: layer.id,
    videoId: layer.video.id,
    videoTitle: layer.video.title,
    baseRevisionId: layer.currentRevision.id,
    revisionNumber: layer.currentRevision.number,
    snapshot: layer.currentRevision.snapshot,
    videoDurationMs: video.durationMs,
    orientation: video.orientation,
    preview,
    previewError,
    saved: saved === String(layer.currentRevision.number),
    isEditor,
    library: (await listExpressions(db, layer.languageVariety)).map((row) => ({
      id: row.id,
      headword: row.headword,
      generalMeaning: row.generalMeaning,
      grammarNote: row.grammarNote,
      pronunciation: row.pronunciation,
      literalMeaning: row.literalMeaning,
    })),
    educators: layer.assignedEducators,
    choices: isEditor
      ? (await educatorChoices(db)).filter((choice) => !layer.assignedEducatorIds.includes(choice.id))
      : [],
  };
}

type ActionData = {
  error: string;
  errors?: Partial<Record<LayerDetailField, string>>;
  problems?: SegmentProblem[];
  annotationProblems?: AnnotationProblem[];
  noteProblems?: NoteProblem[];
};

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor, layer } = await requireLayer(env, request, params.id);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  if (intent === "assign" || intent === "unassign") {
    const result = await setAssignment(
      db,
      actor,
      { kind: "layer", learningLayerId: layer.id },
      String(form.get("educatorId") ?? ""),
      intent === "assign",
    );
    if (!result.ok) return data<ActionData>({ error: result.error }, { status: 400 });
    return redirect(`/admin/learning-layers/${layer.id}`);
  }
  const field = (name: string) => String(form.get(name) ?? "");
  const saved = await saveLearningLayer(db, actor, layer, {
    baseRevisionId: field("baseRevisionId"),
    title: field("title"),
    level: field("level"),
    clip: field("clip"),
    sourceStart: field("sourceStart"),
    sourceEnd: field("sourceEnd"),
    segments: field("segments"),
    annotations: field("annotations"),
    notes: field("notes"),
    newExpressions: field("newExpressions"),
  });
  if (!saved.ok) return data<ActionData>(saved, { status: 400 });
  return redirect(`/admin/learning-layers/${layer.id}?saved=${saved.number}`);
}

export default function LearningLayerEditor({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <main id="main" className="page page-wide">
      <p>
        <a href="/admin/learning-layers">Back to Learning Layers</a>
        {" · "}
        <a href={`/admin/videos/${loaderData.videoId}/learning-layers`}>Learning Layers on {loaderData.videoTitle}</a>
      </p>
      <h1>{loaderData.snapshot.title}</h1>
      <p className="meta">Revision {loaderData.revisionNumber} · Standard Fijian</p>
      {loaderData.saved && <p role="status">Saved as revision {loaderData.revisionNumber}.</p>}
      <TimelineEditor
        // A new revision starts the editor afresh from what was saved.
        key={loaderData.baseRevisionId}
        layerId={loaderData.id}
        baseRevisionId={loaderData.baseRevisionId}
        snapshot={loaderData.snapshot}
        videoDurationMs={loaderData.videoDurationMs}
        orientation={loaderData.orientation}
        preview={loaderData.preview}
        previewError={loaderData.previewError}
        library={loaderData.library}
        refused={actionData ?? null}
      />
      <section aria-labelledby="educators-heading">
        <h2 id="educators-heading">Educators on this Learning Layer</h2>
        {loaderData.educators.length ? (
          <ul>
            {loaderData.educators.map((educator) => (
              <li key={educator.id}>
                {educator.name} ({educator.email})
                {loaderData.isEditor && (
                  <Form method="post" className="inline-form">
                    <input type="hidden" name="intent" value="unassign" />
                    <input type="hidden" name="educatorId" value={educator.id} />
                    <button type="submit">
                      Unassign<span className="visually-hidden"> {educator.name}</span>
                    </button>
                  </Form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No Educators are assigned. Only editors can open it.</p>
        )}
        {loaderData.isEditor && (
          <Form method="post" className="inline-form">
            <input type="hidden" name="intent" value="assign" />
            <label htmlFor="layer-educator">Assign an Educator</label>
            <select id="layer-educator" name="educatorId">
              {loaderData.choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.name} ({choice.email})
                </option>
              ))}
            </select>
            <button type="submit" disabled={!loaderData.choices.length}>
              Assign
            </button>
          </Form>
        )}
      </section>
    </main>
  );
}
