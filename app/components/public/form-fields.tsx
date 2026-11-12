import { CircleAlert, Lock } from "lucide-react";
import { NOTICE } from "~/lib/forms";
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
      <CircleAlert size={18} strokeWidth={2} aria-hidden="true" focusable="false" className="icon" />
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
 * The privacy notice, with a box of its own that is never pre-ticked. Its version goes with the
 * form, so the wording the person read is the one recorded on what they sent.
 */
export function NoticeField({ values, errors }: { values: Values; errors: Errors }) {
  return (
    <div className="form-consent">
      <p id="notice-wording" className="notice-wording">
        <Lock size={20} strokeWidth={1.75} aria-hidden="true" focusable="false" className="icon" />
        <span>{NOTICE.wording}</span>
      </p>
      <div className="form-choice">
        <input
          type="checkbox"
          id="notice"
          name="notice"
          value={NOTICE.version}
          defaultChecked={values.notice === NOTICE.version}
          required
          aria-invalid={errors.notice ? true : undefined}
          aria-describedby={describedBy("notice-wording", errors.notice && "notice-error")}
        />
        <label htmlFor="notice">I've read how NAISEMA keeps what I send</label>
      </div>
      <FieldError name="notice" errors={errors} />
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
      <CircleAlert size={22} strokeWidth={1.75} aria-hidden="true" focusable="false" className="icon" />
      <p>{errors.form ?? "Nothing was sent. Check the answers marked below."}</p>
    </div>
  );
}
