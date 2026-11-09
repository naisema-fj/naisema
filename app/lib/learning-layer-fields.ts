import { type Activity, type ActivityProblem, activityProblems, countsForCompletion } from "./activities";
import {
  type Annotation,
  type AnnotationProblem,
  annotationProblems,
  type ContextNote,
  type ExpressionDetails,
  type NoteProblem,
  noteProblems,
} from "./annotations";
import { type Excerpt, formatTimecode, parseTimecode, type Segment, type SegmentProblem } from "./segment-rules";
import { retokenise } from "./tokens";

/** A Learning Layer's only Content Flag: it needs a Knowledge Holder's approval. */
export type LayerFlag = "sensitiveCultural";

/**
 * What a Learning Layer holds, inside its Video's Revision (ADR-0015) (ADR-0001, ADR-0006, ADR-0011, docs/phase-1a-defaults.md
 * §2): its title and level, the clip it is built on (the whole video or an Excerpt), its Segments
 * with their tokens, its Annotations and cultural or context notes, and a copy of each Expression
 * its Annotations use, so the Revision says exactly what was reviewed, and its Activities, whose
 * required flags are its Completion Rule.
 */
export type LearningLayerSnapshot = {
  title: string;
  level: LayerLevel;
  /** Its Content Flags: whether it needs a Knowledge Holder's approval (ADR-0003). */
  flags: LayerFlag[];
  excerpt: Excerpt;
  segments: Segment[];
  annotations: Annotation[];
  notes: ContextNote[];
  /** The Expressions its Annotations use, as they were when it was saved, by ID. */
  expressions: Record<string, ExpressionDetails>;
  activities: Activity[];
};

/**
 * A stored snapshot with everything later work added filled in: Revisions saved before tokens,
 * Annotations, Activities or flags existed have none.
 */
export function withDefaults(
  snapshot: Partial<LearningLayerSnapshot> & Pick<LearningLayerSnapshot, "title" | "level">,
) {
  return {
    title: snapshot.title,
    level: snapshot.level,
    flags: snapshot.flags ?? [],
    excerpt: snapshot.excerpt ?? null,
    segments: (snapshot.segments ?? []).map((segment) => ({
      ...segment,
      tokens: segment.tokens ?? retokenise([], segment.fijian),
    })),
    annotations: snapshot.annotations ?? [],
    notes: snapshot.notes ?? [],
    expressions: snapshot.expressions ?? {},
    activities: snapshot.activities ?? [],
  } satisfies LearningLayerSnapshot;
}

export const LAYER_LEVELS = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
} as const;
export type LayerLevel = keyof typeof LAYER_LEVELS;

/** The Language Variety every Learning Layer teaches in 1a. */
export const LAYER_LANGUAGE_VARIETY = "standard-fijian";

export const LAYER_LIMITS = { title: 200 } as const;

/** What a Learning Layer is built on, as staff read it. */
export const layerSpan = (excerpt: Excerpt) =>
  excerpt
    ? `Excerpt ${formatTimecode(excerpt.sourceStartMs)} to ${formatTimecode(excerpt.sourceEndMs)}`
    : "Whole video";

export type LayerDetails = { title: string; level: LayerLevel; flags: LayerFlag[]; excerpt: Excerpt };
export type LayerDetailField = "title" | "level" | "sourceStartMs" | "sourceEndMs";

/** Why a save was refused, with the problems found in each part, for the editor to show. */
export type LayerRefusal = {
  error: string;
  errors?: Partial<Record<LayerDetailField, string>>;
  problems?: SegmentProblem[];
  annotationProblems?: AnnotationProblem[];
  noteProblems?: NoteProblem[];
  activityProblems?: ActivityProblem[];
};

export type ReadLayerDetails =
  | { ok: true; details: LayerDetails }
  | { ok: false; errors: Partial<Record<LayerDetailField, string>> };

const isLevel = (value: string): value is LayerLevel => Object.hasOwn(LAYER_LEVELS, value);

/**
 * A Learning Layer's title, level, cultural review flag and clip, as the form sends them: `clip`
 * is "whole" or "excerpt", and an Excerpt has source in and out times inside the video.
 */
export function readLayerDetails(
  input: {
    title: string;
    level: string;
    clip: string;
    sourceStart: string;
    sourceEnd: string;
    sensitiveCultural?: string;
  },
  videoDurationMs: number,
): ReadLayerDetails {
  const errors: Partial<Record<LayerDetailField, string>> = {};
  const title = input.title.trim();
  if (!title) errors.title = "Enter a title for the Learning Layer.";
  else if (title.length > LAYER_LIMITS.title)
    errors.title = `The title can be at most ${LAYER_LIMITS.title} characters.`;
  if (!isLevel(input.level)) errors.level = "Choose a level.";
  let excerpt: Excerpt = null;
  if (input.clip === "excerpt") {
    const start = parseTimecode(input.sourceStart);
    const end = parseTimecode(input.sourceEnd);
    if (start === null) errors.sourceStartMs = "Enter the in time, like 1:05.250.";
    if (end === null) errors.sourceEndMs = "Enter the out time, like 2:30.000.";
    else if (end > videoDurationMs) errors.sourceEndMs = "The out time is after the video ends.";
    else if (start !== null && end <= start) errors.sourceEndMs = "The out time must be after the in time.";
    if (start !== null && end !== null) excerpt = { sourceStartMs: start, sourceEndMs: end };
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  const flags: LayerFlag[] = input.sensitiveCultural === "on" ? ["sensitiveCultural"] : [];
  return { ok: true, details: { title, level: input.level as LayerLevel, flags, excerpt } };
}

/** A Learning Layer as stored in its Video's Revision. */
export type LearningLayer = LearningLayerSnapshot;

const counted = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Why a Learning Layer isn't ready for learners, whatever its reviews say: it has no Segments,
 * text imported as a draft or Segments retimed by an Excerpt change still unchecked, Annotations,
 * notes or Activities that lost their place, or nothing a learner must do, so it could never be
 * completed (decision log 1a-13).
 */
export function layerReadinessProblems(layer: LearningLayer): string[] {
  const problems: string[] = [];
  const { segments } = layer;
  if (!segments.length) problems.push("Its Learning Layer has no Segments yet.");
  const drafts = segments.filter((segment) => segment.draft).length;
  if (drafts) {
    problems.push(
      `${counted(drafts, "Segment is an unreviewed draft", "Segments are unreviewed drafts")}. Check ${drafts === 1 ? "its" : "their"} text in the editor.`,
    );
  }
  const retimed = segments.filter((segment) => segment.retimed).length;
  if (retimed) {
    problems.push(
      `${counted(retimed, "Segment was", "Segments were")} retimed. Check ${retimed === 1 ? "its" : "their"} times in the editor.`,
    );
  }
  const lost =
    annotationProblems(layer.annotations, segments, new Set(Object.keys(layer.expressions))).length +
    noteProblems(layer.notes, segments).length;
  if (lost) {
    problems.push(`${counted(lost, "Annotation or note needs", "Annotations or notes need")} checking in the editor.`);
  }
  const unlinked = activityProblems(layer.activities, segments).filter((problem) => problem.revalidate).length;
  if (unlinked) problems.push(`${counted(unlinked, "Activity needs", "Activities need")} linking to a Segment again.`);
  if (!layer.activities.some(countsForCompletion)) {
    problems.push("No Activity is required, so learners can't complete this Learning Layer.");
  }
  return problems;
}
