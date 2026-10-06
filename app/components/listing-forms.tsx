import { Form } from "react-router";
import {
  ACCESS_MODES,
  AGE_SUITABILITY,
  COST_KINDS,
  type Cost,
  FORMATS,
  HANDLED_BY,
  LEVELS,
  LISTING_LIMITS,
  type OfferingAccess,
  ORGANISATION_TYPES,
} from "~/lib/listing-fields";

type Errors = Record<string, string>;
/** What a refused form gives back, or the saved listing, as the form's starting values. */
type Values = Record<string, string | boolean | null | undefined>;

function fields(errors: Errors) {
  const describedBy = (field: string) => (errors[field] ? `${field}-error` : undefined);
  const fieldError = (field: string) =>
    errors[field] && (
      <p id={`${field}-error`} className="field-error">
        {errors[field]}
      </p>
    );
  return { describedBy, fieldError };
}

function Choice({
  name,
  label,
  options,
  value,
  errors,
}: {
  name: string;
  label: string;
  options: Record<string, string>;
  value: string;
  errors: Errors;
}) {
  const { describedBy, fieldError } = fields(errors);
  return (
    <>
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={value} aria-describedby={describedBy(name)}>
        {Object.entries(options).map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
      {fieldError(name)}
    </>
  );
}

function Text({
  name,
  label,
  value,
  errors,
  long = false,
  type = "text",
  hint,
}: {
  name: string;
  label: string;
  value: string;
  errors: Errors;
  long?: boolean;
  type?: string;
  hint?: string;
}) {
  const { fieldError } = fields(errors);
  const described = [hint ? `${name}-hint` : null, errors[name] ? `${name}-error` : null].filter(Boolean).join(" ");
  const props = { id: name, name, defaultValue: value, "aria-describedby": described || undefined };
  return (
    <>
      <label htmlFor={name}>{label}</label>
      {hint && (
        <p id={`${name}-hint`} className="hint">
          {hint}
        </p>
      )}
      {long ? (
        <textarea {...props} rows={4} maxLength={LISTING_LIMITS.text} />
      ) : (
        <input {...props} type={type} maxLength={type === "url" ? LISTING_LIMITS.url : LISTING_LIMITS.short} />
      )}
      {fieldError(name)}
    </>
  );
}

/** Listed, sponsored, featured: how a Provider or Offering is shown (PART-03, PUB-04). */
function ListingFlagsFields({ values, errors }: { values: Values; errors: Errors }) {
  return (
    <fieldset>
      <legend>On the public site</legend>
      <div className="choice">
        <input type="checkbox" id="listed" name="listed" defaultChecked={Boolean(values.listed)} />
        <label htmlFor="listed">Listed on the public site</label>
      </div>
      <Text
        name="sponsoredBy"
        label="Sponsored by (leave empty if nobody sponsors this listing)"
        value={String(values.sponsoredBy ?? "")}
        errors={errors}
        hint="A sponsor is always disclosed next to the listing."
      />
      <div className="choice">
        <input
          type="checkbox"
          id="featured"
          name="featured"
          // A refused form (it has an intent) shows what was ticked; a saved listing, whether it is featured.
          defaultChecked={"intent" in values ? values.featured === "on" : Boolean(values.featureRationale)}
        />
        <label htmlFor="featured">Featured by NAISEMA editors</label>
      </div>
      <Text
        name="featureRationale"
        label="Why it is featured"
        value={String(values.featureRationale ?? "")}
        errors={errors}
        hint="Needed to feature it, and shown to visitors with it."
      />
    </fieldset>
  );
}

const NOT_KNOWN_HINT = "Leave empty if you don't know; the site says it isn't known.";

export function ProviderForm({
  values,
  errors = {},
  submitLabel,
}: {
  values: Values;
  errors?: Errors;
  submitLabel: string;
}) {
  const text = (name: string) => String(values[name] ?? "");
  return (
    <Form method="post" className="article-form">
      <input type="hidden" name="intent" value="provider" />
      {Object.keys(errors).length > 0 && <p role="alert">Nothing was saved. Fix the fields marked below.</p>}
      <Text name="name" label="Name" value={text("name")} errors={errors} />
      <Text
        name="description"
        label="Description"
        value={text("description")}
        errors={errors}
        long
        hint={NOT_KNOWN_HINT}
      />
      <Choice
        name="organisationType"
        label="Kind of organisation"
        options={ORGANISATION_TYPES}
        value={text("organisationType") || "unknown"}
        errors={errors}
      />
      <Text
        name="location"
        label="Location (town, island or country)"
        value={text("location")}
        errors={errors}
        hint={NOT_KNOWN_HINT}
      />
      <Text name="website" label="Website" type="url" value={text("website")} errors={errors} hint={NOT_KNOWN_HINT} />
      <Text
        name="contactRoute"
        label="How to contact them"
        value={text("contactRoute")}
        errors={errors}
        hint="In words, as they ask to be contacted: an email address, a phone number, a page."
      />
      <Text
        name="lastCheckedOn"
        label="Details last checked on"
        type="date"
        value={text("lastCheckedOn")}
        errors={errors}
      />
      <ListingFlagsFields values={values} errors={errors} />
      <button type="submit">{submitLabel}</button>
    </Form>
  );
}

/** A saved listing's plain fields, as form values. */
export function listingValues(row: Record<string, unknown>): Values {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value === null || typeof value !== "object"),
  ) as Values;
}

/** An Offering's form values from a saved Offering. */
export function offeringValues(row: { cost: Cost; access: OfferingAccess; [key: string]: unknown }): Values {
  const { cost, access, ...rest } = row;
  return {
    ...listingValues(rest),
    costKind: cost.kind,
    costAmount: cost.kind === "paid" ? cost.amount : "",
    costCurrency: cost.kind === "paid" ? cost.currency : "",
    accessMode: access.mode,
    accessUrl: "url" in access ? access.url : "",
    accessNote: "note" in access ? access.note : "",
    accessContentItemId: "contentItemId" in access ? access.contentItemId : "",
  };
}

export function OfferingForm({
  values,
  errors = {},
  items,
  submitLabel,
}: {
  values: Values;
  errors?: Errors;
  /** NAISEMA items an Offering under licence can be on. */
  items: { id: string; title: string }[];
  submitLabel: string;
}) {
  const text = (name: string) => String(values[name] ?? "");
  const { describedBy, fieldError } = fields(errors);
  return (
    <Form method="post" className="article-form">
      <input type="hidden" name="intent" value="offering" />
      {Object.keys(errors).length > 0 && <p role="alert">Nothing was saved. Fix the fields marked below.</p>}
      <Text name="title" label="Name" value={text("title")} errors={errors} />
      <Text name="summary" label="What it is" value={text("summary")} errors={errors} long hint={NOT_KNOWN_HINT} />
      <Text
        name="languageVariety"
        label="Language or Language Variety taught"
        value={text("languageVariety")}
        errors={errors}
        hint={NOT_KNOWN_HINT}
      />
      <Choice name="level" label="Level" options={LEVELS} value={text("level") || "unknown"} errors={errors} />
      <Choice
        name="ageSuitability"
        label="Suitable for"
        options={AGE_SUITABILITY}
        value={text("ageSuitability") || "unknown"}
        errors={errors}
      />
      <Text
        name="accessibility"
        label="Accessibility"
        value={text("accessibility")}
        errors={errors}
        long
        hint={NOT_KNOWN_HINT}
      />
      <Choice name="format" label="Format" options={FORMATS} value={text("format") || "unknown"} errors={errors} />
      <fieldset>
        <legend>Cost</legend>
        <Choice
          name="costKind"
          label="Cost"
          options={COST_KINDS}
          value={text("costKind") || "unknown"}
          errors={errors}
        />
        <Text name="costAmount" label="Amount (if paid)" value={text("costAmount")} errors={errors} />
        <Text name="costCurrency" label="Currency (if paid), like AUD" value={text("costCurrency")} errors={errors} />
      </fieldset>
      <Text
        name="startsOn"
        label="Starts on (leave empty if ongoing or not known)"
        type="date"
        value={text("startsOn")}
        errors={errors}
      />
      <Text
        name="endsOn"
        label="Ends on (leave empty if ongoing or not known)"
        type="date"
        value={text("endsOn")}
        errors={errors}
      />
      <fieldset aria-describedby={errors.accessMode ? "access-hint accessMode-error" : "access-hint"}>
        <legend>How visitors get to it (exactly one)</legend>
        <p id="access-hint">Shown or hosted on NAISEMA only for a Partner.</p>
        {Object.entries(ACCESS_MODES).map(([mode, name]) => (
          <div key={mode} className="choice">
            <input
              type="radio"
              id={`accessMode-${mode}`}
              name="accessMode"
              value={mode}
              defaultChecked={text("accessMode") === mode}
            />
            <label htmlFor={`accessMode-${mode}`}>{name}</label>
          </div>
        ))}
        {fieldError("accessMode")}
        <Text
          name="accessUrl"
          label="Web address (on their website, or shown on NAISEMA)"
          type="url"
          value={text("accessUrl")}
          errors={errors}
        />
        <Text
          name="accessNote"
          label="How NAISEMA refers people (for a referral)"
          value={text("accessNote")}
          errors={errors}
        />
        <label htmlFor="accessContentItemId">The NAISEMA item it is on (under licence)</label>
        <select
          id="accessContentItemId"
          name="accessContentItemId"
          defaultValue={text("accessContentItemId")}
          aria-describedby={describedBy("accessContentItemId")}
        >
          <option value="">Choose an item</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        {fieldError("accessContentItemId")}
      </fieldset>
      <Choice
        name="enrolmentBy"
        label="Who handles enrolment"
        options={HANDLED_BY}
        value={text("enrolmentBy") || "unknown"}
        errors={errors}
      />
      <Choice
        name="supportBy"
        label="Who handles support"
        options={HANDLED_BY}
        value={text("supportBy") || "unknown"}
        errors={errors}
      />
      <ListingFlagsFields values={values} errors={errors} />
      <button type="submit">{submitLabel}</button>
    </Form>
  );
}
