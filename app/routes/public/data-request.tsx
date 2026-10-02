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
import { CASE_LIMITS, DATA_REQUESTS, readDataRequest } from "~/lib/case-rules";
import { alreadyOpened, openCase } from "~/lib/cases.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { currentNotices } from "~/lib/consent.server";
import { getDb } from "~/lib/db.server";
import { guardForm } from "~/lib/form-guard.server";
import { formValues } from "~/lib/submission-fields";
import { newFormKey } from "~/lib/submissions.server";
import type { Route } from "./+types/data-request";

/** The privacy route (DATA-03): asking to see, correct or delete what Na iSema holds. It opens a Case. */
export const handle = { hydrate: false, turnstile: true };
export const headers = () => ({ "Cache-Control": "no-store" });

export function meta() {
  return [{ title: "Your information · Na iSema" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const notices = await currentNotices(getDb(env.DB));
  return { notice: notices.reply, formKey: newFormKey(), siteKey: env.TURNSTILE_SITE_KEY };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const form = await request.formData();
  const db = getDb(env.DB);
  const formKey = String(form.get("formKey") ?? "");
  const earlier = await alreadyOpened(db, formKey);
  if (earlier?.ok) return { sent: true as const, reference: earlier.reference };
  const refuse = (status: number, errors: Errors, values: Values) =>
    data({ sent: false as const, errors, values }, { status });
  const guarded = await guardForm(env, request, form, "data_request");
  if (!guarded.ok) return refuse(guarded.status, { form: guarded.error }, formValues(form));
  const read = readDataRequest(form);
  if (!read.ok) return refuse(400, read.errors, read.values);
  const opened = await openCase(env, db, read.request, formKey, new URL(request.url).origin);
  if (!opened.ok) return refuse(400, { form: opened.error }, formValues(form));
  return { sent: true as const, reference: opened.reference };
}

export default function DataRequest({ loaderData, actionData }: Route.ComponentProps) {
  const { notice, formKey, siteKey } = loaderData;
  if (actionData?.sent) {
    return (
      <main id="main">
        <article className="letter letter-narrow">
          <h1>We have your request</h1>
          <p role="status">
            Your request has been received, reference {actionData.reference}. Our privacy contact will handle it and
            email you. They may ask you to confirm it's you before sending or deleting anything.
          </p>
          <p>
            <Link to="/">Back to Na iSema</Link>
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
        <h1>Your information</h1>
        <p className="standfirst">
          Ask for a copy of what Na iSema holds about you, or for it to be corrected or deleted. Our privacy contact
          handles every request. <Link to="/privacy">How we handle your information</Link>
        </p>
        <Form method="post" className="public-form" noValidate>
          <FormAlert errors={errors} />
          <input type="hidden" name="formKey" value={formKey} />
          <TextField
            name="name"
            label="Your name"
            values={values}
            errors={errors}
            autoComplete="name"
            maxLength={CASE_LIMITS.name}
          />
          <TextField
            name="email"
            label="Your email address"
            type="email"
            hint="The address you used with Na iSema, so we can find what we hold."
            values={values}
            errors={errors}
            autoComplete="email"
            maxLength={254}
          />
          <ChoiceField
            name="request"
            legend="What would you like us to do?"
            options={DATA_REQUESTS}
            values={values}
            errors={errors}
          />
          <TextField
            name="details"
            label="Anything else we should know"
            hint="Needed if you'd like something corrected, or something else."
            values={values}
            errors={errors}
            long
            optional
            maxLength={CASE_LIMITS.text}
          />
          <fieldset className="form-consents">
            <legend>Your agreement</legend>
            <ConsentField purpose="reply" notice={notice} required values={values} errors={errors} />
          </fieldset>
          <TurnstileField siteKey={siteKey} />
          <button type="submit">Send the request</button>
        </Form>
        <p>
          To stop the newsletter, <Link to="/newsletter/unsubscribe">unsubscribe here</Link>.
        </p>
      </article>
    </main>
  );
}
