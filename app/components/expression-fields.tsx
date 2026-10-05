import { useState } from "react";
import { ANNOTATION_LIMITS, type ExpressionDetails, type ExpressionField } from "~/lib/annotations";

/**
 * An Expression's fields, as a plain form (the library page) or inside the timeline editor, where
 * `onChange` follows every change. An idiom asks for its literal meaning as well (VID-07).
 */
export function ExpressionFields({
  idPrefix,
  values,
  errors = {},
  onChange,
}: {
  idPrefix: string;
  values: ExpressionDetails;
  errors?: Partial<Record<ExpressionField, string>>;
  onChange?: (details: ExpressionDetails) => void;
}) {
  const [details, setDetails] = useState(values);
  const [idiom, setIdiom] = useState(values.literalMeaning !== null);
  const change = (next: ExpressionDetails) => {
    setDetails(next);
    onChange?.(next);
  };
  const id = (field: string) => `${idPrefix}-${field}`;
  const error = (field: ExpressionField) =>
    errors[field] ? (
      <p className="field-error" id={`${id(field)}-error`}>
        {errors[field]}
      </p>
    ) : null;
  const described = (field: ExpressionField) => (errors[field] ? `${id(field)}-error` : undefined);
  return (
    <fieldset className="expression-fields">
      <legend>Expression</legend>
      <label htmlFor={id("headword")}>Word or phrase</label>
      <input
        id={id("headword")}
        name="headword"
        lang="fj"
        value={details.headword}
        maxLength={ANNOTATION_LIMITS.headword}
        aria-describedby={described("headword")}
        onChange={(event) => change({ ...details, headword: event.target.value })}
      />
      {error("headword")}
      <label htmlFor={id("generalMeaning")}>General meaning</label>
      <input
        id={id("generalMeaning")}
        name="generalMeaning"
        value={details.generalMeaning}
        maxLength={ANNOTATION_LIMITS.meaning}
        aria-describedby={described("generalMeaning")}
        onChange={(event) => change({ ...details, generalMeaning: event.target.value })}
      />
      {error("generalMeaning")}
      <label className="checkbox">
        <input
          type="checkbox"
          name="idiom"
          value="yes"
          checked={idiom}
          onChange={(event) => {
            setIdiom(event.target.checked);
            change({ ...details, literalMeaning: event.target.checked ? (details.literalMeaning ?? "") : null });
          }}
        />{" "}
        It's an idiom: its meaning goes beyond its words
      </label>
      {idiom && (
        <>
          <label htmlFor={id("literalMeaning")}>Literal meaning (what the words say)</label>
          <input
            id={id("literalMeaning")}
            name="literalMeaning"
            value={details.literalMeaning ?? ""}
            maxLength={ANNOTATION_LIMITS.meaning}
            aria-describedby={described("literalMeaning")}
            onChange={(event) => change({ ...details, literalMeaning: event.target.value })}
          />
          {error("literalMeaning")}
        </>
      )}
      <label htmlFor={id("grammarNote")}>Grammar note (optional)</label>
      <textarea
        id={id("grammarNote")}
        name="grammarNote"
        rows={2}
        value={details.grammarNote}
        maxLength={ANNOTATION_LIMITS.grammarNote}
        onChange={(event) => change({ ...details, grammarNote: event.target.value })}
      />
      {error("grammarNote")}
      <label htmlFor={id("pronunciation")}>Pronunciation guidance (optional)</label>
      <input
        id={id("pronunciation")}
        name="pronunciation"
        value={details.pronunciation}
        maxLength={ANNOTATION_LIMITS.pronunciation}
        onChange={(event) => change({ ...details, pronunciation: event.target.value })}
      />
      {error("pronunciation")}
    </fieldset>
  );
}
