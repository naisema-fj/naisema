import { type Read, readList, reference, text } from "./editor-lists";
import type { Segment } from "./segment-rules";
import { rangeText, type Token } from "./tokens";

/**
 * Annotations, Expressions and context notes (ADR-0011, docs/phase-1a-defaults.md §2, VID-05/07/12).
 * An Annotation links a run of tokens in one Segment to a reusable Expression and says what it
 * means at that moment. It points at token IDs, never character offsets, so editing the text keeps
 * it anchored while its words are still there; when they aren't, it is flagged for the Educator to
 * revalidate and is never quietly re-pointed. Shared by the editor in the browser and the server.
 */

export type Annotation = {
  id: string;
  segmentId: string;
  startTokenId: string;
  endTokenId: string;
  expressionId: string;
  /** What the words mean here, in this moment. */
  contextualMeaning: string;
  grammarNote: string;
  /** Chosen by the Educator for the Learning Layer's vocabulary list. */
  inVocabulary: boolean;
  /**
   * Set when an edit changed how often one of its words appears in the Segment, so which copy it
   * should be on can't be told from the words alone; cleared when the Educator confirms or moves it.
   */
  needsCheck: boolean;
};

/** A cultural or context note, on the whole Learning Layer (`segmentId` null) or one Segment. */
export type ContextNote = {
  id: string;
  segmentId: string | null;
  kind: NoteKind;
  text: string;
  /** Who the knowledge comes from (VID-12). */
  attribution: string;
};

export const NOTE_KINDS = { cultural: "Cultural note", context: "Context note" } as const;
export type NoteKind = keyof typeof NOTE_KINDS;

/** What an Expression says, wherever it is used; a Learning Layer Revision keeps a copy of each it uses. */
export type ExpressionDetails = {
  headword: string;
  generalMeaning: string;
  grammarNote: string;
  pronunciation: string;
  /** Set for an idiom: what its words say, beside what it means (`generalMeaning`). */
  literalMeaning: string | null;
};

export const ANNOTATION_LIMITS = {
  headword: 100,
  meaning: 500,
  grammarNote: 1000,
  pronunciation: 200,
  note: 2000,
  attribution: 200,
} as const;

/** Where an Annotation's first and last tokens are in a Segment (-1 when gone). */
export const tokenRange = (segment: Pick<Segment, "tokens">, annotation: Annotation) => ({
  start: segment.tokens.findIndex((token) => token.id === annotation.startTokenId),
  end: segment.tokens.findIndex((token) => token.id === annotation.endTokenId),
});

/** Where an Annotation's tokens are in its Segment, or null if any part is gone. */
function span(segments: Segment[], annotation: Annotation) {
  const segment = segments.find((item) => item.id === annotation.segmentId);
  if (!segment) return null;
  const { start, end } = tokenRange(segment, annotation);
  if (start < 0 || end < 0 || end < start) return null;
  return { segment, start, end, text: rangeText(segment.fijian, start, end) };
}

/** The words an Annotation covers, as written, or null when it needs revalidating. */
export const annotatedText = (segments: Segment[], annotation: Annotation) => span(segments, annotation)?.text ?? null;

/** How a word is counted: whatever its capitals or Unicode form. */
const wordKey = (text: string) => text.normalize("NFC").toLowerCase();

/**
 * Annotations on a Segment that an edit leaves needing a check: one of their words now appears a
 * different number of times than before, so the diff had to choose which copy keeps the ID.
 */
export function annotationsToCheck(annotations: Annotation[], segmentId: string, before: Token[], after: Token[]) {
  const count = (tokens: Token[], word: string) => tokens.filter((token) => wordKey(token.text) === word).length;
  return annotations
    .filter((annotation) => annotation.segmentId === segmentId)
    .filter((annotation) => {
      const { start, end } = tokenRange({ tokens: after }, annotation);
      if (start < 0 || end < 0) return false;
      return [after[start], after[end]].some((token) => {
        const word = wordKey(token.text);
        return count(after, word) > 1 && count(after, word) !== count(before, word);
      });
    })
    .map((annotation) => annotation.id);
}

/**
 * A problem with an Annotation or note. `revalidate` ones (its words or Segment gone) are kept and
 * shown until the Educator fixes them; the others must be fixed before saving.
 */
export type AnnotationProblem = { annotationId: string; message: string; revalidate: boolean };

/**
 * Annotations that need the Educator: words or Segment gone, words selected backwards, or no
 * Expression. They are kept as they are until the Educator selects the words again or removes them.
 */
export function annotationProblems(
  annotations: Annotation[],
  segments: Segment[],
  expressionIds: Set<string>,
): AnnotationProblem[] {
  return annotations.flatMap((annotation): AnnotationProblem[] => {
    const problem = (message: string, revalidate = false) => [{ annotationId: annotation.id, message, revalidate }];
    const segment = segments.find((item) => item.id === annotation.segmentId);
    if (!segment) return problem("Its Segment was removed. Remove the Annotation.", true);
    const { start, end } = tokenRange(segment, annotation);
    if (start < 0 || end < 0) {
      return problem("Its words are no longer in the Segment. Select them again, or remove it.", true);
    }
    if (end < start) return problem("Its last word comes before its first. Select the words again.");
    if (!expressionIds.has(annotation.expressionId)) return problem("Choose the Expression it links to.");
    if (!annotation.contextualMeaning.trim()) return problem("Say what the words mean here.");
    if (annotation.needsCheck) {
      return problem(
        "One of its words now appears more than once in the Segment. Check it's on the right one, then confirm it.",
        true,
      );
    }
    return [];
  });
}

export type NoteProblem = { noteId: string; message: string; revalidate: boolean };

export function noteProblems(notes: ContextNote[], segments: Segment[]): NoteProblem[] {
  return notes.flatMap((note): NoteProblem[] => {
    const problem = (message: string, revalidate = false) => [{ noteId: note.id, message, revalidate }];
    if (note.segmentId !== null && !segments.some((segment) => segment.id === note.segmentId)) {
      return problem("Its Segment was removed. Remove the note, or move it to the whole Learning Layer.", true);
    }
    if (!note.text.trim()) return problem("Write the note.");
    if (!note.attribution.trim()) return problem("Say who the note comes from.");
    return [];
  });
}

type ExpressionInput = {
  headword: string;
  generalMeaning: string;
  grammarNote: string;
  pronunciation: string;
  /** An idiom: its meaning goes beyond its words. */
  idiom: boolean;
  literalMeaning: string;
};

export type ExpressionField = keyof ExpressionDetails;

export type ReadExpression =
  | { ok: true; details: ExpressionDetails }
  | { ok: false; errors: Partial<Record<ExpressionField, string>> };

/** An Expression's details as a form sends them. An idiom must explain itself beyond its literal words. */
export function readExpressionDetails(input: ExpressionInput): ReadExpression {
  const errors: Partial<Record<ExpressionField, string>> = {};
  const headword = input.headword.trim();
  const generalMeaning = input.generalMeaning.trim();
  const grammarNote = input.grammarNote.trim();
  const pronunciation = input.pronunciation.trim();
  const literal = input.literalMeaning.trim();
  if (!headword) errors.headword = "Enter the word or phrase.";
  else if (headword.length > ANNOTATION_LIMITS.headword) errors.headword = "The word or phrase is too long.";
  if (!generalMeaning) errors.generalMeaning = "Enter its general meaning.";
  else if (generalMeaning.length > ANNOTATION_LIMITS.meaning)
    errors.generalMeaning = "The general meaning is too long.";
  if (grammarNote.length > ANNOTATION_LIMITS.grammarNote) errors.grammarNote = "The grammar note is too long.";
  if (pronunciation.length > ANNOTATION_LIMITS.pronunciation)
    errors.pronunciation = "The pronunciation guide is too long.";
  const { idiom } = input;
  if (idiom && !literal) errors.literalMeaning = "An idiom needs its literal meaning as well as what it means.";
  else if (idiom && literal.toLowerCase() === generalMeaning.toLowerCase()) {
    errors.literalMeaning = "Explain what the idiom means beyond its literal translation.";
  } else if (literal.length > ANNOTATION_LIMITS.meaning) errors.literalMeaning = "The literal meaning is too long.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    details: { headword, generalMeaning, grammarNote, pronunciation, literalMeaning: idiom ? literal : null },
  };
}

export type VocabularyEntry = {
  expressionId: string;
  headword: string;
  generalMeaning: string;
  occurrences: { segmentId: string; startMs: number; text: string }[];
};

/**
 * The vocabulary list (VID-07): each Expression the Educator chose, once, with every moment an
 * Annotation of it occurs, in the order they first occur. Annotations needing revalidation are left
 * out until they are fixed.
 */
export function vocabularyList(
  segments: Segment[],
  annotations: Annotation[],
  expressions: Record<string, Pick<ExpressionDetails, "headword" | "generalMeaning">>,
): VocabularyEntry[] {
  const occurrences = annotations
    .filter((annotation) => annotation.inVocabulary && expressions[annotation.expressionId])
    .flatMap((annotation) => {
      const found = span(segments, annotation);
      return found ? [{ annotation, segment: found.segment, start: found.start, text: found.text }] : [];
    })
    .sort((a, b) => a.segment.startMs - b.segment.startMs || a.start - b.start);
  const entries = new Map<string, VocabularyEntry>();
  for (const { annotation, segment, text } of occurrences) {
    const entry = entries.get(annotation.expressionId) ?? {
      expressionId: annotation.expressionId,
      headword: expressions[annotation.expressionId].headword,
      generalMeaning: expressions[annotation.expressionId].generalMeaning,
      occurrences: [],
    };
    entry.occurrences.push({ segmentId: segment.id, startMs: segment.startMs, text });
    entries.set(annotation.expressionId, entry);
  }
  return [...entries.values()];
}

/**
 * Pronunciation guidance to start a listen-and-repeat Activity from: the pronunciation of each
 * Expression annotated in the Segment, in the order the Annotations were added, each once.
 */
export function pronunciationGuide(
  annotations: Annotation[],
  expressions: Record<string, Pick<ExpressionDetails, "headword" | "pronunciation">>,
  segmentId: string,
) {
  const used = new Set(
    annotations.filter((annotation) => annotation.segmentId === segmentId).map((annotation) => annotation.expressionId),
  );
  return [...used]
    .flatMap((id) => {
      const expression = expressions[id];
      return expression?.pronunciation ? [`${expression.headword}: ${expression.pronunciation}`] : [];
    })
    .join("; ");
}

/** Annotations as the editor sends them (JSON). */
export const readAnnotations = (json: string) =>
  readList<Annotation>(json, "Annotations", (item) => ({
    id: reference(item.id),
    segmentId: reference(item.segmentId),
    startTokenId: reference(item.startTokenId),
    endTokenId: reference(item.endTokenId),
    expressionId: reference(item.expressionId),
    contextualMeaning: text(item.contextualMeaning, ANNOTATION_LIMITS.meaning),
    grammarNote: text(item.grammarNote, ANNOTATION_LIMITS.grammarNote),
    inVocabulary: item.inVocabulary === true,
    needsCheck: item.needsCheck === true,
  }));

/** Cultural and context notes as the editor sends them (JSON). */
export const readNotes = (json: string) =>
  readList<ContextNote>(json, "notes", (item) =>
    item.kind === "cultural" || item.kind === "context"
      ? {
          id: reference(item.id),
          segmentId: item.segmentId === null ? null : reference(item.segmentId),
          kind: item.kind,
          text: text(item.text, ANNOTATION_LIMITS.note),
          attribution: text(item.attribution, ANNOTATION_LIMITS.attribution),
        }
      : null,
  );

export type NewExpression = { id: string; details: ExpressionDetails };

/**
 * Expressions the Educator defined while annotating (JSON), each with the ID its Annotations use
 * for it. Refused with the first problem found, naming the Expression.
 */
export function readNewExpressions(json: string): Read<NewExpression> {
  const read = readList(json, "new Expressions", (item) => ({ id: reference(item.id), input: item }));
  if (!read.ok) return read;
  const items: NewExpression[] = [];
  for (const { id, input } of read.items) {
    const details = readExpressionDetails({
      headword: text(input.headword, 1000),
      generalMeaning: text(input.generalMeaning, 2000),
      grammarNote: text(input.grammarNote, 2000),
      pronunciation: text(input.pronunciation, 1000),
      idiom: input.idiom === true,
      literalMeaning: text(input.literalMeaning, 2000),
    });
    if (!details.ok) {
      const name = text(input.headword, ANNOTATION_LIMITS.headword) || "a new Expression";
      return { ok: false, error: `Check the Expression "${name}": ${Object.values(details.errors)[0]}` };
    }
    items.push({ id, details: details.details });
  }
  return { ok: true, items };
}
