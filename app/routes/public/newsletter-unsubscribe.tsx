import { data, Form, Link } from "react-router";
import { type Errors, FormAlert, TextField, TurnstileField, type Values } from "~/components/public/form-fields";
import { cloudflareContext } from "~/lib/cloudflare";
import { unsubscribeAddress } from "~/lib/consent.server";
import { getDb } from "~/lib/db.server";
import { guardForm } from "~/lib/form-guard.server";
import { emailProblem, formValues, normaliseEmail, SUBMISSION_LIMITS } from "~/lib/submission-fields";
import type { Route } from "./+types/newsletter-unsubscribe";

/**
 * Unsubscribing (PUB-06): takes the address off the newsletter tool's list and withdraws its
 * newsletter Consent Records. It says the same whether or not the address was on the list.
 */
export const handle = { hydrate: false, turnstile: true };
export const headers = () => ({ "Cache-Control": "no-store" });

export function meta() {
  return [{ title: "Unsubscribe from the newsletter · NAISEMA" }, { name: "robots", content: "noindex" }];
}

export function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  return { siteKey: env.TURNSTILE_SITE_KEY };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const form = await request.formData();
  const values = formValues(form);
  const guarded = await guardForm(env, request, form, "unsubscribe");
  if (!guarded.ok)
    return data({ done: false as const, errors: { form: guarded.error }, values }, { status: guarded.status });
  const email = String(form.get("email") ?? "").trim();
  const problem = emailProblem(email);
  if (problem) return data({ done: false as const, errors: { email: problem } as Errors, values }, { status: 400 });
  await unsubscribeAddress(env, getDb(env.DB), email, "unsubscribe", null);
  return { done: true as const, email: normaliseEmail(email) };
}

export default function Unsubscribe({ loaderData, actionData }: Route.ComponentProps) {
  if (actionData?.done) {
    return (
      <main id="main">
        <article className="letter letter-narrow">
          <h1>You're unsubscribed</h1>
          <p role="status">
            {actionData.email} won't be sent the NAISEMA newsletter. You can sign up again at any time.
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
      <article className="letter letter-narrow">
        <h1>Unsubscribe from the newsletter</h1>
        <p className="standfirst">Every newsletter also has its own unsubscribe link at the bottom.</p>
        <Form method="post" className="public-form" noValidate>
          <FormAlert errors={errors} />
          <TextField
            name="email"
            label="The email address the newsletter goes to"
            type="email"
            values={values}
            errors={errors}
            autoComplete="email"
            maxLength={SUBMISSION_LIMITS.email}
          />
          <TurnstileField siteKey={loaderData.siteKey} />
          <button type="submit">Unsubscribe</button>
        </Form>
      </article>
    </main>
  );
}
