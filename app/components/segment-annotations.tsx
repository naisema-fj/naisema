import { useState } from "react";
import {
  ANNOTATION_LIMITS,
  type Annotation,
  type ContextNote,
  type ExpressionDetails,
  NOTE_KINDS,
  type NoteKind,
  readExpressionDetails,
  tokenRange,
} from "~/lib/annotations";
import type { Segment } from "~/lib/segment-rules";
import { rangeText } from "~/lib/tokens";
import { ExpressionFields } from "./expression-fields";

/**
 * Annotating a Segment in the timeline editor (ADR-0011, VCMS-03): its Fijian words as buttons to
 * select a word or phrase, a form linking the selection to an Expression from the library or a new
 * one, with its meaning at that moment, and the Segment's Annotations, flagged when their words
 * are gone. Plain forms throughout: nobody edits JSON.
 */

export type ExpressionChoice = ExpressionDetails & { id: string };

const blankExpression = (headword: string): ExpressionDetails => ({
  headword,
  generalMeaning: "",
  grammarNote: "",
  pronunciation: "",
  literalMeaning: null,
});

type Draft = {
  /** An existing Annotation being changed, or null for a new one. */
  editing: string | null;
  expressionId: string;
  newExpression: ExpressionDetails;
  contextualMeaning: string;
  grammarNote: string;
  inVocabulary: boolean;
};

export function SegmentAnnotations({
  segment,
  label,
  annotations,
  problems,
  choices,
  onSave,
  onRemove,
}: {
  segment: Segment;
  label: string;
  annotations: Annotation[];
  /** Messages for Annotations that need attention, by Annotation ID. */
  problems: Map<string, string>;
  choices: ExpressionChoice[];
  /** Saves an Annotation (new or changed), with a new Expression it defines, if any. */
  onSave: (annotation: Annotation, newExpression: ExpressionChoice | null) => void;
  onRemove: (annotationId: string) => void;
}) {
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const tokens = segment.tokens;
  // Shown as written, so a part of a hyphenated compound reads "ni-vuli", not "ni vuli".
  const selectedText = selection ? rangeText(segment.fijian, selection.start, selection.end) : "";
  const annotatedIds = new Set(
    annotations.flatMap((annotation) => {
      const start = tokens.findIndex((token) => token.id === annotation.startTokenId);
      const end = tokens.findIndex((token) => token.id === annotation.endTokenId);
      return start >= 0 && end >= start ? tokens.slice(start, end + 1).map((token) => token.id) : [];
    }),
  );
  const choiceFor = (id: string) => choices.find((choice) => choice.id === id);
  const prefix = `annotate-${segment.id}`;

  const pick = (index: number) => {
    // The first word starts a selection; a second extends it to that word, either way.
    if (!selection || selection.start !== selection.end) setSelection({ start: index, end: index });
    else setSelection({ start: Math.min(selection.start, index), end: Math.max(selection.start, index) });
  };

  const startAnnotating = (annotation: Annotation | null) => {
    setError("");
    const headword = annotation ? "" : selectedText.toLowerCase();
    setDraft({
      editing: annotation?.id ?? null,
      expressionId:
        annotation?.expressionId ?? (choices.find((choice) => choice.headword.toLowerCase() === headword)?.id || "new"),
      newExpression: blankExpression(headword),
      contextualMeaning: annotation?.contextualMeaning ?? "",
      grammarNote: annotation?.grammarNote ?? "",
      inVocabulary: annotation?.inVocabulary ?? true,
    });
  };

  const save = () => {
    if (!draft) return;
    const existing = annotations.find((annotation) => annotation.id === draft.editing);
    if (!existing && !selection) {
      setError("Select the words first.");
      return;
    }
    if (!draft.contextualMeaning.trim()) {
      setError("Say what the words mean here.");
      return;
    }
    let newExpression: ExpressionChoice | null = null;
    let expressionId = draft.expressionId;
    if (expressionId === "new") {
      // The same check the server makes on save, so a refusal is seen here first.
      const read = readExpressionDetails({
        ...draft.newExpression,
        idiom: draft.newExpression.literalMeaning !== null,
        literalMeaning: draft.newExpression.literalMeaning ?? "",
      });
      if (!read.ok) {
        setError(Object.values(read.errors)[0] ?? "Check the new Expression.");
        return;
      }
      newExpression = { id: crypto.randomUUID(), ...read.details };
      expressionId = newExpression.id;
    }
    onSave(
      {
        id: existing?.id ?? crypto.randomUUID(),
        segmentId: segment.id,
        startTokenId: existing?.startTokenId ?? tokens[selection?.start ?? 0].id,
        endTokenId: existing?.endTokenId ?? tokens[selection?.end ?? 0].id,
        expressionId,
        contextualMeaning: draft.contextualMeaning.trim(),
        grammarNote: draft.grammarNote.trim(),
        inVocabulary: draft.inVocabulary,
        needsCheck: existing?.needsCheck ?? false,
      },
      newExpression,
    );
    setDraft(null);
    setSelection(null);
  };

  const textOf = (annotation: Annotation) => {
    const { start, end } = tokenRange(segment, annotation);
    return start >= 0 && end >= start ? rangeText(segment.fijian, start, end) : null;
  };

  return (
    <div className="segment-annotations">
      {tokens.length > 0 && (
        <fieldset className="token-picker">
          <legend>
            Words to annotate<span className="visually-hidden"> in {label}</span>
          </legend>
          <p className="hint">Select a word, or a first and last word for a phrase.</p>
          <div className="tokens" lang="fj">
            {tokens.map((token, index) => {
              const selected = selection !== null && index >= selection.start && index <= selection.end;
              return (
                <button
                  key={token.id}
                  type="button"
                  className={`token${annotatedIds.has(token.id) ? " annotated" : ""}`}
                  aria-pressed={selected}
                  onClick={() => pick(index)}
                >
                  {token.text}
                </button>
              );
            })}
          </div>
          {selection && (
            <p className="selection">
              Selected: <span lang="fj">{selectedText}</span>{" "}
              <button type="button" onClick={() => startAnnotating(null)}>
                Annotate “{selectedText}”
              </button>{" "}
              <button type="button" onClick={() => setSelection(null)}>
                Clear the selection
              </button>
            </p>
          )}
        </fieldset>
      )}

      {draft && (
        <fieldset className="annotation-form">
          <legend>{draft.editing ? "Change the Annotation" : `Annotate “${selectedText}”`}</legend>
          <label htmlFor={`${prefix}-expression`}>Expression</label>
          <select
            id={`${prefix}-expression`}
            value={draft.expressionId}
            onChange={(event) => setDraft({ ...draft, expressionId: event.target.value })}
          >
            <option value="new">A new Expression…</option>
            {choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.headword}: {choice.generalMeaning}
              </option>
            ))}
          </select>
          {draft.expressionId === "new" && (
            <ExpressionFields
              idPrefix={`${prefix}-new`}
              values={draft.newExpression}
              onChange={(details) => setDraft({ ...draft, newExpression: details })}
            />
          )}
          <label htmlFor={`${prefix}-meaning`}>What it means here</label>
          <input
            id={`${prefix}-meaning`}
            value={draft.contextualMeaning}
            maxLength={ANNOTATION_LIMITS.meaning}
            onChange={(event) => setDraft({ ...draft, contextualMeaning: event.target.value })}
          />
          <label htmlFor={`${prefix}-grammar`}>Grammar note for this moment (optional)</label>
          <input
            id={`${prefix}-grammar`}
            value={draft.grammarNote}
            maxLength={ANNOTATION_LIMITS.grammarNote}
            onChange={(event) => setDraft({ ...draft, grammarNote: event.target.value })}
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={draft.inVocabulary}
              onChange={(event) => setDraft({ ...draft, inVocabulary: event.target.checked })}
            />{" "}
            Add to the vocabulary list
          </label>
          {error && <p className="field-error">{error}</p>}
          <div className="segment-actions">
            <button type="button" onClick={save}>
              {draft.editing ? "Keep the changes" : "Add the Annotation"}
            </button>
            <button type="button" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </fieldset>
      )}

      {annotations.length > 0 && (
        <ul className="annotation-list" aria-label={`Annotations in ${label}`}>
          {annotations.map((annotation) => {
            const words = textOf(annotation);
            const expression = choiceFor(annotation.expressionId);
            const problem = problems.get(annotation.id);
            return (
              <li key={annotation.id} id={`annotation-${annotation.id}`}>
                <span lang="fj">{words ?? "(words gone)"}</span>
                {expression && (
                  <>
                    {" → "}
                    <span lang="fj">{expression.headword}</span>
                  </>
                )}
                : {annotation.contextualMeaning}
                {annotation.inVocabulary && <span className="badge">Vocabulary</span>}
                {problem && (
                  <p className="field-error" role="status">
                    {problem}
                  </p>
                )}
                <div className="segment-actions">
                  <button type="button" onClick={() => startAnnotating(annotation)}>
                    Change<span className="visually-hidden"> the Annotation of {words ?? "missing words"}</span>
                  </button>
                  <button
                    type="button"
                    disabled={!selection}
                    onClick={() => {
                      if (!selection) return;
                      onSave(
                        {
                          ...annotation,
                          startTokenId: tokens[selection.start].id,
                          endTokenId: tokens[selection.end].id,
                          needsCheck: false,
                        },
                        null,
                      );
                      setSelection(null);
                    }}
                  >
                    Move to the selected words
                  </button>
                  {annotation.needsCheck && (
                    <button type="button" onClick={() => onSave({ ...annotation, needsCheck: false }, null)}>
                      It's on the right word<span className="visually-hidden"> ({words})</span>
                    </button>
                  )}
                  <button type="button" onClick={() => onRemove(annotation.id)}>
                    Remove<span className="visually-hidden"> the Annotation of {words ?? "missing words"}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Cultural and context notes (VID-12), on the whole Learning Layer or one Segment, each with who
 * the knowledge comes from.
 */
export function NotesEditor({
  segmentId,
  label,
  notes,
  problems,
  onChange,
  include = (note) => note.segmentId === segmentId,
}: {
  segmentId: string | null;
  label: string;
  notes: ContextNote[];
  problems: Map<string, string>;
  onChange: (notes: ContextNote[]) => void;
  /** Which of the notes this editor shows: by default those on `segmentId`. */
  include?: (note: ContextNote) => boolean;
}) {
  const own = notes.filter(include);
  const update = (id: string, change: Partial<ContextNote>) =>
    onChange(notes.map((note) => (note.id === id ? { ...note, ...change } : note)));
  return (
    <div className="notes-editor">
      {own.map((note, index) => {
        const id = (field: string) => `note-${note.id}-${field}`;
        return (
          <fieldset key={note.id} className="note" id={`note-${note.id}`}>
            <legend>
              {NOTE_KINDS[note.kind]} {index + 1}
              <span className="visually-hidden"> on {label}</span>
            </legend>
            <label htmlFor={id("kind")}>Kind</label>
            <select
              id={id("kind")}
              value={note.kind}
              onChange={(event) => update(note.id, { kind: event.target.value as NoteKind })}
            >
              {Object.entries(NOTE_KINDS).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
            <label htmlFor={id("text")}>Note</label>
            <textarea
              id={id("text")}
              rows={3}
              value={note.text}
              maxLength={ANNOTATION_LIMITS.note}
              onChange={(event) => update(note.id, { text: event.target.value })}
            />
            <label htmlFor={id("attribution")}>From (who the knowledge comes from)</label>
            <input
              id={id("attribution")}
              value={note.attribution}
              maxLength={ANNOTATION_LIMITS.attribution}
              onChange={(event) => update(note.id, { attribution: event.target.value })}
            />
            {problems.get(note.id) && <p className="field-error">{problems.get(note.id)}</p>}
            <div className="segment-actions">
              {note.segmentId !== null && (
                <button type="button" onClick={() => update(note.id, { segmentId: null })}>
                  Move to the whole Learning Layer
                </button>
              )}
              <button type="button" onClick={() => onChange(notes.filter((other) => other.id !== note.id))}>
                Remove the note
              </button>
            </div>
          </fieldset>
        );
      })}
      <button
        type="button"
        onClick={() =>
          onChange([...notes, { id: crypto.randomUUID(), segmentId, kind: "cultural", text: "", attribution: "" }])
        }
      >
        Add a cultural or context note<span className="visually-hidden"> to {label}</span>
      </button>
    </div>
  );
}
