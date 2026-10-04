import { data, Form, redirect } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { LAYER_LEVELS, LAYER_LIMITS, type LayerDetailField, layerSpan } from "~/lib/learning-layer-fields";
import {
  createLearningLayer,
  educatorChoices,
  layersOfVideo,
  refusal,
  requireLayerStaff,
  setAssignment,
  videoEducatorIds,
  videoEducators,
  videoItem,
} from "~/lib/learning-layers.server";
import { can } from "~/lib/permissions";
import { formatVideoLength } from "~/lib/video-rules";
import type { Route } from "./+types/video";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Learning Layers on ${loaderData?.title ?? "a Video"} · Na iSema staff` }];
}

async function requireVideo(env: Env, request: Request, id: string) {
  const staff = await requireLayerStaff(env, request);
  const video = await videoItem(staff.db, id);
  if (!video) throw new Response("Not found", { status: 404 });
  const assignedEducatorIds = await videoEducatorIds(staff.db, video.id);
  const canCreate = can(staff.actor, { action: "learningLayer.create", video: { assignedEducatorIds } });
  if (!canCreate) {
    await refusal(staff.db, staff.actor, "content_item", video.id);
    throw new Response("Only editors and the Educators assigned to this Video can open it.", { status: 403 });
  }
  return { ...staff, video };
}

/**
 * GET /admin/videos/:id/learning-layers — a Video's Learning Layers, the Educators assigned to it
 * (editors assign them), and a form to add a Learning Layer on the whole video or an Excerpt.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db, isEditor, video } = await requireVideo(context.get(cloudflareContext).env, request, params.id);
  const [layers, educators, choices] = await Promise.all([
    layersOfVideo(db, video.id),
    videoEducators(db, video.id),
    isEditor ? educatorChoices(db) : [],
  ]);
  return {
    id: video.id,
    title: video.title,
    length: formatVideoLength(video.video.durationMs),
    isEditor,
    educators,
    choices: choices.filter((choice) => !educators.some((educator) => educator.id === choice.id)),
    layers: layers.map((layer) => ({
      id: layer.id,
      title: layer.title,
      level: LAYER_LEVELS[layer.level],
      clip: layerSpan(layer.excerpt),
      segmentCount: layer.segmentCount,
    })),
  };
}

type ActionData = {
  error?: string;
  errors?: Partial<Record<LayerDetailField, string>>;
  values?: Record<string, string>;
};

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor, video } = await requireVideo(env, request, params.id);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  if (intent === "assign" || intent === "unassign") {
    const result = await setAssignment(
      db,
      actor,
      { kind: "video", contentItemId: video.id },
      String(form.get("educatorId") ?? ""),
      intent === "assign",
    );
    if (!result.ok) return data<ActionData>({ error: result.error }, { status: 400 });
    return redirect(`/admin/videos/${video.id}/learning-layers`);
  }
  const values = {
    title: String(form.get("title") ?? ""),
    level: String(form.get("level") ?? ""),
    clip: String(form.get("clip") ?? "whole"),
    sourceStart: String(form.get("sourceStart") ?? ""),
    sourceEnd: String(form.get("sourceEnd") ?? ""),
  };
  const created = await createLearningLayer(db, actor, video.id, values);
  if (!created.ok) {
    return data<ActionData>({ error: created.error, errors: created.errors, values }, { status: created.status });
  }
  return redirect(`/admin/learning-layers/${created.id}`);
}

export default function VideoLearningLayers({ loaderData, actionData }: Route.ComponentProps) {
  const errors = actionData?.errors ?? {};
  const values = actionData?.values;
  const fieldError = (field: LayerDetailField) =>
    errors[field] ? (
      <p className="field-error" id={`${field}-error`}>
        {errors[field]}
      </p>
    ) : null;
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin/learning-layers">Back to Learning Layers</a>
        {loaderData.isEditor && (
          <>
            {" · "}
            <a href={`/admin/articles/${loaderData.id}`}>Edit the Video</a>
          </>
        )}
      </p>
      <h1>Learning Layers on {loaderData.title}</h1>
      <p>The video is {loaderData.length} long.</p>
      {actionData?.error && <p role="alert">{actionData.error}</p>}

      <h2>Learning Layers</h2>
      {loaderData.layers.length ? (
        <ul className="item-list">
          {loaderData.layers.map((layer) => (
            <li key={layer.id}>
              <a href={`/admin/learning-layers/${layer.id}`}>{layer.title}</a>
              <span className="meta">
                {layer.level} · {layer.clip} · {layer.segmentCount} {layer.segmentCount === 1 ? "Segment" : "Segments"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>None yet.</p>
      )}

      <Form method="post" className="article-form" aria-labelledby="new-layer-heading">
        <h2 id="new-layer-heading">Add a Learning Layer</h2>
        <input type="hidden" name="intent" value="create" />
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          maxLength={LAYER_LIMITS.title}
          defaultValue={values?.title}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? "title-error" : undefined}
        />
        {fieldError("title")}
        <label htmlFor="level">Level</label>
        <select id="level" name="level" defaultValue={values?.level ?? "beginner"}>
          {Object.entries(LAYER_LEVELS).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
        {fieldError("level")}
        <fieldset>
          <legend>Built on</legend>
          <label>
            <input type="radio" name="clip" value="whole" defaultChecked={values?.clip !== "excerpt"} /> The whole video
          </label>
          <label>
            <input type="radio" name="clip" value="excerpt" defaultChecked={values?.clip === "excerpt"} /> An Excerpt,
            from its in time to its out time
          </label>
          <label htmlFor="sourceStart">In time</label>
          <input
            id="sourceStart"
            name="sourceStart"
            placeholder="0:10.000"
            defaultValue={values?.sourceStart}
            aria-invalid={errors.sourceStartMs ? true : undefined}
            aria-describedby={errors.sourceStartMs ? "sourceStartMs-error" : undefined}
          />
          {fieldError("sourceStartMs")}
          <label htmlFor="sourceEnd">Out time</label>
          <input
            id="sourceEnd"
            name="sourceEnd"
            placeholder="0:45.000"
            defaultValue={values?.sourceEnd}
            aria-invalid={errors.sourceEndMs ? true : undefined}
            aria-describedby={errors.sourceEndMs ? "sourceEndMs-error" : undefined}
          />
          {fieldError("sourceEndMs")}
        </fieldset>
        <p className="hint">The Learning Layer teaches Standard Fijian.</p>
        <button type="submit">Add the Learning Layer</button>
      </Form>

      <h2>Educators on this Video</h2>
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
        <p>No Educators are assigned yet.</p>
      )}
      {loaderData.isEditor && (
        <Form method="post" className="inline-form">
          <input type="hidden" name="intent" value="assign" />
          <label htmlFor="educatorId">Assign an Educator</label>
          <select id="educatorId" name="educatorId">
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
      <p className="hint">Educators assigned to the Video can add Learning Layers to it, and edit the ones they add.</p>
    </main>
  );
}
