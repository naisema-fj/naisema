import {
  type Activity,
  type ActivityKind,
  type ActivityProgress,
  completionProgress,
  countsForCompletion,
} from "./activities";
import type { LearningLayerSnapshot } from "./learning-layer-fields";

/**
 * The progressive immersion route through a Learning Layer (VID-03/04/08/09/12, §05A): eight
 * stages a learner is guided through by default, any of which can be opened directly, skipped or
 * revisited without penalty. Pure, so the player and the server share it.
 */

/** Which captions are showing: the language taught's, and English. */
export type CaptionChoice = { taught: boolean; english: boolean };

/**
 * What each stage puts on the page. `english` sends the lines' English (and the English caption
 * track, shown when `captions.english`); `meanings` sends word and phrase meanings, which are
 * English too; `listening` starts with captions and the transcript hidden, each a reveal away;
 * `notes` sends the cultural and context notes; `kinds` are the Activities done in the stage.
 */
type StagePolicy = {
  id: string;
  captions: CaptionChoice;
  english: boolean;
  meanings: boolean;
  listening: boolean;
  notes: boolean;
  kinds: readonly ActivityKind[];
};

const policy = <Id extends string>(id: Id, change: Partial<Omit<StagePolicy, "id">> = {}) =>
  ({
    captions: { taught: true, english: false },
    english: true,
    meanings: true,
    listening: false,
    notes: false,
    kinds: [],
    ...change,
    id,
  }) as const;

const LISTENING = {
  captions: { taught: false, english: false },
  english: false,
  meanings: false,
  listening: true,
} as const;

export const IMMERSION_STAGES = [
  policy("watch", LISTENING),
  policy("captions", { english: false, meanings: false }),
  policy("words", { english: false }),
  policy("support", { captions: { taught: true, english: true }, notes: true }),
  policy("listen-again", LISTENING),
  policy("practise", { kinds: ["listen-repeat", "discrimination"] }),
  policy("respond", { kinds: ["comprehension", "next-line"] }),
  policy("use-it", { kinds: ["real-world"] }),
] as const satisfies readonly StagePolicy[];

export type StageId = (typeof IMMERSION_STAGES)[number]["id"];

const STAGE_IDS: readonly string[] = IMMERSION_STAGES.map((stage) => stage.id);

export const isStageId = (value: unknown): value is StageId => typeof value === "string" && STAGE_IDS.includes(value);

/** The stage an address asks for; the guided route starts at watching naturally. */
export const readStage = (value: string | null): StageId => (isStageId(value) ? value : "watch");

/** The stages either side of one, or null past either end. */
export function stageNeighbours(id: StageId) {
  const at = STAGE_IDS.indexOf(id);
  return {
    previous: (STAGE_IDS[at - 1] as StageId | undefined) ?? null,
    next: (STAGE_IDS[at + 1] as StageId | undefined) ?? null,
  };
}

/**
 * Each stage's name and what to do in it, as learners read them, given the name of the language
 * taught. Each says what to do without making anything compulsory.
 */
export function stageText(id: StageId, language: string) {
  const text: Record<StageId, { name: string; guide: string }> = {
    watch: {
      name: "Watch naturally",
      guide:
        "Watch the clip without captions. You don't need to understand every word: notice who is speaking, where they are and how it feels.",
    },
    captions: {
      name: `${language} captions`,
      guide: `Watch again with the ${language} captions on, and follow the words as you hear them.`,
    },
    words: {
      name: "Explore the words",
      guide: "Open an underlined word to see what it means here. Replay any line as often as you like.",
    },
    support: {
      name: "English and context support",
      guide: "Now the English is here too, with notes on culture and context. Check what you understood.",
    },
    "listen-again": {
      name: "Listen again without English",
      guide:
        "Watch once more with the captions off. You will probably catch more than the first time. Help is there whenever you want it.",
    },
    practise: {
      name: "Repeat and practise",
      guide: "Listen to lines and say them aloud, or use the text versions. Nothing is recorded.",
    },
    respond: {
      name: "Respond",
      guide: "Answer questions about the clip and try what you would say next. Try again as often as you like.",
    },
    "use-it": {
      name: "Use it with someone",
      guide:
        "If you'd like to, try what you learned with someone you know. This is optional and private: nothing is shared or checked.",
    },
  };
  return text[id];
}

const stagePolicy = (id: StageId): StagePolicy => IMMERSION_STAGES.find((stage) => stage.id === id) as StagePolicy;

/** Whether Activities are done in a stage. */
export const stageHasActivities = (id: StageId) => stagePolicy(id).kinds.length > 0;

/** The stage an Activity is done in, by its kind. */
export const stageOfActivity = (activity: Pick<Activity, "kind">) =>
  IMMERSION_STAGES.find((stage) => (stage.kinds as readonly ActivityKind[]).includes(activity.kind))?.id as StageId;

/**
 * What one stage of a published Learning Layer sends to the page. English the stage doesn't use is
 * left out rather than hidden, so nothing (a caption menu, a meaning, a transcript, an answer) can
 * show it (VID-04/09); it comes only when the learner asks for it. Every stage names the required
 * Activities, so progress shows wherever the learner is.
 */
export function learnerView(snapshot: LearningLayerSnapshot, stage: StageId) {
  const rule = stagePolicy(stage);
  return {
    stage,
    captions: rule.captions,
    englishTrack: rule.english,
    listening: rule.listening,
    meanings: rule.meanings,
    segments: rule.english ? snapshot.segments : snapshot.segments.map((segment) => ({ ...segment, english: "" })),
    annotations: rule.meanings ? snapshot.annotations : [],
    expressions: rule.meanings ? snapshot.expressions : {},
    notes: rule.notes ? snapshot.notes : [],
    activities: snapshot.activities.filter((activity) => rule.kinds.includes(activity.kind)),
    required: snapshot.activities
      .filter(countsForCompletion)
      .map((activity) => ({ id: activity.id, kind: activity.kind, stage: stageOfActivity(activity) })),
  };
}

export type LearnerView = ReturnType<typeof learnerView>;

/** What a learner chose to do with a real-world prompt; private, and never part of completion (VID-12). */
export const REAL_WORLD_CHOICES = {
  reflect: "I'll reflect on it",
  tried: "I tried it",
  later: "Maybe later",
  skip: "Skip",
} as const;
export type RealWorldChoice = keyof typeof REAL_WORLD_CHOICES;

/**
 * What a learner has done in a Learning Layer: the stages they opened, each Activity they answered
 * (attempted with its feedback seen, and whether the latest checked answer was right, or null where
 * nothing is checked), and their real-world choices.
 */
export type LearnerProgress = {
  visited: StageId[];
  activities: Record<string, ActivityProgress & { correct: boolean | null }>;
  realWorld: Record<string, RealWorldChoice>;
};

export const EMPTY_PROGRESS: LearnerProgress = { visited: [], activities: {}, realWorld: {} };

export const recordVisit = (progress: LearnerProgress, stage: StageId): LearnerProgress =>
  progress.visited.includes(stage) ? progress : { ...progress, visited: [...progress.visited, stage] };

/**
 * An answer, by either route: the Activity is attempted and its feedback, shown with the answer,
 * seen. Trying again changes only whether the latest answer was right, so a completion is never
 * undone.
 */
export const recordAnswer = (
  progress: LearnerProgress,
  activityId: string,
  correct: boolean | null,
): LearnerProgress => ({
  ...progress,
  activities: { ...progress.activities, [activityId]: { attempted: true, feedbackViewed: true, correct } },
});

export const recordRealWorld = (progress: LearnerProgress, activityId: string, choice: RealWorldChoice) => ({
  ...progress,
  realWorld: { ...progress.realWorld, [activityId]: choice },
});

/**
 * Progress as separate states: completion by the Completion Rule, how many checked answers were
 * right, how many Activities were practised, and the real-world choices. Only completion depends on
 * the required Activities, and nothing but answering them moves it.
 */
export function progressSummary(required: LearnerView["required"], progress: LearnerProgress) {
  const answered = Object.values(progress.activities);
  const checked = answered.filter((state) => state.correct !== null);
  return {
    completion: completionProgress(
      required.map((activity) => ({ ...activity, required: true })),
      progress.activities,
    ),
    answers: { checked: checked.length, right: checked.filter((state) => state.correct).length },
    practised: answered.length,
    realWorld: progress.realWorld,
  };
}
