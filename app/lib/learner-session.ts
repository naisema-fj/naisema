import { isRecord } from "./editor-lists";
import {
  type CaptionChoice,
  EMPTY_PROGRESS,
  isStageId,
  type LearnerProgress,
  REAL_WORLD_CHOICES,
  type StageId,
} from "./immersion";
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from "./player-rules";

/**
 * What the immersion player keeps for a visitor without an account, in the tab's session storage,
 * so it lasts only while the tab is open and never leaves the device (§05A; the tab store in
 * app/lib/learner-store.ts). Cross-device saving needs a Learner Account (#33). Support preferences
 * hold for every Learning Layer in the tab; progress belongs to one published Revision (ADR-0006)
 * and starts again when another is published.
 */

/** Support preferences, the same on every Learning Layer. */
export type SupportPreferences = {
  speed: PlaybackSpeed;
  /** Start Activities on their text route. */
  textRoute: boolean;
  /** An accessibility preference: no stage hides the captions in the language taught or the transcript. */
  alwaysCaptions: boolean;
};

/** A learner's own caption choice in a stage, and whether "always show captions" was on when they made it. */
export type StageCaptions = CaptionChoice & { underAlways: boolean };

/** What is kept for one Learning Layer. */
export type LayerSession = {
  revisionId: string;
  progress: LearnerProgress;
  /** Whether `learning_completed` was sent, so it is sent once. */
  completedSent: boolean;
  captions: Partial<Record<StageId, StageCaptions>>;
};

export const DEFAULT_PREFERENCES: SupportPreferences = { speed: 1, textRoute: false, alwaysCaptions: false };

export const newLayerSession = (revisionId: string): LayerSession => ({
  revisionId,
  progress: EMPTY_PROGRESS,
  completedSent: false,
  captions: {},
});

/** What the tab keeps for one Learning Layer. */
export type StoredLayer = Pick<LayerSession, "revisionId" | "progress" | "captions">;

const pairs = (value: unknown) => (isRecord(value) ? Object.entries(value) : []);

/** Support preferences as the tab kept them, keeping only what is well formed. */
export function readPreferences(stored: unknown): SupportPreferences {
  if (!isRecord(stored)) return DEFAULT_PREFERENCES;
  return {
    speed: PLAYBACK_SPEEDS.find((speed) => speed === stored.speed) ?? 1,
    textRoute: stored.textRoute === true,
    alwaysCaptions: stored.alwaysCaptions === true,
  };
}

/**
 * What the tab kept for a Learning Layer's published Revision, keeping only what is well formed.
 * Progress kept for another Revision is dropped, since its Activities and Completion Rule may differ.
 */
export function readLayer(stored: unknown, revisionId: string): StoredLayer {
  const fresh = { revisionId, progress: EMPTY_PROGRESS, captions: {} };
  if (!isRecord(stored)) return fresh;
  const captions = Object.fromEntries(
    pairs(stored.captions).flatMap(([stage, value]) =>
      isStageId(stage) && isRecord(value)
        ? [
            [
              stage,
              {
                taught: value.taught === true,
                english: value.english === true,
                underAlways: value.underAlways === true,
              },
            ],
          ]
        : [],
    ),
  );
  if (stored.revisionId !== revisionId) return { ...fresh, captions };
  const progress = isRecord(stored.progress) ? stored.progress : {};
  return {
    revisionId,
    progress: {
      visited: Array.isArray(progress.visited) ? progress.visited.filter(isStageId) : [],
      activities: Object.fromEntries(
        pairs(progress.activities).flatMap(([id, state]) =>
          isRecord(state) && state.attempted === true && state.feedbackViewed === true
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
    captions,
  };
}

/**
 * The captions showing in a stage: the stage's own, except that "always show captions" never lets
 * a stage hide those in the language taught. A learner's own choice in the stage is kept, unless it
 * was made before they turned the preference on.
 */
export function captionsFor(
  stageDefault: CaptionChoice,
  chosen: StageCaptions | undefined,
  alwaysCaptions: boolean,
): CaptionChoice {
  if (chosen && (chosen.underAlways || !alwaysCaptions)) return { taught: chosen.taught, english: chosen.english };
  return { taught: stageDefault.taught || alwaysCaptions, english: chosen?.english ?? stageDefault.english };
}
