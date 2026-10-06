import { type Annotation, type ExpressionDetails, tokenRange } from "./annotations";
import type { Excerpt, Segment } from "./segment-rules";
import { tokenSpans } from "./tokens";

/**
 * The learner player's rules (VID-02–06), pure so they can be tested and shared by the server and
 * the player: which part of the video plays, which Segment is playing, when a replay stops or loops,
 * and how a Segment's words are grouped with their meanings.
 */

/** The speeds a learner can choose (VID-06). */
export const PLAYBACK_SPEEDS = [1, 0.75, 0.5] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/** The part of the video a Learning Layer plays, in video time: the whole video or its Excerpt. */
export const playWindow = (excerpt: Excerpt, videoDurationMs: number) =>
  excerpt ? { startMs: excerpt.sourceStartMs, endMs: excerpt.sourceEndMs } : { startMs: 0, endMs: videoDurationMs };

/**
 * The Segment playing at a time in the clip: the one whose span holds it, the later one where one
 * ends as the next begins, or none between Segments.
 */
export function currentSegment(segments: Segment[], clipMs: number) {
  let found: Segment | null = null;
  for (const segment of segments) {
    if (segment.startMs <= clipMs && clipMs < segment.endMs && (!found || segment.startMs >= found.startMs)) {
      found = segment;
    }
  }
  return found;
}

/** A Segment being replayed, once or looped, in clip time. */
export type Replay = { startMs: number; endMs: number; loop: boolean };

/** How far before a replayed Segment the playhead may be (a seek lands just early) and still be in it. */
const REPLAY_SLACK_MS = 250;

/**
 * What a replay does at this moment: keep playing, stop at the Segment's end, start it again when
 * looping, or end because the learner moved the video elsewhere. Checked against the playhead, so
 * the boundaries hold at every speed.
 */
export function replayStep(replay: Replay, clipMs: number): "continue" | "stop" | "restart" | "abandon" {
  if (clipMs < replay.startMs - REPLAY_SLACK_MS) return "abandon";
  if (clipMs < replay.endMs) return "continue";
  // Well past the end means a jump, not the end being reached while playing.
  if (clipMs > replay.endMs + 1_000) return "abandon";
  return replay.loop ? "restart" : "stop";
}

export type WordRun = { text: string; annotationId: string | null };

/**
 * A Segment's Fijian as written, in runs: each Annotation's words with the spaces and marks between
 * them make one run, which opens its meaning; everything else runs as plain text. Annotations whose
 * words are gone are left out, and where two cover the same word the first keeps it.
 */
export function annotatedRuns(segment: Pick<Segment, "fijian" | "tokens">, annotations: Annotation[]): WordRun[] {
  const spans = tokenSpans(segment.fijian);
  const owner: (string | null)[] = spans.map(() => null);
  for (const annotation of annotations) {
    const { start, end } = tokenRange(segment, annotation);
    if (start < 0 || end < start || end >= spans.length) continue;
    for (let index = start; index <= end; index++) owner[index] ??= annotation.id;
  }
  const runs: WordRun[] = [];
  const push = (text: string, annotationId: string | null) => {
    if (!text) return;
    const last = runs.at(-1);
    if (last && last.annotationId === annotationId) last.text += text;
    else runs.push({ text, annotationId });
  };
  let at = 0;
  spans.forEach((span, index) => {
    const gap = segment.fijian.slice(at, span.start);
    // The gap between two words of the same Annotation belongs to it.
    push(gap, index > 0 && owner[index] !== null && owner[index] === owner[index - 1] ? owner[index] : null);
    push(span.text, owner[index]);
    at = span.end;
  });
  push(segment.fijian.slice(at), null);
  return runs;
}

export type MeaningEntry = {
  expressionId: string;
  expression: ExpressionDetails;
  /** The Educator chose it for the vocabulary list. */
  keyWord: boolean;
  places: {
    annotationId: string;
    segmentId: string;
    startMs: number;
    text: string;
    meaning: string;
    grammarNote: string;
  }[];
};

/**
 * Every annotated word or phrase, for the list beside the transcript that reaches each meaning
 * without opening it in place (VID-05): each Expression once, in the order first heard, with every
 * place it is heard and what it means there. Annotations whose words are gone are left out.
 */
export function meaningsList(
  segments: Segment[],
  annotations: Annotation[],
  expressions: Record<string, ExpressionDetails>,
): MeaningEntry[] {
  const placed = annotations.flatMap((annotation) => {
    const segment = segments.find((item) => item.id === annotation.segmentId);
    const expression = expressions[annotation.expressionId];
    if (!segment || !expression) return [];
    const { start, end } = tokenRange(segment, annotation);
    if (start < 0 || end < start) return [];
    const run = annotatedRuns(segment, [annotation]).find((item) => item.annotationId === annotation.id);
    return run ? [{ annotation, segment, start, text: run.text }] : [];
  });
  placed.sort((a, b) => a.segment.startMs - b.segment.startMs || a.start - b.start);
  const entries = new Map<string, MeaningEntry>();
  for (const { annotation, segment, text } of placed) {
    const entry = entries.get(annotation.expressionId) ?? {
      expressionId: annotation.expressionId,
      expression: expressions[annotation.expressionId],
      keyWord: false,
      places: [],
    };
    entry.keyWord ||= annotation.inVocabulary;
    entry.places.push({
      annotationId: annotation.id,
      segmentId: segment.id,
      startMs: segment.startMs,
      text,
      meaning: annotation.contextualMeaning,
      grammarNote: annotation.grammarNote,
    });
    entries.set(annotation.expressionId, entry);
  }
  return [...entries.values()];
}
