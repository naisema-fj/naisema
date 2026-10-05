import { isRecord } from "./editor-lists";
import type { LearningLayerSnapshot } from "./learning-layer-fields";

/**
 * Learning events from the immersion player (§05A): which line was replayed, which support was
 * turned on or off, which Activity was attempted and its feedback seen, and that a Learning Layer
 * was completed. They carry the Learning Layer's own IDs and a fixed support name only, never a
 * learner, a visitor, or anything they wrote or chose. Shared by the player and the server.
 */
export const LEARNING_EVENTS = [
  "segment_replayed",
  "support_toggled",
  "activity_attempted",
  "feedback_viewed",
  "learning_completed",
] as const;
export type LearningEventName = (typeof LEARNING_EVENTS)[number];

/** The supports a learner can turn on or off, by their fixed names. */
export const SUPPORTS = [
  "fijian-captions",
  "english-captions",
  "transcript",
  "english-line",
  "help",
  "speed",
  "text-route",
  "always-captions",
] as const;
export type Support = (typeof SUPPORTS)[number];

export type LearningEvent =
  | { name: "segment_replayed"; segmentId: string }
  | { name: "support_toggled"; support: Support }
  | { name: "activity_attempted" | "feedback_viewed"; activityId: string }
  | { name: "learning_completed" };

/**
 * An event as the player sends it, or null unless it names a known event and only IDs that belong
 * to this Learning Layer Revision (or a known support).
 */
export function readLearningEvent(
  value: unknown,
  snapshot: Pick<LearningLayerSnapshot, "segments" | "activities">,
): LearningEvent | null {
  if (!isRecord(value)) return null;
  switch (value.name) {
    case "segment_replayed":
      return snapshot.segments.some((segment) => segment.id === value.segmentId)
        ? { name: value.name, segmentId: value.segmentId as string }
        : null;
    case "support_toggled":
      return SUPPORTS.includes(value.support as Support)
        ? { name: value.name, support: value.support as Support }
        : null;
    case "activity_attempted":
    case "feedback_viewed":
      return snapshot.activities.some((activity) => activity.id === value.activityId)
        ? { name: value.name, activityId: value.activityId as string }
        : null;
    case "learning_completed":
      return { name: value.name };
    default:
      return null;
  }
}

/** The one ID or support name an event carries beyond its Learning Layer's. */
export const eventDetail = (event: LearningEvent) =>
  "segmentId" in event
    ? [event.segmentId]
    : "activityId" in event
      ? [event.activityId]
      : "support" in event
        ? [event.support]
        : [];
