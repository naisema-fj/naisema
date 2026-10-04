import { useState } from "react";
import {
  ACTIVITY_KINDS,
  ACTIVITY_LIMITS,
  type Activity,
  type ActivityField,
  type ActivityKind,
  type ActivityProblem,
  type ActivityProgress,
  completionProgress,
  forKind,
  usesChoices,
} from "~/lib/activities";
import type { Segment } from "~/lib/segment-rules";

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
      required: kind !== "real-world",
      textAlternative: "",
    },
    kind,
  );

/** How a Segment is named in a list: its place and the start of its Fijian. */
const segmentName = (segment: Segment, index: number) => {
  const words = segment.fijian.length > 40 ? `${segment.fijian.slice(0, 40)}…` : segment.fijian;
  return `Segment ${index + 1}${words ? `: ${words}` : ""}`;
};

const MODEL_LABELS: Partial<Record<ActivityKind, string>> = {
  "listen-repeat": "Words to repeat (Fijian)",
  "next-line": "Model response",
  "real-world": "An example (optional)",
};

export function ActivitiesEditor({ activities, segments, problems, onChange, onPlay, pronunciationFor }: Props) {
  const [adding, setAdding] = useState<ActivityKind>("listen-repeat");
  const [previewing, setPreviewing] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Record<string, ActivityProgress>>({});
  const completion = completionProgress(activities, progress);
  const update = (id: string, change: Partial<Activity>) =>
    onChange(activities.map((activity) => (activity.id === id ? { ...activity, ...change } : activity)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...activities];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };
  const required = activities.filter((activity) => activity.required && activity.kind !== "real-world").length;

  return (
    <div className="activities-editor">
      <div className="completion-rule">
        <h3>Completion Rule</h3>
        {required ? (
          <p>
            {`Learners complete this Learning Layer once they have tried ${required === 1 ? "the required Activity" : `each of the ${required} required Activities`} and seen its feedback, by the standard or the text route. Watching alone never completes it, and real-world prompts are never required.`}
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
          return (
            <li key={activity.id} id={`activity-${activity.id}`} className="activity" aria-label={name}>
              <h3>
                {name}: {ACTIVITY_KINDS[activity.kind]}
                {activity.required && activity.kind !== "real-world" && <span className="badge">Required</span>}
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
                {Object.entries(ACTIVITY_KINDS).map(([value, kindName]) => (
                  <option key={value} value={value}>
                    {kindName}
                  </option>
                ))}
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
                <fieldset className="activity-choices" {...described("options")}>
                  <legend>
                    Choices<span className="visually-hidden"> for {name}</span>
                  </legend>
                  {activity.kind === "next-line" && <p className="hint">Give choices, a model response, or both.</p>}
                  {activity.options.map((option, at) => (
                    <div key={option.id} className="activity-choice">
                      <label htmlFor={`${fieldId("options")}-${option.id}`}>Choice {at + 1}</label>
                      <input
                        id={`${fieldId("options")}-${option.id}`}
                        value={option.text}
                        maxLength={ACTIVITY_LIMITS.option}
                        onChange={(event) =>
                          update(activity.id, {
                            options: activity.options.map((item) =>
                              item.id === option.id ? { ...item, text: event.target.value } : item,
                            ),
                          })
                        }
                      />
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={option.correct}
                          onChange={(event) =>
                            update(activity.id, {
                              options: activity.options.map((item) =>
                                item.id === option.id ? { ...item, correct: event.target.checked } : item,
                              ),
                            })
                          }
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
                    lang={activity.kind === "listen-repeat" ? "fj" : undefined}
                    value={activity.modelResponse}
                    maxLength={ACTIVITY_LIMITS.modelResponse}
                    onChange={(event) => update(activity.id, { modelResponse: event.target.value })}
                    {...described("modelResponse")}
                  />
                  {error("modelResponse")}
                </>
              )}

              {activity.kind === "listen-repeat" && (
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
                {activity.kind === "real-world"
                  ? "A note for after they reflect (optional)"
                  : "Feedback (shown once the learner has answered)"}
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

              {activity.kind === "real-world" ? (
                <>
                  <p className="hint">A real-world prompt is always optional, so it is never required.</p>
                  {error("required")}
                </>
              ) : (
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={activity.required}
                    onChange={(event) => update(activity.id, { required: event.target.checked })}
                  />{" "}
                  Required for completion<span className="visually-hidden"> ({name})</span>
                </label>
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
                <ActivityPreview
                  // A changed Activity starts its preview afresh.
                  key={JSON.stringify(activity)}
                  id={`activity-${activity.id}-preview`}
                  name={name}
                  activity={activity}
                  onPlay={() => onPlay(linked < 0 ? null : activity.segmentId)}
                  onProgress={(state) => setProgress((current) => ({ ...current, [activity.id]: state }))}
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
          {Object.entries(ACTIVITY_KINDS).map(([value, kindName]) => (
            <option key={value} value={value}>
              {kindName}
            </option>
          ))}
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

const REFLECTIONS = {
  reflect: "I'll reflect on it",
  tried: "I tried it",
  later: "Maybe later",
  skip: "Skip",
} as const;

/**
 * An Activity as a learner sees it, with its text route. Trying it and seeing its feedback are
 * reported up for the Completion Rule; a real-world prompt reports nothing, and its reflection
 * stays in the page.
 */
function ActivityPreview({
  id,
  name,
  activity,
  onPlay,
  onProgress,
}: {
  id: string;
  name: string;
  activity: Activity;
  onPlay: () => void;
  onProgress: (progress: ActivityProgress) => void;
}) {
  const [viaText, setViaText] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [written, setWritten] = useState("");
  const [answered, setAnswered] = useState(false);
  const [reflection, setReflection] = useState<keyof typeof REFLECTIONS | null>(null);
  const answer = () => {
    setAnswered(true);
    // The feedback appears with the answer, so both are recorded together.
    onProgress({ attempted: true, feedbackViewed: true, viaText });
  };
  const choice = activity.options.find((option) => option.id === chosen);
  const correct = activity.options.filter((option) => option.correct).map((option) => option.text);
  const hasChoices = activity.options.length > 0;
  const audio = activity.kind === "listen-repeat" || activity.kind === "discrimination";

  return (
    <section id={id} className="activity-preview" aria-label={`Learner preview of ${name}`}>
      <p className="meta">Learner preview. Nothing here is saved or recorded.</p>
      {activity.kind !== "real-world" && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={viaText}
            onChange={(event) => {
              setViaText(event.target.checked);
              setAnswered(false);
            }}
          />{" "}
          Use the text version
        </label>
      )}
      <p>{activity.prompt}</p>
      {viaText ? (
        <p className="activity-alternative">{activity.textAlternative}</p>
      ) : (
        audio && (
          <button type="button" onClick={onPlay}>
            {activity.segmentId ? "Play the Segment" : "Play the clip"}
          </button>
        )
      )}

      {activity.kind === "real-world" ? (
        <fieldset>
          <legend>What would you like to do?</legend>
          {Object.entries(REFLECTIONS).map(([value, label]) => (
            <label key={value} className="checkbox">
              <input
                type="radio"
                name={`${id}-reflection`}
                checked={reflection === value}
                onChange={() => setReflection(value as keyof typeof REFLECTIONS)}
              />{" "}
              {label}
            </label>
          ))}
          {reflection === "reflect" && (
            <>
              <label htmlFor={`${id}-reflect`}>Your reflection (private: it stays on your device)</label>
              <textarea
                id={`${id}-reflect`}
                rows={2}
                value={written}
                onChange={(event) => setWritten(event.target.value)}
              />
            </>
          )}
          {reflection && activity.feedback && <p>{activity.feedback}</p>}
          {activity.modelResponse && reflection && <p className="meta">For example: {activity.modelResponse}</p>}
        </fieldset>
      ) : hasChoices ? (
        <fieldset disabled={answered}>
          <legend>Choose an answer</legend>
          {activity.options.map((option) => (
            <label key={option.id} className="checkbox">
              <input
                type="radio"
                name={`${id}-choice`}
                checked={chosen === option.id}
                onChange={() => setChosen(option.id)}
              />{" "}
              {option.text}
            </label>
          ))}
          <button type="button" disabled={!chosen} onClick={answer}>
            Check my answer
          </button>
        </fieldset>
      ) : (
        <>
          {(viaText || activity.kind === "next-line") && (
            <>
              <label htmlFor={`${id}-written`}>
                {activity.kind === "listen-repeat" ? "Write it out" : "What would you say? (optional)"}
              </label>
              <textarea
                id={`${id}-written`}
                rows={2}
                lang="fj"
                value={written}
                disabled={answered}
                onChange={(event) => setWritten(event.target.value)}
              />
            </>
          )}
          {!viaText && activity.kind === "listen-repeat" && (
            <p className="hint">Say it aloud, as many times as you like. Nothing is recorded.</p>
          )}
          <button type="button" disabled={answered} onClick={answer}>
            {activity.kind === "listen-repeat" && !viaText ? "I've said it" : "Show a model answer"}
          </button>
        </>
      )}

      {answered && (
        <div className="activity-feedback" role="status">
          {hasChoices && choice && (
            <p>
              {choice.correct
                ? "That's right."
                : `Not quite. ${correct.length === 1 ? "The answer is" : "Answers are"}: ${correct.join(", ")}.`}
            </p>
          )}
          {activity.modelResponse && (
            <p>
              {activity.kind === "listen-repeat" ? "Say: " : "You could say: "}
              <span lang="fj">{activity.modelResponse}</span>
            </p>
          )}
          {activity.pronunciation && <p>Pronunciation: {activity.pronunciation}</p>}
          <p>{activity.feedback}</p>
          <button
            type="button"
            onClick={() => {
              setAnswered(false);
              setChosen(null);
              setWritten("");
            }}
          >
            Try again
          </button>
        </div>
      )}
    </section>
  );
}
