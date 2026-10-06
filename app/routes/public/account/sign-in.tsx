import { data, Form, Link, redirect } from "react-router";
import {
  CheckField,
  type Errors,
  FormAlert,
  TextField,
  TurnstileField,
  type Values,
} from "~/components/public/form-fields";
import { cloudflareContext } from "~/lib/cloudflare";
import { guardForm } from "~/lib/form-guard.server";
import { LEARNER_PATHS } from "~/lib/learner-progress";
import { fromThisSite, getLearner, requestLearnerSignInLink } from "~/lib/learners.server";
import { PRIVATE_NO_STORE } from "~/lib/public-cache.server";
import type { RouteHandle } from "~/lib/route-handle";
import { emailProblem, formValues, normaliseEmail, SUBMISSION_LIMITS } from "~/lib/submission-fields";
import type { Route } from "./+types/sign-in";

/** Signing up for, or in to, a Learner Account (#33, MEM-01): one form, by emailed link. */
export const handle: RouteHandle = { hydrate: false, turnstile: true, noindex: true };
export const headers = () => ({ "Cache-Control": PRIVATE_NO_STORE });

export function meta() {
  return [{ title: "Sign in to save your learning · NAISEMA" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  if (await getLearner(env, request)) throw redirect(LEARNER_PATHS.home);
  const asked = new URL(request.url).searchParams;
  return { siteKey: env.TURNSTILE_SITE_KEY, expired: asked.has("link"), deleted: asked.has("deleted") };
}

/**
 * Sends a sign-in link to anyone who declares they are 18 or older. The reply is the same whatever
 * happens to the address (new, a learner already, staff or throttled), so it reveals nothing.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  if (!fromThisSite(request)) throw new Response("Cross-site request refused", { status: 403 });
  const form = await request.formData();
  const values = formValues(form);
  const guarded = await guardForm(env, request, form, "learner-sign-in");
  if (!guarded.ok)
    return data({ sent: false as const, errors: { form: guarded.error }, values }, { status: guarded.status });
  const email = String(form.get("email") ?? "").trim();
  const errors: Errors = {};
  const problem = emailProblem(email);
  if (problem) errors.email = problem;
  if (form.get("adult") !== "yes") {
    errors.adult =
      "Learning accounts are for people aged 18 or older. You can still use everything on NAISEMA without one.";
  }
  if (Object.keys(errors).length) return data({ sent: false as const, errors, values }, { status: 400 });
  await requestLearnerSignInLink(env, request, normaliseEmail(email));
  return { sent: true as const, email: normaliseEmail(email) };
}

export default function LearnerSignIn({ loaderData, actionData }: Route.ComponentProps) {
  if (actionData?.sent) {
    return (
      <main id="main">
        <article className="letter letter-narrow">
          <h1>Check your email</h1>
          <p role="status">
            We've emailed a sign-in link to {actionData.email}. It works once, for 30 minutes. If it doesn't arrive,
            check your spam folder, or ask for another in a few minutes.
          </p>
          <p>
            <Link reloadDocument to="/">
              Back to NAISEMA
            </Link>
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
        <h1>Save your learning</h1>
        <p className="standfirst">
          Everything on NAISEMA is open without an account. An optional learning account keeps the videos and words you
          save, and where you are in each video, on every device you use.
        </p>
        {loaderData.deleted && (
          <p role="status">
            Your learning account and everything saved in it are deleted. Copies in our backups are deleted within 35
            days. You can still use everything on NAISEMA without an account.
          </p>
        )}
        {loaderData.expired && (
          <p role="alert" className="form-alert">
            That sign-in link has expired or was already used. Ask for a new one below.
          </p>
        )}
        <ul>
          <li>It needs only your email address: no name, no profile, and nothing about who you are.</li>
          <li>
            Nothing you save is public. You can download it, clear your history or delete the account at any time.
          </li>
          <li>An account nobody uses for two years is deleted, after an email warning.</li>
        </ul>
        <Form method="post" className="public-form" noValidate>
          <FormAlert errors={errors} />
          <TextField
            name="email"
            label="Your email address"
            type="email"
            hint="We'll email you a link to sign in. The first time, it makes your account."
            values={values}
            errors={errors}
            autoComplete="email"
            maxLength={SUBMISSION_LIMITS.email}
          />
          <CheckField name="adult" label="I am 18 or older" values={values} errors={errors} />
          <TurnstileField siteKey={loaderData.siteKey} />
          <button type="submit">Email me a sign-in link</button>
        </Form>
        <p>Under 18? You're welcome to use everything on NAISEMA without an account, or with a parent or carer.</p>
      </article>
    </main>
  );
}
