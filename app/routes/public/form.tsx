import { data, Form, Link } from "react-router";
import {
  ChoiceField,
  ConsentField,
  type Errors,
  FormAlert,
  TextField,
  TurnstileField,
  type Values,
} from "~/components/public/form-fields";
import { cloudflareContext } from "~/lib/cloudflare";
import { currentNotices } from "~/lib/consent.server";
import { getDb } from "~/lib/db.server";
import { guardForm } from "~/lib/form-guard.server";
import {
  CONSULTATION_WAYS,
  EDUCATOR_CATEGORIES,
  FORM_CONSENTS,
  formValues,
  readSubmission,
  SUBMISSION_LIMITS,
  SUBMISSION_TYPES,
  type SubmissionType,
  submissionTypeAt,
} from "~/lib/submission-fields";
import { alreadyReceived, newFormKey, type Received, receiveSubmission } from "~/lib/submissions.server";
import type { Route } from "./+types/form";

/** A public form (PUB-05): never cached, no client JavaScript but Turnstile's own. */
export const handle = { hydrate: false, turnstile: true };
export const headers = () => ({ "Cache-Control": "no-store" });

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.title ?? "Get in touch"} · NAISEMA` }];
}

function formType(path: string | undefined) {
  const type = path ? submissionTypeAt(path) : null;
  if (!type) throw new Response("Not found", { status: 404 });
  return type;
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const type = formType(params.form);
  const notices = await currentNotices(getDb(env.DB));
  const { required, optional } = FORM_CONSENTS[type];
  return {
    type,
    title: SUBMISSION_TYPES[type].title,
    intro: SUBMISSION_TYPES[type].intro,
    formKey: newFormKey(),
    siteKey: env.TURNSTILE_SITE_KEY,
    consents: [
      ...required.map((purpose) => ({ purpose, required: true, notice: notices[purpose] })),
      ...optional.map((purpose) => ({ purpose, required: false, notice: notices[purpose] })),
    ],
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const type = formType(params.form);
  const form = await request.formData();
  const db = getDb(env.DB);
  // A form sent again (a double click, a refresh) is answered from what the first send stored,
  // before Turnstile, which never accepts the same token twice.
  const earlier = await alreadyReceived(db, String(form.get("formKey") ?? ""));
  if (earlier) return sentResult(earlier);
  const guarded = await guardForm(env, request, form, type);
  const refuse = (status: number, errors: Errors, values: Values) =>
    data({ sent: false as const, errors, values }, { status });
  if (!guarded.ok) return refuse(guarded.status, { form: guarded.error }, formValues(form));
  const read = readSubmission(form, type);
  if (!read.ok) return refuse(400, read.errors, read.values);
  const received = await receiveSubmission(
    env,
    db,
    read.submission,
    String(form.get("formKey") ?? ""),
    new URL(request.url).origin,
  );
  if (!received.ok) return refuse(400, { form: received.error }, formValues(form));
  return sentResult(received);
}

const sentResult = (received: Received) => ({
  sent: true as const,
  email: received.email,
  confirmed: received.confirmed,
  newsletter: received.newsletter,
});

export default function PublicForm({ loaderData, actionData }: Route.ComponentProps) {
  const { type, title, intro, formKey, siteKey, consents } = loaderData;
  if (actionData?.sent) {
    return (
      <main id="main">
        <article className="letter letter-narrow">
          <h1>Thank you, it's been sent</h1>
          <p role="status">
            We've received your {SUBMISSION_TYPES[type].name.toLowerCase()}, and someone on our team will read it.
          </p>
          <p>
            {actionData.confirmed
              ? `We've emailed a copy to ${actionData.email}, with links to withdraw your agreement if you change your mind.`
              : "We couldn't email you a copy just now, but what you sent is safely stored."}
          </p>
          {actionData.newsletter === false && (
            <p>
              We couldn't reach our newsletter service, so you aren't signed up for the newsletter.{" "}
              <Link to="/newsletter">Try again on the newsletter page</Link>.
            </p>
          )}
          <p>
            <Link to="/">Back to NAISEMA</Link>
          </p>
        </article>
      </main>
    );
  }
  const errors: Errors = actionData?.errors ?? {};
  const values: Values = actionData?.values ?? {};
  return (
    <main id="main">
      <article className="letter letter-narrow">
        <h1>{title}</h1>
        <p className="standfirst">{intro}</p>
        <Form method="post" className="public-form" noValidate>
          <FormAlert errors={errors} />
          <input type="hidden" name="formKey" value={formKey} />
          <TextField
            name="name"
            label="Your name"
            values={values}
            errors={errors}
            autoComplete="name"
            maxLength={SUBMISSION_LIMITS.name}
          />
          <TextField
            name="email"
            label="Your email address"
            type="email"
            values={values}
            errors={errors}
            autoComplete="email"
            hint="We use it only to reply to you."
            maxLength={SUBMISSION_LIMITS.email}
          />
          <TypeFields type={type} values={values} errors={errors} />
          <fieldset className="form-consents">
            <legend>Your agreement</legend>
            {consents.map((consent) => (
              <ConsentField
                key={consent.purpose}
                purpose={consent.purpose}
                notice={consent.notice}
                required={consent.required}
                values={values}
                errors={errors}
              />
            ))}
          </fieldset>
          <TurnstileField siteKey={siteKey} />
          <button type="submit">Send</button>
        </Form>
      </article>
    </main>
  );
}

function TypeFields({ type, values, errors }: { type: SubmissionType; values: Values; errors: Errors }) {
  const long = { values, errors, long: true, maxLength: SUBMISSION_LIMITS.text };
  switch (type) {
    case "enquiry":
      return <TextField name="message" label="Your message" {...long} />;
    case "contribution":
      return (
        <TextField
          name="description"
          label="What you'd like to share"
          hint="What it is (a story, a recording, a photograph, a song), who made it, and what it's about. Please don't attach anything yet."
          {...long}
        />
      );
    case "educator_interest":
      return (
        <>
          <ChoiceField
            name="category"
            legend="What best describes you?"
            options={EDUCATOR_CATEGORIES}
            values={values}
            errors={errors}
          />
          <TextField
            name="languages"
            label="Languages and varieties you would teach"
            hint="One on each line, like Standard Fijian, or the variety of your village or island."
            {...long}
          />
          <TextField name="experience" label="Your teaching so far" {...long} />
          <TextField name="scope" label="What you'd like to teach, and to whom" {...long} />
        </>
      );
    case "consultation_interest":
      return (
        <>
          <ChoiceField
            name="ways"
            legend="How would you like to take part?"
            options={CONSULTATION_WAYS}
            values={values}
            errors={errors}
            multiple
          />
          <TextField
            name="languages"
            label="Languages and varieties you speak"
            hint="One on each line."
            optional
            {...long}
          />
          <TextField
            name="connection"
            label="Your connection to Fiji"
            hint="For example: grew up in Labasa, now in Auckland."
            values={values}
            errors={errors}
            optional
            maxLength={SUBMISSION_LIMITS.short}
          />
          <TextField name="topics" label="What you'd like to be asked about" optional {...long} />
        </>
      );
  }
}
