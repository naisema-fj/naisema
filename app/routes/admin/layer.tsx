import { and, eq, inArray } from "drizzle-orm";
import { data, redirect } from "react-router";
import { TimelineEditor } from "~/components/timeline-editor";
import { activityProblems, readActivities } from "~/lib/activities";
import { annotationProblems, noteProblems, readAnnotations, readNewExpressions, readNotes } from "~/lib/annotations";
import { cloudflareContext } from "~/lib/cloudflare";
import { itemForStaff, mayEdit, Refused, saveRevision } from "~/lib/content.server";
import { type ContentFlag, isContentFlag } from "~/lib/content-rules";
import { getDb } from "~/lib/db.server";
import {
  LAYER_LANGUAGE_VARIETY,
  type LayerRefusal,
  type LearningLayer,
  readLayerDetails,
  withDefaults,
} from "~/lib/learning-layer-fields";
import { orientation } from "~/lib/public-view.server";
import { clipDuration, readSegments, segmentProblems } from "~/lib/segment-rules";
import { requireStaff } from "~/lib/staff.server";
import { expression, media } from "~db/schema";
import type { Route } from "./+types/layer";

/**
 * /admin/items/:id/layer: a Video's Learning Layer in the timeline editor (VCMS-02/04). Saving
 * makes a new Revision of the Video with the layer in it (ADR-0015), so its reviews start again.
 */

async function loadVideo(env: Env, request: Request, itemId: string) {
  const actor = await requireStaff(env, request);
  const db = getDb(env.DB);
  const found = await itemForStaff(db, itemId);
  if (found?.item.kind !== "video") throw new Response("Not found", { status: 404 });
  if (!mayEdit(actor, "video")) throw new Response("Your roles don't include Learning Layers.", { status: 403 });
  const footageId = found.latest.fields.videoMediaId;
  const footage = footageId ? await db.query.media.findFirst({ where: eq(media.id, footageId) }) : null;
  return { actor, db, found, footage };
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, found, footage } = await loadVideo(env, request, params.id);
  const library = await db.select().from(expression).where(eq(expression.variety, LAYER_LANGUAGE_VARIETY));
  const layer = withDefaults(found.latest.layer ?? { title: found.latest.title, level: "beginner" });
  return {
    itemId: found.item.id,
    title: found.latest.title,
    baseRevisionId: found.latest.id,
    layer: {
      ...layer,
      flags: found.latest.flags.includes("sensitive-cultural") ? (["sensitiveCultural"] as const) : [],
    },
    footage: footage
      ? {
          src: `/media/files/${footage.id}`,
          type: footage.contentType,
          durationMs: footage.durationMs ?? 0,
          orientation: orientation(footage.width, footage.height),
        }
      : null,
    library: library.map((row) => ({
      id: row.id,
      headword: row.headword,
      generalMeaning: row.generalMeaning,
      literalMeaning: row.literalMeaning || null,
      grammarNote: row.grammarNote,
      pronunciation: row.pronunciation,
    })),
  };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { actor, db, found, footage } = await loadVideo(env, request, params.id);
  if (!footage?.durationMs) {
    return data(
      {
        error: "Choose the Video's footage, with its length, before writing its Learning Layer.",
      } satisfies LayerRefusal,
      {
        status: 400,
      },
    );
  }
  const form = await request.formData();
  const field = (name: string) => String(form.get(name) ?? "");
  const refuse = (refusal: LayerRefusal) => data(refusal, { status: 400 });
  const details = readLayerDetails(
    {
      title: field("title"),
      level: field("level"),
      clip: field("clip"),
      sourceStart: field("sourceStart"),
      sourceEnd: field("sourceEnd"),
      sensitiveCultural: field("sensitiveCultural"),
    },
    footage.durationMs,
  );
  if (!details.ok) return refuse({ error: "Check the details.", errors: details.errors });
  const previous = found.latest.layer;
  const previousTokens = new Map((previous?.segments ?? []).map((segment) => [segment.id, segment.tokens]));
  const segments = readSegments(field("segments"), previousTokens);
  const annotations = readAnnotations(field("annotations"));
  const notes = readNotes(field("notes"));
  const activities = readActivities(field("activities"));
  const created = readNewExpressions(field("newExpressions"));
  for (const read of [segments, annotations, notes, activities, created])
    if (!read.ok) return refuse({ error: read.error });
  if (!segments.ok || !annotations.ok || !notes.ok || !activities.ok || !created.ok)
    return refuse({ error: "Try again." });
  const clipMs = clipDuration(details.details.excerpt, footage.durationMs);
  const problems = segmentProblems(segments.segments, clipMs);
  if (problems.length) return refuse({ error: "Some Segments need fixing before saving.", problems });
  const activityTrouble = activityProblems(activities.items, segments.segments).filter(
    (problem) => !problem.revalidate,
  );
  if (activityTrouble.length)
    return refuse({ error: "Some Activities need fixing before saving.", activityProblems: activityTrouble });

  // New Expressions join the library (unless they are already there, word for word); every
  // Expression an Annotation uses is copied into the layer, so it records exactly what was reviewed.
  const usedIds = [...new Set(annotations.items.map((annotation) => annotation.expressionId))];
  const existing = usedIds.length
    ? await db
        .select()
        .from(expression)
        .where(and(eq(expression.variety, LAYER_LANGUAGE_VARIETY), inArray(expression.id, usedIds)))
    : [];
  const expressions: LearningLayer["expressions"] = {};
  for (const row of existing) {
    expressions[row.id] = {
      headword: row.headword,
      generalMeaning: row.generalMeaning,
      literalMeaning: row.literalMeaning || null,
      grammarNote: row.grammarNote,
      pronunciation: row.pronunciation,
    };
  }
  const added = created.items.filter((item) => usedIds.includes(item.id) && !expressions[item.id]);
  for (const item of added) expressions[item.id] = item.details;
  const lost = [
    ...annotationProblems(annotations.items, segments.segments, new Set(Object.keys(expressions))),
    ...noteProblems(notes.items, segments.segments),
  ];
  const layer: LearningLayer = {
    title: details.details.title,
    level: details.details.level,
    flags: details.details.flags,
    excerpt: details.details.excerpt,
    segments: segments.segments,
    annotations: annotations.items,
    notes: notes.items,
    expressions,
    activities: activities.items,
  };
  const flags: ContentFlag[] = found.latest.flags.filter(
    (flag) => flag !== "sensitive-cultural" && isContentFlag(flag),
  );
  if (details.details.flags.includes("sensitiveCultural")) flags.push("sensitive-cultural");
  try {
    if (added.length) {
      await db.insert(expression).values(
        added.map((item) => ({
          id: item.id,
          variety: LAYER_LANGUAGE_VARIETY,
          headword: item.details.headword,
          generalMeaning: item.details.generalMeaning,
          literalMeaning: item.details.literalMeaning ?? "",
          grammarNote: item.details.grammarNote,
          pronunciation: item.details.pronunciation,
          createdBy: actor.email,
          updatedAt: new Date(),
        })),
      );
    }
    await saveRevision(db, actor, found.item.id, field("baseRevisionId"), {
      title: found.latest.title,
      summary: found.latest.summary,
      credit: found.latest.credit,
      flags,
      topics: found.latest.topics,
      body: found.latest.body,
      fields: found.latest.fields,
      layer,
    });
  } catch (error) {
    if (error instanceof Refused) return refuse({ error: error.message });
    throw error;
  }
  return redirect(`/admin/items/${found.item.id}/layer?saved=${lost.length ? "check" : "1"}`);
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Learning Layer: ${loaderData?.title ?? ""} · NAISEMA staff` }];
}

export default function LayerEditor({ loaderData, actionData }: Route.ComponentProps) {
  const { footage } = loaderData;
  return (
    <main id="main" className="page page-wide">
      <p>
        <a href={`/admin/items/${loaderData.itemId}`}>Back to {loaderData.title}</a>
      </p>
      <h1>Learning Layer for {loaderData.title}</h1>
      {footage?.durationMs ? (
        <TimelineEditor
          layerId={loaderData.itemId}
          baseRevisionId={loaderData.baseRevisionId}
          snapshot={loaderData.layer as LearningLayer}
          videoDurationMs={footage.durationMs}
          orientation={footage.orientation}
          preview={{ src: footage.src, type: footage.type }}
          previewError={null}
          library={loaderData.library}
          refused={actionData ?? null}
        />
      ) : (
        <p role="alert">
          Choose the Video's footage on its page first. The footage's length is read when it is uploaded.
        </p>
      )}
    </main>
  );
}
