import type { Activity } from "./activities";
import { isRecord } from "./editor-lists";
import {
  isStageId,
  type LearnerProgress,
  REAL_WORLD_CHOICES,
  type RealWorldChoice,
  recordAnswer,
  recordRealWorld,
  recordVisit,
  type StageId,
} from "./immersion";
import type { StageCaptions, SupportPreferences } from "./learner-session";
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from "./player-rules";
import { fingerprint } from "./review-rules";

/**
 * A Learner Account's progress (#33): the events the player queues and sends (docs/phase-1a-defaults.md
 * §8), how progress made on one Revision counts on another (ADR-0006), and when an inactive account
 * is warned and deleted. Pure, so the player and the server share it.
 */

/** A Learner Account's pages on the public site. */
export const LEARNER_PATHS = {
  home: "/account",
  signIn: "/account/sign-in",
  signOut: "/account/sign-out",
  events: "/account/events",
  export: "/account/export",
} as const;

type OnLayer = { layerId: string; revisionId: string };

/**
 * One change a learner made, with the client's UUID, so a retried send is applied once. Position,
 * stage and choices: the latest the server receives wins. Attempts and saves merge.
 */
export type ProgressEvent = { id: string } & (
  | (OnLayer & { type: "position"; stage: StageId; positionMs: number; segmentId: string | null })
  | (OnLayer & { type: "captions"; stage: StageId; taught: boolean; english: boolean; underAlways: boolean })
  | { type: "preferences"; speed: PlaybackSpeed; textRoute: boolean; alwaysCaptions: boolean }
  | (OnLayer & { type: "attempt"; activityId: string; correct: boolean | null })
  | (OnLayer & { type: "real-world"; activityId: string; choice: RealWorldChoice })
  | { type: "save-video" | "unsave-video"; contentItemId: string }
  | (OnLayer & { type: "save-word"; expressionId: string })
  /** From one Revision, or with no Revision, from all of them. */
  | { type: "unsave-word"; revisionId: string | null; expressionId: string }
);

export type ProgressEventType = ProgressEvent["type"];

/** An event's own fields, without its ID: what the player queues. */
export type EventFields = ProgressEvent extends infer Event
  ? Event extends unknown
    ? Omit<Event, "id">
    : never
  : never;

/** The most events one request carries; a longer queue is sent in several. */
export const MAX_EVENTS_PER_BATCH = 50;

/** Longer, in characters, than any batch the player sends. */
export const MAX_BATCH_LENGTH = 32_768;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ID_LENGTH = 64;
/** Longer than any clip a Learning Layer plays. */
const MAX_POSITION_MS = 24 * 60 * 60 * 1000;

const isId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
const isFlag = (value: unknown): value is boolean => typeof value === "boolean";

/** The fields each kind of event has, read from what was sent, or null when any is missing or wrong. */
function readFields(value: Record<string, unknown>): EventFields | null {
  const onLayer = () =>
    isId(value.layerId) && isId(value.revisionId) ? { layerId: value.layerId, revisionId: value.revisionId } : null;
  const layer = onLayer();
  switch (value.type) {
    case "position": {
      const { stage, positionMs, segmentId } = value;
      const position = typeof positionMs === "number" && Number.isInteger(positionMs) ? positionMs : -1;
      if (!layer || !isStageId(stage) || position < 0 || position > MAX_POSITION_MS) return null;
      if (segmentId !== null && !isId(segmentId)) return null;
      return { type: value.type, ...layer, stage, positionMs: position, segmentId };
    }
    case "captions": {
      const { stage, taught, english, underAlways } = value;
      if (!layer || !isStageId(stage) || !isFlag(taught) || !isFlag(english) || !isFlag(underAlways)) return null;
      return { type: value.type, ...layer, stage, taught, english, underAlways };
    }
    case "preferences": {
      const speed = PLAYBACK_SPEEDS.find((candidate) => candidate === value.speed);
      const { textRoute, alwaysCaptions } = value;
      if (speed === undefined || !isFlag(textRoute) || !isFlag(alwaysCaptions)) return null;
      return { type: value.type, speed, textRoute, alwaysCaptions };
    }
    case "attempt": {
      const { activityId, correct } = value;
      if (!layer || !isId(activityId) || !(correct === null || isFlag(correct))) return null;
      return { type: value.type, ...layer, activityId, correct };
    }
    case "real-world": {
      const { activityId, choice } = value;
      if (!layer || !isId(activityId) || typeof choice !== "string" || !Object.hasOwn(REAL_WORLD_CHOICES, choice)) {
        return null;
      }
      return { type: value.type, ...layer, activityId, choice: choice as RealWorldChoice };
    }
    case "save-video":
    case "unsave-video":
      return isId(value.contentItemId) ? { type: value.type, contentItemId: value.contentItemId } : null;
    case "save-word":
      return layer && isId(value.expressionId)
        ? { type: value.type, ...layer, expressionId: value.expressionId }
        : null;
    case "unsave-word":
      return (value.revisionId === null || isId(value.revisionId)) && isId(value.expressionId)
        ? { type: value.type, revisionId: value.revisionId, expressionId: value.expressionId }
        : null;
    default:
      return null;
  }
}

/**
 * A batch as the player sends it: the well-formed events, in order, with only their own fields, and
 * the IDs of the malformed ones, which can never succeed and so are acknowledged and dropped. An
 * entry without a UUID is skipped. Null unless it is a list of at most MAX_EVENTS_PER_BATCH.
 */
export function readProgressBatch(value: unknown): { events: ProgressEvent[]; malformed: string[] } | null {
  if (!Array.isArray(value) || value.length > MAX_EVENTS_PER_BATCH) return null;
  const events: ProgressEvent[] = [];
  const malformed: string[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.id !== "string" || !UUID.test(entry.id)) continue;
    const fields = readFields(entry);
    if (fields) events.push({ id: entry.id, ...fields } as ProgressEvent);
    else malformed.push(entry.id);
  }
  return { events, malformed };
}

/**
 * What a learner answered: everything about an Activity but its ID and whether it is required. An
 * attempt counts on a later Revision only while this is unchanged (ADR-0006).
 */
export const activityFingerprint = ({ id: _id, required: _required, ...answered }: Activity) => fingerprint(answered);

export type StoredAttempt = {
  activityId: string;
  activityFingerprint: string;
  correct: boolean | null;
  attemptedAt: Date;
};

/**
 * A learner's progress on the published Revision, from everything they did on any Revision: an
 * attempt counts only if its Activity is still there with the same fingerprint, and whether the
 * latest of those was right is shown. Activities answered only in an earlier form are listed as
 * done on an earlier version; they never count towards completion.
 */
export function progressForRevision(input: {
  activities: Pick<Activity, "id">[];
  fingerprints: Record<string, string>;
  attempts: StoredAttempt[];
  visited: StageId[];
  realWorld: Record<string, RealWorldChoice>;
}): { progress: LearnerProgress; earlier: string[] } {
  const here = new Set(input.activities.map((activity) => activity.id));
  const activities: LearnerProgress["activities"] = {};
  const latest = new Map<string, Date>();
  const earlier = new Set<string>();
  for (const attempt of input.attempts) {
    if (!here.has(attempt.activityId) || input.fingerprints[attempt.activityId] !== attempt.activityFingerprint) {
      earlier.add(attempt.activityId);
      continue;
    }
    const before = latest.get(attempt.activityId);
    if (before && before > attempt.attemptedAt) continue;
    latest.set(attempt.activityId, attempt.attemptedAt);
    activities[attempt.activityId] = { attempted: true, feedbackViewed: true, correct: attempt.correct };
  }
  return {
    progress: {
      visited: input.visited,
      activities,
      realWorld: Object.fromEntries(Object.entries(input.realWorld).filter(([activityId]) => here.has(activityId))),
    },
    earlier: [...earlier].filter((activityId) => !activities[activityId]),
  };
}

/**
 * Where a learner carries on from, in the Learning Layer's own time: their exact position on the
 * same Revision; on another, the start of the Segment they were in while it is still there
 * (ADR-0006); otherwise, and before they started, nowhere.
 */
export function resumeAt(
  state: { revisionId: string; positionMs: number; segmentId: string | null },
  revisionId: string,
  segments: { id: string; startMs: number }[],
): number | null {
  if (state.positionMs <= 0) return null;
  if (state.revisionId === revisionId) return state.positionMs;
  return segments.find((segment) => segment.id === state.segmentId)?.startMs ?? null;
}

const DAY_MS = 86_400_000;
/** Inactive accounts are deleted after 24 months (docs/decision-log.md, learner data)… */
export const INACTIVE_DAYS = 730;
/** …after a warning this many days before. */
export const INACTIVITY_WARNING_DAYS = 30;

/**
 * What the daily job does about one Learner Account: warn it 30 days before 24 months without
 * activity, delete it 30 days after that unless it was used since, or nothing. Any activity clears
 * the warning.
 */
export function inactivityStep(
  account: { lastActiveAt: Date; inactivityWarnedAt: Date | null },
  now: Date,
): "none" | "warn" | "delete" {
  const idle = now.getTime() - account.lastActiveAt.getTime();
  const warned = account.inactivityWarnedAt;
  if (!warned) return idle >= (INACTIVE_DAYS - INACTIVITY_WARNING_DAYS) * DAY_MS ? "warn" : "none";
  if (account.lastActiveAt > warned) return "none";
  return now.getTime() - warned.getTime() >= INACTIVITY_WARNING_DAYS * DAY_MS ? "delete" : "none";
}

/** What the player starts from for a signed-in learner on a published Learning Layer. */
export type LearnerLayerState = {
  progress: LearnerProgress;
  /** Activities answered only in an earlier form (ADR-0006). */
  earlier: string[];
  /** Whether the Learning Layer was completed on an earlier Revision and not yet on this one. */
  completedEarlier: boolean;
  captions: Partial<Record<StageId, StageCaptions>>;
  /** Where to carry on from, in the Learning Layer's own time, or null. */
  resumeMs: number | null;
  preferences: SupportPreferences;
  savedWords: string[];
  videoSaved: boolean;
};

/** How long the queue waits before sending again after its nth failed send in a row. */
export const retryDelay = (failures: number) => Math.min(60_000, 2_000 * 2 ** (Math.max(1, failures) - 1));

/** What the player shows for a signed-in learner on one Learning Layer. */
export type ShownState = {
  progress: LearnerProgress;
  captions: Partial<Record<StageId, StageCaptions>>;
  preferences: SupportPreferences;
  savedWords: string[];
  videoSaved: boolean;
};

/**
 * What the server last said, with the learner's queued, not yet acknowledged events on top, so a
 * page opened while offline still shows what they did. Only events for this Learning Layer's
 * Revision (and its Video, and the learner's preferences) apply.
 */
export function withQueued(
  shown: ShownState,
  queued: (ProgressEvent | EventFields)[],
  on: { layerId: string; revisionId: string; contentItemId: string },
): ShownState {
  let { progress, captions, preferences, savedWords, videoSaved } = shown;
  const here = (event: { layerId: string; revisionId: string }) =>
    event.layerId === on.layerId && event.revisionId === on.revisionId;
  for (const event of queued) {
    switch (event.type) {
      case "preferences":
        preferences = { speed: event.speed, textRoute: event.textRoute, alwaysCaptions: event.alwaysCaptions };
        break;
      case "save-video":
      case "unsave-video":
        if (event.contentItemId === on.contentItemId) videoSaved = event.type === "save-video";
        break;
      case "unsave-word":
        savedWords = savedWords.filter((word) => word !== event.expressionId);
        break;
      case "save-word":
        if (!savedWords.includes(event.expressionId)) savedWords = [...savedWords, event.expressionId];
        break;
      case "position":
        if (here(event)) progress = recordVisit(progress, event.stage);
        break;
      case "captions":
        if (here(event)) {
          const { taught, english, underAlways } = event;
          captions = { ...captions, [event.stage]: { taught, english, underAlways } };
        }
        break;
      case "attempt":
        if (here(event)) progress = recordAnswer(progress, event.activityId, event.correct);
        break;
      case "real-world":
        if (here(event)) progress = recordRealWorld(progress, event.activityId, event.choice);
        break;
    }
  }
  return { progress, captions, preferences, savedWords, videoSaved };
}
