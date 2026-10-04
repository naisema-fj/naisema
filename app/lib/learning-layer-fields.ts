import type { ReviewType } from "./permissions";
import { type Excerpt, parseTimecode, type Segment } from "./segment-rules";

/**
 * What a Learning Layer Revision holds (ADR-0001, ADR-0006, docs/phase-1a-defaults.md §2): its
 * title and level, the clip it is built on (the whole video or an Excerpt), and its Segments.
 * Tokens, Annotations, Activities and the Completion Rule are added to it by later work.
 */
export type LearningLayerSnapshot = {
  title: string;
  level: LayerLevel;
  excerpt: Excerpt;
  segments: Segment[];
};

export const LAYER_LEVELS = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
} as const;
export type LayerLevel = keyof typeof LAYER_LEVELS;

/** The Language Variety every Learning Layer teaches in 1a. */
export const LAYER_LANGUAGE_VARIETY = "standard-fijian";

export const LAYER_LIMITS = { title: 200 } as const;

export type LayerDetails = { title: string; level: LayerLevel; excerpt: Excerpt };
export type LayerDetailField = "title" | "level" | "sourceStartMs" | "sourceEndMs";

export type ReadLayerDetails =
  | { ok: true; details: LayerDetails }
  | { ok: false; errors: Partial<Record<LayerDetailField, string>> };

const isLevel = (value: string): value is LayerLevel => Object.hasOwn(LAYER_LEVELS, value);

/**
 * A Learning Layer's title, level and clip, as the form sends them: `clip` is "whole" or
 * "excerpt", and an Excerpt has source in and out times inside the video.
 */
export function readLayerDetails(
  input: { title: string; level: string; clip: string; sourceStart: string; sourceEnd: string },
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
  return { ok: true, details: { title, level: input.level as LayerLevel, excerpt } };
}

/**
 * The parts of a Learning Layer each Review Type covers, which its fingerprints are taken over
 * (ADR-0003, ADR-0006). Language review covers the Fijian and English and the Variety taught;
 * cultural review the words, who speaks and which part of the video is used; accessibility the
 * captions as timed text; safeguarding the words and what is shown; editorial everything.
 */
export function learningLayerReviewFields(
  snapshot: LearningLayerSnapshot,
  languageVariety: string,
): Record<ReviewType, unknown> {
  const words = snapshot.segments.map(({ id, fijian, english }) => ({ id, fijian, english }));
  const spoken = snapshot.segments.map(({ id, fijian, english, speaker }) => ({ id, fijian, english, speaker }));
  const timed = snapshot.segments.map(({ id, startMs, endMs, fijian, english }) => ({
    id,
    startMs,
    endMs,
    fijian,
    english,
  }));
  return {
    language: { languageVariety, words },
    cultural: { title: snapshot.title, excerpt: snapshot.excerpt, spoken },
    editorial: { ...snapshot, segments: snapshot.segments.map(({ draft, retimed, ...segment }) => segment) },
    accessibility: { title: snapshot.title, timed },
    safeguarding: { title: snapshot.title, excerpt: snapshot.excerpt, spoken },
  };
}
