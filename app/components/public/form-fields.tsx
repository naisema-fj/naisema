import type { Notice } from "~/lib/consent.server";
import { CONSENT_PROMPTS, type ConsentPurpose } from "~/lib/submission-fields";
import { TURNSTILE_SCRIPT } from "~/lib/turnstile";

/**
 * The parts of a public form (docs/phase-1a-defaults.md §4). They work without client JavaScript,
 * apart from Turnstile's own widget: a refused form comes back from the server with every answer
 * as typed and each problem next to its field.
 */

export type Errors = Record<string, string>;
export type Values = Record<string, string | string[] | undefined>;

const describedBy = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(" ") || undefined;

function FieldError({ name, errors }: { name: string; errors: Errors }) {
  return errors[name] ? (
    <p id={`${name}-error`} className="field-error">
      {errors[name]}
    </p>
  ) : null;
}

export function TextField({
  name,
  label,
  values,
  errors,
  long = false,
  type = "text",
  hint,
  autoComplete,
  maxLength,
  optional = false,
}: {
  name: string;
  label: string;
  values: Values;
  errors: Errors;
  long?: boolean;
  type?: "text" | "email";
  hint?: string;
  autoComplete?: string;
  maxLength: number;
  optional?: boolean;
}) {
  const props = {
    id: name,
    name,
    defaultValue: String(values[name] ?? ""),
    maxLength,
    required: !optional,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": describedBy(hint && `${name}-hint`, errors[name] && `${name}-error`),
  };
  return (
    <div className="form-field">
      <label htmlFor={name}>
        {label}
        {optional && <span className="optional"> (optional)</span>}
      </label>
      {hint && (
        <p id={`${name}-hint`} className="hint">
          {hint}
        </p>
      )}
      {long ? <textarea {...props} rows={6} /> : <input {...props} type={type} autoComplete={autoComplete} />}
      <FieldError name={name} errors={errors} />
    </div>
  );
}

export function ChoiceField({
  name,
  legend,
  options,
  values,
  errors,
  multiple = false,
}: {
  name: string;
  legend: string;
  options: Record<string, string>;
  values: Values;
  errors: Errors;
  multiple?: boolean;
}) {
  const chosen = [values[name] ?? []].flat();
  return (
    <fieldset
      className="form-choices"
      aria-invalid={errors[name] ? true : undefined}
      aria-describedby={describedBy(errors[name] && `${name}-error`)}
    >
      <legend>{legend}</legend>
      {Object.entries(options).map(([value, text]) => (
        <div key={value} className="form-choice">
          <input
            type={multiple ? "checkbox" : "radio"}
            id={`${name}-${value}`}
            name={name}
            value={value}
            defaultChecked={chosen.includes(value)}
            required={!multiple}
          />
          <label htmlFor={`${name}-${value}`}>{text}</label>
        </div>
      ))}
      <FieldError name={name} errors={errors} />
    </fieldset>
  );
}

/**
 * One consent: a box of its own, never pre-ticked, with the notice's wording beside it. The
 * notice's id goes with the form, so the version the person read is the one recorded.
 */
export function ConsentField({
  purpose,
  notice,
  required,
  values,
  errors,
}: {
  purpose: ConsentPurpose;
  notice: Pick<Notice, "id" | "wording">;
  required: boolean;
  values: Values;
  errors: Errors;
}) {
  const id = `consent-${purpose}`;
  return (
    <div className="form-consent">
      <input type="hidden" name={`notice-${purpose}`} value={notice.id} />
      <div className="form-choice">
        <input
          type="checkbox"
          id={id}
          name="consent"
          value={purpose}
          defaultChecked={[values.consent ?? []].flat().includes(purpose)}
          required={required}
          aria-invalid={errors[id] ? true : undefined}
          aria-describedby={describedBy(`${id}-notice`, errors[id] && `${id}-error`)}
        />
        <label htmlFor={id}>
          {CONSENT_PROMPTS[purpose]}
          {!required && <span className="optional"> (optional)</span>}
        </label>
      </div>
      <p id={`${id}-notice`} className="notice-wording">
        {notice.wording}
      </p>
      <FieldError name={id} errors={errors} />
    </div>
  );
}

/** One box to tick, never pre-ticked unless the person ticked it before a refused send. */
export function CheckField({
  name,
  label,
  hint,
  values,
  errors,
}: {
  name: string;
  label: string;
  hint?: string;
  values: Values;
  errors: Errors;
}) {
  return (
    <div className="form-consent">
      <div className="form-choice">
        <input
          type="checkbox"
          id={name}
          name={name}
          value="yes"
          defaultChecked={values[name] === "yes"}
          required
          aria-invalid={errors[name] ? true : undefined}
          aria-describedby={describedBy(hint && `${name}-hint`, errors[name] && `${name}-error`)}
        />
        <label htmlFor={name}>{label}</label>
      </div>
      {hint && (
        <p id={`${name}-hint`} className="hint">
          {hint}
        </p>
      )}
      <FieldError name={name} errors={errors} />
    </div>
  );
}

/** Turnstile's check that a person is sending the form. */
export function TurnstileField({ siteKey }: { siteKey: string }) {
  return (
    <div className="form-field">
      <script src={TURNSTILE_SCRIPT} async defer />
      <div className="cf-turnstile" data-sitekey={siteKey} data-theme="light" />
      <noscript>
        <p className="hint">
          This form needs JavaScript turned on for a moment, for the check that stops automated spam.
        </p>
      </noscript>
    </div>
  );
}

/** What stopped the whole form, at its top, read out when the page loads. */
export function FormAlert({ errors }: { errors: Errors }) {
  if (!Object.keys(errors).length) return null;
  return (
    <div role="alert" className="form-alert">
      <p>{errors.form ?? "Nothing was sent. Check the answers marked below."}</p>
    </div>
  );
}
