import { activityProblems, readActivities } from "./activities";
import {
  annotationProblems,
  annotationsToCheck,
  type ExpressionDetails,
  type NewExpression,
  noteProblems,
  readAnnotations,
  readNewExpressions,
  readNotes,
} from "./annotations";
import { type LayerRefusal, type LearningLayerSnapshot, readLayerDetails } from "./learning-layer-fields";
import { clipDuration, readSegments, segmentProblems } from "./segment-rules";

/**
 * Building a Learning Layer's next Revision from what the timeline editor sends (ADR-0006,
 * ADR-0011): its details, Segments, Annotations, notes, new Expressions and Activities, read and
 * checked against the clip and the Revision before. The rules are the ones the editor itself runs
 * as the Educator types (segment-rules, annotations, activities), so the two never disagree.
 * Annotations, notes and Activities whose words or Segment are gone are kept, flagged; anything
 * else wrong refuses the save. The Expression library is reached through a port, so this runs the
 * same against D1 or in memory; storing the Revision is the caller's.
 */

/** What the editor's form sends: the details' fields, and each list as JSON. */
export type LayerEditorPayload = {
  title: string;
  level: string;
  clip: string;
  sourceStart: string;
  sourceEnd: string;
  sensitiveCultural?: string;
  segments: string;
  annotations: string;
  notes: string;
  newExpressions: string;
  activities: string;
};

/** What a Learning Layer is built on: the Revision before, and how long its video is. */
export type BuildBase = { snapshot: LearningLayerSnapshot; videoDurationMs: number };

/**
 * The Expression library of the Learning Layer's Language Variety, as a save needs it (ADR-0011):
 * placing the Expressions the Educator defined while annotating, and copying the ones the
 * Revision's Annotations use. Placing prepares writes rather than making them, so nothing is
 * stored until the whole Revision is.
 */
export type ExpressionLibrary = {
  place(
    items: NewExpression[],
  ): Promise<
    | { ok: true; ids: Map<string, string>; added: (ExpressionDetails & { id: string })[]; writes: unknown[] }
    | { ok: false; error: string }
  >;
  copies(ids: string[], added: (ExpressionDetails & { id: string })[]): Promise<Record<string, ExpressionDetails>>;
};

export type BuiltRevision =
  | { ok: true; snapshot: LearningLayerSnapshot; libraryWrites: unknown[] }
  | ({ ok: false } & LayerRefusal);

/** The next Revision's snapshot from the editor's payload, or why it can't be saved. */
export async function buildLayerRevision(
  payload: LayerEditorPayload,
  base: BuildBase,
  library: ExpressionLibrary,
): Promise<BuiltRevision> {
  const details = readLayerDetails(payload, base.videoDurationMs);
  if (!details.ok) return { ok: false, error: "Check the Learning Layer's details.", errors: details.errors };
  const before = base.snapshot;
  const segments = readSegments(
    payload.segments,
    new Map(before.segments.map((segment) => [segment.id, segment.tokens])),
  );
  if (!segments.ok) return { ok: false, error: segments.error };
  const problems = segmentProblems(segments.segments, clipDuration(details.details.excerpt, base.videoDurationMs));
  if (problems.length) {
    return {
      ok: false,
      error: `${problems.length === 1 ? "One Segment needs" : `${problems.length} Segments need`} fixing before this can be saved.`,
      problems,
    };
  }
  const annotations = readAnnotations(payload.annotations);
  if (!annotations.ok) return { ok: false, error: annotations.error };
  const notes = readNotes(payload.notes);
  if (!notes.ok) return { ok: false, error: notes.error };
  const defined = readNewExpressions(payload.newExpressions);
  if (!defined.ok) return { ok: false, error: defined.error };
  const activities = readActivities(payload.activities);
  if (!activities.ok) return { ok: false, error: activities.error };

  // New Expressions an Annotation uses join the library (or match one there saying exactly the
  // same); every Annotation then links to a library Expression, of which the Revision keeps a copy.
  const used = new Set(annotations.items.map((annotation) => annotation.expressionId));
  const placed = await library.place(defined.items.filter((item) => used.has(item.id)));
  if (!placed.ok) return { ok: false, error: placed.error };
  // Where the server had to work out a Segment's tokens itself, it flags Annotations whose words now
  // appear a different number of times, as the editor does.
  const toCheck = new Set(
    [...segments.retokenised].flatMap((segmentId) =>
      annotationsToCheck(
        annotations.items,
        segmentId,
        before.segments.find((segment) => segment.id === segmentId)?.tokens ?? [],
        segments.segments.find((segment) => segment.id === segmentId)?.tokens ?? [],
      ),
    ),
  );
  const linked = annotations.items.map((annotation) => ({
    ...annotation,
    expressionId: placed.ids.get(annotation.expressionId) ?? annotation.expressionId,
    needsCheck: annotation.needsCheck || toCheck.has(annotation.id),
  }));
  const expressions = await library.copies(
    [...new Set(linked.map((annotation) => annotation.expressionId))],
    placed.added,
  );
  const annotationIssues = annotationProblems(linked, segments.segments, new Set(Object.keys(expressions))).filter(
    (problem) => !problem.revalidate,
  );
  const noteIssues = noteProblems(notes.items, segments.segments).filter((problem) => !problem.revalidate);
  if (annotationIssues.length || noteIssues.length) {
    return {
      ok: false,
      error: "Some Annotations or notes need fixing before this can be saved.",
      annotationProblems: annotationIssues,
      noteProblems: noteIssues,
    };
  }
  const activityIssues = activityProblems(activities.items, segments.segments).filter((problem) => !problem.revalidate);
  if (activityIssues.length) {
    return {
      ok: false,
      error: "Some Activities need fixing before this can be saved.",
      activityProblems: activityIssues,
    };
  }
  return {
    ok: true,
    snapshot: {
      ...details.details,
      segments: segments.segments,
      annotations: linked,
      notes: notes.items,
      expressions,
      activities: activities.items,
    },
    libraryWrites: placed.writes,
  };
}
