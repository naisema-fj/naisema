import { isRecord, type Read, readList, reference, text, UUID } from "./editor-lists";
import type { Segment } from "./segment-rules";

/**
 * Activities and the Completion Rule (docs/phase-1a-defaults.md §2, VID-08/09/12, VCMS-03). An
 * Activity practises or checks one Segment or the whole clip. Each stores its prompt, its reviewed
 * answers (choices marked correct) or a model response, feedback, whether the Completion Rule
 * requires it, and a text alternative for learners who can't use the audio or speak. Listen and
 * repeat also carries the Educator's pronunciation guidance; learners say it aloud and compare,
 * and nothing ever records them. Shared by the editor in the browser and the server.
 */

export const ACTIVITY_KINDS = {
  "listen-repeat": "Listen and repeat",
  comprehension: "Comprehension (multiple choice)",
  discrimination: "Listening discrimination",
  "next-line": "What would you say next?",
  "real-world": "Real-world prompt",
} as const;
export type ActivityKind = keyof typeof ACTIVITY_KINDS;

/** A choice a learner can pick; the correct ones are the reviewed answers. */
export type ActivityOption = { id: string; text: string; correct: boolean };

export type Activity = {
  id: string;
  kind: ActivityKind;
  /** The Segment it practises, or null for the whole clip. */
  segmentId: string | null;
  prompt: string;
  /** Choices, for multiple choice, listening discrimination and (optionally) what would you say next. */
  options: ActivityOption[];
  /** The words to repeat, or a good thing to say next; an example for a real-world prompt. */
  modelResponse: string;
  /** What the learner sees once they have answered. */
  feedback: string;
  /** The Educator's pronunciation guidance, for listen and repeat only (VID-08). */
  pronunciation: string;
  /** Whether the Completion Rule needs it done. A real-world prompt never is. */
  required: boolean;
  /** How to do it without hearing the audio or speaking (VID-09). */
  textAlternative: string;
};

export const ACTIVITY_LIMITS = {
  activities: 50,
  options: 6,
  prompt: 500,
  option: 200,
  modelResponse: 500,
  feedback: 1000,
  pronunciation: 200,
  textAlternative: 1000,
} as const;

/**
 * What each kind needs, in one place: whether it offers choices, whether it has a model response
 * ("either" means choices, a model response or both), whether it needs a Segment, whether it can
 * be required, whether it needs feedback, whether learners listen to it, and whether it carries
 * pronunciation guidance.
 */
export const KIND_RULES: Record<
  ActivityKind,
  {
    choices: "required" | "optional" | "none";
    model: "required" | "either" | "optional" | "none";
    needsSegment: boolean;
    canBeRequired: boolean;
    needsFeedback: boolean;
    listens: boolean;
    pronunciation: boolean;
  }
> = {
  "listen-repeat": {
    choices: "none",
    model: "required",
    needsSegment: true,
    canBeRequired: true,
    needsFeedback: true,
    listens: true,
    pronunciation: true,
  },
  comprehension: {
    choices: "required",
    model: "none",
    needsSegment: false,
    canBeRequired: true,
    needsFeedback: true,
    listens: false,
    pronunciation: false,
  },
  discrimination: {
    choices: "required",
    model: "none",
    needsSegment: false,
    canBeRequired: true,
    needsFeedback: true,
    listens: true,
    pronunciation: false,
  },
  "next-line": {
    choices: "optional",
    model: "either",
    needsSegment: false,
    canBeRequired: true,
    needsFeedback: true,
    listens: false,
    pronunciation: false,
  },
  "real-world": {
    choices: "none",
    model: "optional",
    needsSegment: false,
    canBeRequired: false,
    needsFeedback: false,
    listens: false,
    pronunciation: false,
  },
};

export const usesChoices = (kind: ActivityKind) => KIND_RULES[kind].choices !== "none";

/** Whether the Completion Rule counts an Activity: it is required, and its kind can be. */
export const countsForCompletion = (activity: Activity) => activity.required && KIND_RULES[activity.kind].canBeRequired;
export const isActivityKind = (value: unknown): value is ActivityKind =>
  typeof value === "string" && Object.hasOwn(ACTIVITY_KINDS, value);

/**
 * An Activity changed to another kind, keeping only what that kind uses, so nothing it no longer
 * shows is saved or reviewed.
 */
export function forKind(activity: Activity, kind: ActivityKind): Activity {
  return {
    ...activity,
    kind,
    options: usesChoices(kind) ? activity.options : [],
    modelResponse: KIND_RULES[kind].model === "none" ? "" : activity.modelResponse,
    pronunciation: KIND_RULES[kind].pronunciation ? activity.pronunciation : "",
    required: KIND_RULES[kind].canBeRequired && activity.required,
  };
}

export type ActivityField =
  | "segmentId"
  | "prompt"
  | "options"
  | "modelResponse"
  | "feedback"
  | "required"
  | "textAlternative";

/**
 * A problem with an Activity. `revalidate` ones (its Segment removed) are kept and shown until the
 * Educator links it again; the others must be fixed before saving.
 */
export type ActivityProblem = { activityId: string; field: ActivityField; message: string; revalidate: boolean };

/** What each Activity still needs, naming it by its place in the list and the field to fix. */
export function activityProblems(activities: Activity[], segments: Pick<Segment, "id">[]): ActivityProblem[] {
  const problems: ActivityProblem[] = [];
  for (const [index, activity] of activities.entries()) {
    const name = `Activity ${index + 1}`;
    const problem = (field: ActivityField, message: string, revalidate = false) =>
      problems.push({ activityId: activity.id, field, message: `${name}${message}`, revalidate });
    if (activity.segmentId !== null && !segments.some((segment) => segment.id === activity.segmentId)) {
      problem("segmentId", "'s Segment was removed. Link it to another Segment or the whole clip.", true);
    } else if (KIND_RULES[activity.kind].needsSegment && activity.segmentId === null) {
      problem("segmentId", " needs the Segment to listen to and repeat.");
    }
    if (!activity.prompt.trim()) problem("prompt", " needs a prompt.");
    const { choices, model, needsFeedback, canBeRequired } = KIND_RULES[activity.kind];
    const offered = activity.options.length > 0;
    if (choices === "required" || (choices === "optional" && offered)) {
      if (activity.options.length < 2) problem("options", " needs at least two choices.");
      else if (activity.options.length > ACTIVITY_LIMITS.options)
        problem("options", ` can have at most ${ACTIVITY_LIMITS.options} choices.`);
      else {
        if (activity.options.some((option) => !option.text.trim()))
          problem("options", " has an empty choice. Write it or remove it.");
        if (!activity.options.some((option) => option.correct)) problem("options", " needs a correct choice.");
      }
    }
    if (model === "required" && !activity.modelResponse.trim()) {
      problem("modelResponse", " needs the words to repeat.");
    }
    if (model === "either" && !offered && !activity.modelResponse.trim()) {
      problem("modelResponse", " needs choices or a model response.");
    }
    if (needsFeedback && !activity.feedback.trim()) {
      problem("feedback", " needs feedback for after the learner answers.");
    }
    if (!canBeRequired && activity.required) {
      problem("required", " is a real-world prompt, which can never be required.");
    }
    if (!activity.textAlternative.trim()) {
      problem("textAlternative", " needs a text alternative for learners who can't use the audio.");
    }
  }
  return problems;
}

/** A choice as the editor sends it, or null if it can't be one. */
function readOption(value: unknown): ActivityOption | null {
  if (!isRecord(value)) return null;
  const id = reference(value.id);
  if (!UUID.test(id)) return null;
  return { id, text: text(value.text, ACTIVITY_LIMITS.option), correct: value.correct === true };
}

/**
 * Activities as the editor sends them (JSON), each shaped to its kind. Refused if there are more
 * than a Learning Layer holds, or one links to something that can't be a Segment.
 */
export function readActivities(json: string): Read<Activity> {
  const read = readList<Activity>(json, "Activities", (item) => {
    if (!isActivityKind(item.kind)) return null;
    if (item.segmentId !== null && !(typeof item.segmentId === "string" && UUID.test(item.segmentId))) return null;
    const sent = Array.isArray(item.options) ? item.options.slice(0, ACTIVITY_LIMITS.options + 1) : [];
    const options = sent.map(readOption);
    if (options.some((option) => option === null)) return null;
    if (new Set(options.map((option) => option?.id)).size !== options.length) return null;
    const activity: Activity = {
      id: reference(item.id),
      kind: item.kind,
      segmentId: item.segmentId,
      prompt: text(item.prompt, ACTIVITY_LIMITS.prompt),
      options: options as ActivityOption[],
      modelResponse: text(item.modelResponse, ACTIVITY_LIMITS.modelResponse),
      feedback: text(item.feedback, ACTIVITY_LIMITS.feedback),
      pronunciation: text(item.pronunciation, ACTIVITY_LIMITS.pronunciation),
      required: item.required === true,
      textAlternative: text(item.textAlternative, ACTIVITY_LIMITS.textAlternative),
    };
    // A real-world prompt keeps a `required` it arrived with, so the check can say it's not allowed.
    return { ...forKind(activity, item.kind), required: activity.required };
  });
  if (read.ok && read.items.length > ACTIVITY_LIMITS.activities) {
    return { ok: false, error: `A Learning Layer can have at most ${ACTIVITY_LIMITS.activities} Activities.` };
  }
  return read;
}

/**
 * What a learner has done with an Activity. Taking its text alternative records the same two
 * steps, so it counts exactly as the standard route does.
 */
export type ActivityProgress = { attempted: boolean; feedbackViewed: boolean; viaText?: boolean };

/**
 * The default Completion Rule: every required Activity attempted with its feedback viewed, by
 * either route. Watching isn't an input at all, so it can never complete a Learning Layer, and a
 * Learning Layer with nothing required can't be completed. Real-world prompts never count.
 * Whether answers were right is a separate state and doesn't matter here.
 */
export function completionProgress(activities: Activity[], progress: Record<string, ActivityProgress | undefined>) {
  const required = activities.filter(countsForCompletion);
  const done = required.filter((activity) => {
    const state = progress[activity.id];
    return Boolean(state?.attempted && state.feedbackViewed);
  }).length;
  return { required: required.length, done, complete: required.length > 0 && done === required.length };
}
