import { useState } from "react";
import {
  ACTIVITY_KINDS,
  ACTIVITY_LIMITS,
  type Activity,
  type ActivityField,
  type ActivityKind,
  type ActivityOption,
  type ActivityProblem,
  type ActivityProgress,
  completionProgress,
  countsForCompletion,
  forKind,
  KIND_RULES,
  usesChoices,
} from "~/lib/activities";
import type { Segment } from "~/lib/segment-rules";
import { ActivityCard } from "./activity-card";

/**
 * A Learning Layer's Activities (VID-08/09/12, VCMS-03): what each asks, its reviewed answers or
 * model response, feedback and text alternative, whether the Completion Rule requires it, and a
 * preview of it as a learner would see it. The preview keeps what is done in it on the page only,
 * and shows the Completion Rule working; nothing in it, or anywhere, uses the microphone.
 */

type Props = {
  activities: Activity[];
  segments: Segment[];
  problems: ActivityProblem[];
  onChange: (activities: Activity[]) => void;
  /** Plays a Segment in the editor's video, or the whole clip for null. */
  onPlay: (segmentId: string | null) => void;
  /** The pronunciation the Expressions annotated in a Segment give, to start guidance from. */
  pronunciationFor: (segmentId: string) => string;
};

const blank = (kind: ActivityKind): Activity =>
  forKind(
    {
      id: crypto.randomUUID(),
      kind,
      segmentId: null,
      prompt: "",
      options: usesChoices(kind)
        ? [
            { id: crypto.randomUUID(), text: "", correct: true },
            { id: crypto.randomUUID(), text: "", correct: false },
          ]
        : [],
      modelResponse: "",
      feedback: "",
      pronunciation: "",
      required: KIND_RULES[kind].canBeRequired,
      textAlternative: "",
    },
    kind,
  );

/** How a Segment is named in a list: its place and the start of its Fijian. */
const segmentName = (segment: Segment, index: number) => {
  const words = segment.fijian.length > 40 ? `${segment.fijian.slice(0, 40)}…` : segment.fijian;
  return `Segment ${index + 1}${words ? `: ${words}` : ""}`;
};

/** Everything an Activity holds, so a preview of it starts afresh, and forgets what was done in it, once it changes. */
const signature = (activity: Activity) => JSON.stringify(activity);

const KindOptions = () =>
  Object.entries(ACTIVITY_KINDS).map(([value, name]) => (
    <option key={value} value={value}>
      {name}
    </option>
  ));

const MODEL_LABELS: Partial<Record<ActivityKind, string>> = {
  "listen-repeat": "Words to repeat (Fijian)",
  "next-line": "Model response",
  "real-world": "An example (optional)",
};

export function ActivitiesEditor({ activities, segments, problems, onChange, onPlay, pronunciationFor }: Props) {
  const [adding, setAdding] = useState<ActivityKind>("listen-repeat");
  const [previewing, setPreviewing] = useState<Set<string>>(new Set());
  // What was done in each preview, against the Activity as it was then.
  const [progress, setProgress] = useState<Record<string, { signature: string; state: ActivityProgress }>>({});
  const completion = completionProgress(
    activities,
    Object.fromEntries(
      activities.flatMap((activity) => {
        const done = progress[activity.id];
        return done?.signature === signature(activity) ? [[activity.id, done.state]] : [];
      }),
    ),
  );
  const update = (id: string, change: Partial<Activity>) =>
    onChange(activities.map((activity) => (activity.id === id ? { ...activity, ...change } : activity)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...activities];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };
  const { required } = completion;

  return (
    <div className="activities-editor">
      <div className="completion-rule">
        <h3>Completion Rule</h3>
        {required ? (
          <p>
            {`Learners complete this Learning Layer once they have tried ${required === 1 ? "the required Activity" : `each of the ${required} required Activities`} and seen its feedback, either by doing it or with its text version. Watching alone never completes it, and real-world prompts are never required.`}
          </p>
        ) : (
          <p className="field-error">
            Nothing is required yet, so learners can't complete this Learning Layer. Mark at least one Activity as
            required.
          </p>
        )}
        {previewing.size > 0 && (
          <p role="status">
            {completion.complete
              ? "In your preview: the Learning Layer is complete."
              : `In your preview: ${completion.done} of ${completion.required} required Activities done.`}{" "}
            <button type="button" onClick={() => setProgress({})}>
              Start the preview again
            </button>
          </p>
        )}
      </div>

      <ol className="activity-list">
        {activities.map((activity, index) => {
          const name = `Activity ${index + 1}`;
          // What was done in its preview, against the Activity as it is now.
          const record = (state: ActivityProgress) =>
            setProgress((current) => ({ ...current, [activity.id]: { signature: signature(activity), state } }));
          const fieldId = (field: ActivityField | "pronunciation" | "kind") => `activity-${activity.id}-${field}`;
          const errors = (field: ActivityField) =>
            problems.filter((problem) => problem.activityId === activity.id && problem.field === field);
          const error = (field: ActivityField) => {
            const found = errors(field);
            return found.length ? (
              <p className="field-error" id={`${fieldId(field)}-error`}>
                {found.map((problem) => problem.message).join(" ")}
              </p>
            ) : null;
          };
          const described = (field: ActivityField) =>
            errors(field).length ? { "aria-invalid": true, "aria-describedby": `${fieldId(field)}-error` } : {};
          const linked = segments.findIndex((segment) => segment.id === activity.segmentId);
          const suggestion = activity.segmentId ? pronunciationFor(activity.segmentId) : "";
          const rules = KIND_RULES[activity.kind];
          const updateOption = (optionId: string, change: Partial<ActivityOption>) =>
            update(activity.id, {
              options: activity.options.map((item) => (item.id === optionId ? { ...item, ...change } : item)),
            });
          return (
            <li key={activity.id} id={`activity-${activity.id}`} className="activity" aria-label={name}>
              <h3>
                {name}: {ACTIVITY_KINDS[activity.kind]}
                {countsForCompletion(activity) && <span className="badge">Required</span>}
              </h3>
              <label htmlFor={fieldId("kind")}>Kind</label>
              <select
                id={fieldId("kind")}
                value={activity.kind}
                onChange={(event) =>
                  onChange(
                    activities.map((item) =>
                      item.id === activity.id ? forKind(item, event.target.value as ActivityKind) : item,
                    ),
                  )
                }
              >
                <KindOptions />
              </select>

              <label htmlFor={fieldId("segmentId")}>Practises</label>
              <select
                id={fieldId("segmentId")}
                value={activity.segmentId ?? ""}
                onChange={(event) => update(activity.id, { segmentId: event.target.value || null })}
                {...described("segmentId")}
              >
                <option value="">The whole clip</option>
                {activity.segmentId !== null && linked < 0 && (
                  <option value={activity.segmentId}>A removed Segment</option>
                )}
                {segments.map((segment, at) => (
                  <option key={segment.id} value={segment.id}>
                    {segmentName(segment, at)}
                  </option>
                ))}
              </select>
              {error("segmentId")}

              <label htmlFor={fieldId("prompt")}>Prompt</label>
              <textarea
                id={fieldId("prompt")}
                rows={2}
                value={activity.prompt}
                maxLength={ACTIVITY_LIMITS.prompt}
                onChange={(event) => update(activity.id, { prompt: event.target.value })}
                {...described("prompt")}
              />
              {error("prompt")}

              {usesChoices(activity.kind) && (
                <fieldset id={fieldId("options")} className="activity-choices" {...described("options")}>
                  <legend>
                    Choices<span className="visually-hidden"> for {name}</span>
                  </legend>
                  {rules.model === "either" && <p className="hint">Give choices, a model response, or both.</p>}
                  {activity.options.map((option, at) => (
                    <div key={option.id} className="activity-choice">
                      <label htmlFor={`${fieldId("options")}-${option.id}`}>Choice {at + 1}</label>
                      <input
                        id={`${fieldId("options")}-${option.id}`}
                        value={option.text}
                        maxLength={ACTIVITY_LIMITS.option}
                        onChange={(event) => updateOption(option.id, { text: event.target.value })}
                      />
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={option.correct}
                          onChange={(event) => updateOption(option.id, { correct: event.target.checked })}
                        />{" "}
                        Correct answer<span className="visually-hidden"> (choice {at + 1})</span>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          update(activity.id, { options: activity.options.filter((item) => item.id !== option.id) })
                        }
                      >
                        Remove<span className="visually-hidden"> choice {at + 1}</span>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={activity.options.length >= ACTIVITY_LIMITS.options}
                    onClick={() =>
                      update(activity.id, {
                        options: [...activity.options, { id: crypto.randomUUID(), text: "", correct: false }],
                      })
                    }
                  >
                    Add a choice<span className="visually-hidden"> to {name}</span>
                  </button>
                  {error("options")}
                </fieldset>
              )}

              {MODEL_LABELS[activity.kind] && (
                <>
                  <label htmlFor={fieldId("modelResponse")}>{MODEL_LABELS[activity.kind]}</label>
                  <textarea
                    id={fieldId("modelResponse")}
                    rows={2}
                    lang={rules.model === "optional" ? undefined : "fj"}
                    value={activity.modelResponse}
                    maxLength={ACTIVITY_LIMITS.modelResponse}
                    onChange={(event) => update(activity.id, { modelResponse: event.target.value })}
                    {...described("modelResponse")}
                  />
                  {error("modelResponse")}
                </>
              )}

              {rules.pronunciation && (
                <>
                  <label htmlFor={fieldId("pronunciation")}>Pronunciation guidance (optional)</label>
                  <input
                    id={fieldId("pronunciation")}
                    value={activity.pronunciation}
                    maxLength={ACTIVITY_LIMITS.pronunciation}
                    onChange={(event) => update(activity.id, { pronunciation: event.target.value })}
                  />
                  <p className="hint">
                    Shown to learners after they have said it aloud. Check it before saving: saving approves it.
                  </p>
                  {suggestion && suggestion !== activity.pronunciation && (
                    <button type="button" onClick={() => update(activity.id, { pronunciation: suggestion })}>
                      Start from the Expressions' pronunciation<span className="visually-hidden"> for {name}</span>
                    </button>
                  )}
                </>
              )}

              <label htmlFor={fieldId("feedback")}>
                {rules.needsFeedback
                  ? "Feedback (shown once the learner has answered)"
                  : "A note for after they reflect (optional)"}
              </label>
              <textarea
                id={fieldId("feedback")}
                rows={2}
                value={activity.feedback}
                maxLength={ACTIVITY_LIMITS.feedback}
                onChange={(event) => update(activity.id, { feedback: event.target.value })}
                {...described("feedback")}
              />
              {error("feedback")}

              <label htmlFor={fieldId("textAlternative")}>
                Text alternative (how to do it without the audio or speaking)
              </label>
              <textarea
                id={fieldId("textAlternative")}
                rows={2}
                value={activity.textAlternative}
                maxLength={ACTIVITY_LIMITS.textAlternative}
                onChange={(event) => update(activity.id, { textAlternative: event.target.value })}
                {...described("textAlternative")}
              />
              {error("textAlternative")}

              {rules.canBeRequired ? (
                <label className="checkbox">
                  <input
                    id={fieldId("required")}
                    type="checkbox"
                    checked={activity.required}
                    onChange={(event) => update(activity.id, { required: event.target.checked })}
                  />{" "}
                  Required for completion<span className="visually-hidden"> ({name})</span>
                </label>
              ) : (
                <>
                  <p className="hint" id={fieldId("required")}>
                    A real-world prompt is always optional.
                  </p>
                  {error("required")}
                </>
              )}

              <div className="segment-actions">
                <button
                  type="button"
                  aria-expanded={previewing.has(activity.id)}
                  aria-controls={`activity-${activity.id}-preview`}
                  onClick={() =>
                    setPreviewing((current) => {
                      const next = new Set(current);
                      if (!next.delete(activity.id)) next.add(activity.id);
                      return next;
                    })
                  }
                >
                  {previewing.has(activity.id) ? "Close the preview" : "Preview as a learner"}
                  <span className="visually-hidden"> ({name})</span>
                </button>
                <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>
                  Move up<span className="visually-hidden"> {name}</span>
                </button>
                <button type="button" disabled={index === activities.length - 1} onClick={() => move(index, 1)}>
                  Move down<span className="visually-hidden"> {name}</span>
                </button>
                <button type="button" onClick={() => onChange(activities.filter((item) => item.id !== activity.id))}>
                  Remove<span className="visually-hidden"> {name}</span>
                </button>
              </div>
              {previewing.has(activity.id) && (
                <ActivityCard
                  // A changed Activity starts its preview afresh.
                  key={signature(activity)}
                  id={`activity-${activity.id}-preview`}
                  label={`Learner preview of ${name}`}
                  activity={activity}
                  languageTag="fj"
                  note={<p className="meta">Learner preview. Nothing here is saved or recorded.</p>}
                  onPlay={() => onPlay(activity.segmentId)}
                  onAnswer={(_correct, viaText) => record({ attempted: true, feedbackViewed: true, viaText })}
                  // Switching route starts the preview of the Activity again.
                  onRouteChange={() => record({ attempted: false, feedbackViewed: false })}
                />
              )}
            </li>
          );
        })}
      </ol>
      <div className="segment-toolbar">
        <label htmlFor="new-activity-kind">New Activity</label>
        <select
          id="new-activity-kind"
          value={adding}
          onChange={(event) => setAdding(event.target.value as ActivityKind)}
        >
          <KindOptions />
        </select>
        <button
          type="button"
          disabled={activities.length >= ACTIVITY_LIMITS.activities}
          onClick={() => onChange([...activities, blank(adding)])}
        >
          Add an Activity
        </button>
      </div>
    </div>
  );
}
