import { EMPTY_PROGRESS, IMMERSION_STAGES, type LearnerProgress, REAL_WORLD_CHOICES, type StageId } from "./immersion";
import type { LearningEvent } from "./learning-events";
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from "./player-rules";

/**
 * What the immersion player keeps for a visitor without an account: their progress and support
 * choices for one Learning Layer, in the tab's session storage, so they last only while the tab is
 * open and never leave the device (§05A). Cross-device saving needs a Learner Account (#33).
 */
export type LearnerSession = {
  progress: LearnerProgress;
  /** Whether `learning_completed` was sent, so it is sent once. */
  completedSent: boolean;
  support: {
    speed: PlaybackSpeed;
    /** Start Activities on their text route. */
    textRoute: boolean;
    /** An accessibility preference: captions and the transcript are never hidden by a stage. */
    alwaysCaptions: boolean;
    /** The captions chosen in each stage, where the learner changed them. */
    captions: Partial<Record<StageId, { taught: boolean; english: boolean }>>;
  };
};

export const NEW_SESSION: LearnerSession = {
  progress: EMPTY_PROGRESS,
  completedSent: false,
  support: { speed: 1, textRoute: false, alwaysCaptions: false, captions: {} },
};

const key = (layerId: string) => `naisema:learning-layer:${layerId}`;
const STAGE_IDS: readonly string[] = IMMERSION_STAGES.map((stage) => stage.id);
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const pairs = (value: unknown) => (isObject(value) ? Object.entries(value) : []);

/** The session kept for a Learning Layer, keeping only what is well formed; a new one otherwise. */
export function loadSession(layerId: string): LearnerSession {
  let stored: unknown;
  try {
    stored = JSON.parse(window.sessionStorage.getItem(key(layerId)) ?? "null");
  } catch {
    return NEW_SESSION;
  }
  if (!isObject(stored)) return NEW_SESSION;
  const progress = isObject(stored.progress) ? stored.progress : {};
  const support = isObject(stored.support) ? stored.support : {};
  return {
    progress: {
      visited: Array.isArray(progress.visited)
        ? (progress.visited.filter((stage) => STAGE_IDS.includes(stage)) as StageId[])
        : [],
      activities: Object.fromEntries(
        pairs(progress.activities).flatMap(([id, state]) =>
          isObject(state) && state.attempted === true && state.feedbackViewed === true
            ? [
                [
                  id,
                  {
                    attempted: true,
                    feedbackViewed: true,
                    correct: typeof state.correct === "boolean" ? state.correct : null,
                  },
                ],
              ]
            : [],
        ),
      ),
      realWorld: Object.fromEntries(
        pairs(progress.realWorld).filter(([, choice]) => Object.hasOwn(REAL_WORLD_CHOICES, choice as string)),
      ) as LearnerProgress["realWorld"],
    },
    completedSent: stored.completedSent === true,
    support: {
      speed: PLAYBACK_SPEEDS.find((speed) => speed === support.speed) ?? 1,
      textRoute: support.textRoute === true,
      alwaysCaptions: support.alwaysCaptions === true,
      captions: Object.fromEntries(
        pairs(support.captions).flatMap(([stage, value]) =>
          STAGE_IDS.includes(stage) && isObject(value)
            ? [[stage, { taught: value.taught === true, english: value.english === true }]]
            : [],
        ),
      ),
    },
  };
}

export function saveSession(layerId: string, session: LearnerSession) {
  try {
    window.sessionStorage.setItem(key(layerId), JSON.stringify(session));
  } catch {
    // Storage can be full or turned off; the page keeps working, it just won't remember.
  }
}

/**
 * Sends a learning event without waiting for it, so it never holds up the page; `keepalive` lets it
 * finish when the learner moves to another step.
 */
export function sendLearningEvent(layerId: string, event: LearningEvent) {
  fetch(`/language/${layerId}/events`, {
    method: "POST",
    body: JSON.stringify(event),
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => undefined);
}
