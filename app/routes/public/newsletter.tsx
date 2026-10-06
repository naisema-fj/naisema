import { data, Form, Link } from "react-router";
import {
  ConsentField,
  type Errors,
  FormAlert,
  TextField,
  TurnstileField,
  type Values,
} from "~/components/public/form-fields";
import { cloudflareContext } from "~/lib/cloudflare";
import { currentNotices, joinNewsletter } from "~/lib/consent.server";
import { getDb } from "~/lib/db.server";
import { guardForm } from "~/lib/form-guard.server";
import { emailProblem, formValues, normaliseEmail, readConsents, SUBMISSION_LIMITS } from "~/lib/submission-fields";
import type { Route } from "./+types/newsletter";

/** Newsletter sign-up (PUB-06): the newsletter tool asks the person to confirm before anything is sent. */
export const handle = { hydrate: false, turnstile: true };
export const headers = () => ({ "Cache-Control": "no-store" });

export function meta() {
  return [{ title: "The newsletter · NAISEMA" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const notices = await currentNotices(getDb(env.DB));
  return { notice: notices.newsletter, siteKey: env.TURNSTILE_SITE_KEY };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const form = await request.formData();
  const values = formValues(form);
  const guarded = await guardForm(env, request, form, "newsletter");
  if (!guarded.ok)
    return data({ sent: false as const, errors: { form: guarded.error }, values }, { status: guarded.status });
  const email = String(form.get("email") ?? "").trim();
  const { consents, errors } = readConsents(form, "newsletter");
  const problem = emailProblem(email);
  if (problem) errors.email = problem;
  if (Object.keys(errors).length || !consents.length) {
    return data({ sent: false as const, errors: errors as Errors, values }, { status: 400 });
  }
  const joined = await joinNewsletter(env, getDb(env.DB), email, consents[0], "newsletter");
  if (joined !== "joined") {
    const error =
      joined === "bad-notice"
        ? "Reload the page and sign up again."
        : "We couldn't reach our newsletter service just now, so you aren't signed up. Please try again later.";
    return data(
      { sent: false as const, errors: { form: error } as Errors, values },
      { status: joined === "bad-notice" ? 400 : 503 },
    );
  }
  return { sent: true as const, email: normaliseEmail(email) };
}

export default function Newsletter({ loaderData, actionData }: Route.ComponentProps) {
  if (actionData?.sent) {
    return (
      <main id="main">
        <article className="pane pane-narrow">
          <h1>Check your email</h1>
          <p role="status">
            We've asked our newsletter service to email {actionData.email}. Open that email and confirm, and the
            newsletter will start. Nothing is sent until you do.
          </p>
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
      <article className="pane pane-narrow">
        <h1>The newsletter</h1>
        <p className="standfirst">
          News from NAISEMA: new stories and recordings, classes and consultations. You'll be asked to confirm before
          anything is sent.
        </p>
        <Form method="post" className="public-form" noValidate>
          <FormAlert errors={errors} />
          <TextField
            name="email"
            label="Your email address"
            type="email"
            values={values}
            errors={errors}
            autoComplete="email"
            maxLength={SUBMISSION_LIMITS.email}
          />
          <fieldset className="form-consents">
            <legend>Your agreement</legend>
            <ConsentField purpose="newsletter" notice={loaderData.notice} required values={values} errors={errors} />
          </fieldset>
          <TurnstileField siteKey={loaderData.siteKey} />
          <button type="submit">Sign up</button>
        </Form>
        <p>
          Already signed up? <Link to="/newsletter/unsubscribe">Unsubscribe</Link>
        </p>
      </article>
    </main>
  );
}
