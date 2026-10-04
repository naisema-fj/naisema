/**
 * Segments (docs/phase-1a-defaults.md §2, CONTEXT.md): the timed spans of a Learning Layer's clip
 * holding its Fijian text, English translation and optional speaker. Times are relative to the
 * clip, which is the whole video or an Excerpt of it; an Excerpt's source in time is the offset
 * back to the video. Segments keep stable IDs across Revisions (ADR-0006), so saved vocabulary and
 * learner progress can follow them. Shared by the timeline editor in the browser and the server.
 */

export type Segment = {
  id: string;
  /** Milliseconds from the start of the clip. */
  startMs: number;
  endMs: number;
  speaker: string;
  fijian: string;
  english: string;
  /** Overlapping an earlier Segment on purpose, such as two people speaking at once. */
  overlapIntended: boolean;
  /** Imported or machine text that nobody has reviewed yet (VCMS-04). */
  draft: boolean;
  /** Moved by a change to the Excerpt and no longer fitting the clip, until its times are edited. */
  retimed: boolean;
};

/** A portion of the video by source in and out times; null is the whole video. */
export type Excerpt = { sourceStartMs: number; sourceEndMs: number } | null;

export type SegmentField = "startMs" | "endMs" | "speaker" | "fijian" | "english";

export type SegmentProblem = { segmentId: string; position: number; field: SegmentField; message: string };

export const SEGMENT_LIMITS = { text: 500, speaker: 80, segments: 1000 } as const;

/** How far one keyboard nudge moves a time. */
export const NUDGE_MS = 100;

/** How long the clip a Learning Layer is built on lasts. */
export const clipDuration = (excerpt: Excerpt, videoDurationMs: number) =>
  excerpt ? excerpt.sourceEndMs - excerpt.sourceStartMs : videoDurationMs;

/** A time as staff read it: "1:01.250", or with hours "1:02:05.004". */
export function formatTimecode(ms: number) {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = String(Math.floor((total % 60_000) / 1000)).padStart(2, "0");
  const millis = String(total % 1000).padStart(3, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}.${millis}`
    : `${minutes}:${seconds}.${millis}`;
}

/** A time as staff type it ("1:01.25", "0:05", "12.5", "1:02:05.004"), in milliseconds, or null. */
export function parseTimecode(text: string): number | null {
  const match = text.trim().match(/^(?:(?:(\d+):)?(\d+):)?(\d+)(?:\.(\d{1,3}))?$/);
  if (!match) return null;
  const [, hours, minutes, seconds, fraction] = match;
  // Seconds can only exceed 59 when nothing is written above them ("75.5").
  if ((minutes !== undefined && Number(seconds) > 59) || (hours !== undefined && Number(minutes) > 59)) return null;
  return (
    Number(hours ?? 0) * 3_600_000 +
    Number(minutes ?? 0) * 60_000 +
    Number(seconds) * 1000 +
    Number((fraction ?? "").padEnd(3, "0"))
  );
}

/** A time moved one nudge earlier or later, kept within the clip. */
export const nudge = (ms: number, direction: 1 | -1, clipMs: number) =>
  Math.min(clipMs, Math.max(0, ms + direction * NUDGE_MS));

/**
 * Everything wrong with a Learning Layer's Segments, each naming the Segment (by position, as the
 * editor numbers them) and the field: a start before its end, times within the clip, time order,
 * and overlaps only where marked intentional. An empty list means they can be saved.
 */
export function segmentProblems(segments: Segment[], clipMs: number): SegmentProblem[] {
  const problems: SegmentProblem[] = [];
  let latestEnd = 0;
  let latestEndPosition = 0;
  segments.forEach((segment, index) => {
    const position = index + 1;
    const problem = (field: SegmentField, message: string) =>
      problems.push({ segmentId: segment.id, position, field, message: `Segment ${position} ${message}` });
    if (segment.startMs < 0) problem("startMs", "starts before the clip does.");
    if (segment.endMs === segment.startMs) problem("endMs", "has no length: its end must be after its start.");
    else if (segment.endMs < segment.startMs) problem("endMs", "ends before it starts.");
    else if (segment.endMs > clipMs) problem("endMs", `ends after the clip, which ends at ${formatTimecode(clipMs)}.`);
    const previous = segments[index - 1];
    if (previous && segment.startMs < previous.startMs) {
      problem("startMs", `starts before Segment ${index}. Put Segments in time order.`);
    } else if (index > 0 && segment.startMs < latestEnd && !segment.overlapIntended) {
      problem(
        "startMs",
        `overlaps Segment ${latestEndPosition}. Mark the overlap as intentional, or change the times.`,
      );
    }
    if (!segment.fijian.trim()) problem("fijian", "needs its Fijian text.");
    if (segment.fijian.length > SEGMENT_LIMITS.text) problem("fijian", "has more Fijian text than one Segment holds.");
    if (segment.english.length > SEGMENT_LIMITS.text) problem("english", "has more English than one Segment holds.");
    if (segment.speaker.length > SEGMENT_LIMITS.speaker) problem("speaker", "has too long a speaker name.");
    if (segment.endMs > latestEnd) {
      latestEnd = segment.endMs;
      latestEndPosition = position;
    }
  });
  return problems;
}

/**
 * Segments after the Excerpt changes. Each stays on the same moment of the source video, so its
 * times relative to the clip shift by however far the in time moved; one that no longer fits
 * inside the new clip is flagged as retimed for the Educator to check.
 */
export function retimeExcerpt(segments: Segment[], from: Excerpt, to: Excerpt, videoDurationMs: number): Segment[] {
  const shift = (from?.sourceStartMs ?? 0) - (to?.sourceStartMs ?? 0);
  const clipMs = clipDuration(to, videoDurationMs);
  return segments.map((segment) => {
    const startMs = segment.startMs + shift;
    const endMs = segment.endMs + shift;
    const fits = startMs >= 0 && endMs <= clipMs;
    return { ...segment, startMs, endMs, retimed: segment.retimed || !fits };
  });
}

/** Text with its ends trimmed and blank lines closed up: a Segment's text is a line or two. */
const closeUp = (value: string) => value.trim().replace(/\n\s*\n/g, "\n");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const text = (value: unknown) => (typeof value === "string" ? value : "");

export type ReadSegments = { ok: true; segments: Segment[] } | { ok: false; error: string };

/**
 * Segments as the timeline editor sends them (JSON). IDs it sends are kept, so a Segment stays the
 * same Segment across Revisions; a new Segment is given one. Times must be whole milliseconds.
 */
export function readSegments(json: string): ReadSegments {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { ok: false, error: "The Segments couldn't be read. Reload the editor and try again." };
  }
  if (!Array.isArray(value))
    return { ok: false, error: "The Segments couldn't be read. Reload the editor and try again." };
  if (value.length > SEGMENT_LIMITS.segments) {
    return { ok: false, error: `A Learning Layer holds at most ${SEGMENT_LIMITS.segments} Segments.` };
  }
  const seen = new Set<string>();
  const segments: Segment[] = [];
  for (const [index, item] of value.entries()) {
    if (!isRecord(item) || !Number.isInteger(item.startMs) || !Number.isInteger(item.endMs)) {
      return { ok: false, error: `Segment ${index + 1} has no usable times.` };
    }
    const id = typeof item.id === "string" && UUID.test(item.id) ? item.id : crypto.randomUUID();
    if (seen.has(id)) return { ok: false, error: `Segment ${index + 1} repeats another Segment's ID.` };
    seen.add(id);
    segments.push({
      id,
      startMs: item.startMs as number,
      endMs: item.endMs as number,
      speaker: text(item.speaker).trim(),
      fijian: closeUp(text(item.fijian)),
      english: closeUp(text(item.english)),
      overlapIntended: item.overlapIntended === true,
      draft: item.draft === true,
      retimed: item.retimed === true,
    });
  }
  return { ok: true, segments };
}
