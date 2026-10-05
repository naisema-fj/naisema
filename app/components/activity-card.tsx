import { type ReactNode, useEffect, useState } from "react";
import { type Activity, KIND_RULES } from "~/lib/activities";
import { REAL_WORLD_CHOICES, type RealWorldChoice } from "~/lib/immersion";

/**
 * One Activity as a learner does it (VID-08/09/12), shared by the learner player and the editor's
 * preview: its prompt, a way to hear what it is about, the answer (a choice, saying it aloud, or
 * writing it by the text route), feedback with the answer, and as many retries as wanted. Nothing
 * listens, times or posts anything. A real-world prompt offers a private choice and no answer.
 */
export function ActivityCard({
  id,
  label,
  activity,
  languageTag,
  note,
  initialViaText = false,
  onPlay,
  onAnswer,
  onRouteChange,
  onReflect,
}: {
  id: string;
  label: string;
  activity: Activity;
  languageTag: string;
  /** Shown first, as the editor's preview says nothing in it is kept. */
  note?: ReactNode;
  /** Start on the text route, as a learner who chose text versions does. */
  initialViaText?: boolean;
  onPlay: () => void;
  /** An answer, by either route, with its feedback shown: right or wrong, or null where nothing is checked. */
  onAnswer: (correct: boolean | null, viaText: boolean) => void;
  onRouteChange?: (viaText: boolean) => void;
  onReflect?: (choice: RealWorldChoice) => void;
}) {
  const [viaText, setViaText] = useState(initialViaText);
  // The learner's preference can arrive after the first render; it applies until they choose here.
  const [routeChosen, setRouteChosen] = useState(false);
  useEffect(() => {
    if (!routeChosen) setViaText(initialViaText);
  }, [initialViaText, routeChosen]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [written, setWritten] = useState("");
  const [answered, setAnswered] = useState(false);
  const [reflection, setReflection] = useState<RealWorldChoice | null>(null);
  const choice = activity.options.find((option) => option.id === chosen);
  const correct = activity.options.filter((option) => option.correct).map((option) => option.text);
  const hasChoices = activity.options.length > 0;
  const { listens } = KIND_RULES[activity.kind];
  const answer = () => {
    setAnswered(true);
    // The feedback appears with the answer, so both happen together.
    onAnswer(hasChoices ? Boolean(choice?.correct) : null, viaText);
  };

  return (
    <section id={id} className="activity-preview" aria-label={label}>
      {note}
      {activity.kind !== "real-world" && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={viaText}
            onChange={(event) => {
              // Switching route starts the Activity again.
              setViaText(event.target.checked);
              setRouteChosen(true);
              setAnswered(false);
              setWritten("");
              onRouteChange?.(event.target.checked);
            }}
          />{" "}
          Use the text version
        </label>
      )}
      <p>{activity.prompt}</p>
      {viaText ? (
        <p className="activity-alternative">{activity.textAlternative}</p>
      ) : (
        listens && (
          <button type="button" onClick={onPlay}>
            {activity.segmentId ? "Play the line" : "Play the clip"}
          </button>
        )
      )}

      {activity.kind === "real-world" ? (
        <fieldset>
          <legend>What would you like to do?</legend>
          {Object.entries(REAL_WORLD_CHOICES).map(([value, name]) => (
            <label key={value} className="checkbox">
              <input
                type="radio"
                name={`${id}-reflection`}
                checked={reflection === value}
                onChange={() => {
                  setReflection(value as RealWorldChoice);
                  onReflect?.(value as RealWorldChoice);
                }}
              />{" "}
              {name}
            </label>
          ))}
          {reflection === "reflect" && (
            <>
              <label htmlFor={`${id}-reflect`}>
                Your reflection (private: it stays on this page and is never sent)
              </label>
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
                {viaText
                  ? activity.kind === "listen-repeat"
                    ? "Write it out"
                    : "Write what you would say"
                  : "Or write it (optional)"}
              </label>
              <textarea
                id={`${id}-written`}
                rows={2}
                lang={languageTag}
                value={written}
                disabled={answered}
                onChange={(event) => setWritten(event.target.value)}
              />
            </>
          )}
          {!viaText && <p className="hint">Say it aloud, as many times as you like. Nothing is recorded.</p>}
          {/* By the text route, writing it is the attempt. */}
          <button type="button" disabled={answered || (viaText && !written.trim())} onClick={answer}>
            {viaText ? "Check what I wrote" : "I've said it"}
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
              <span lang={languageTag}>{activity.modelResponse}</span>
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
