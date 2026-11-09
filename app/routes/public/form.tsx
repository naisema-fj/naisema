import { data, Form, Link } from "react-router";
import { FormAlert, type Errors, NoticeField, TextField, TurnstileField, type Values } from "~/components/public/form-fields";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { guardForm } from "~/lib/form-guard.server";
import { FIELD_LIMITS, FORMS, type FormSpec, isFormKey, readForm } from "~/lib/forms";
import { PRIVATE_NO_STORE } from "~/lib/http";
import { receiveSubmission } from "~/lib/submissions.server";
import type { RouteHandle } from "~/lib/route-handle";
import type { Route } from "./+types/form";

export const handle: RouteHandle = { hydrate: false, turnstile: true };

export function headers() {
  return { "Cache-Control": PRIVATE_NO_STORE };
}

/** GET /forms/:form: one public form. Nothing is sent until it is stored (PUB-05, PUB-06). */
export function loader({ params, request, context }: Route.LoaderArgs) {
  if (!isFormKey(params.form)) throw new Response("Not found", { status: 404 });
  const about = new URL(request.url).searchParams.get("about")?.slice(0, 300) ?? "";
  return { key: params.form, siteKey: context.get(cloudflareContext).env.TURNSTILE_SITE_KEY, about };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  if (!isFormKey(params.form)) throw new Response("Not found", { status: 404 });
  const { env } = context.get(cloudflareContext);
  const form = await request.formData();
  const input = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
  const guard = await guardForm(env, request, form, params.form);
  if (!guard.ok) return data({ sent: false as const, errors: { form: guard.error }, values: input }, { status: guard.status });
  const spec: FormSpec = FORMS[params.form];
  const read = readForm(spec, input);
  if (!read.ok) return data({ sent: false as const, errors: read.errors, values: input }, { status: 400 });
  const adminOrigin = `https://${env.ADMIN_HOSTNAME}`;
  await receiveSubmission(env, getDb(env.DB), params.form, read.values, adminOrigin);
  return { sent: true as const };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData ? FORMS[loaderData.key].title : "Form"} · NAISEMA` }];
}

export default function PublicForm({ loaderData, actionData }: Route.ComponentProps) {
  const spec: FormSpec = FORMS[loaderData.key];
  if (actionData?.sent) {
    return (
      <main id="main">
        <article className="pane pane-narrow">
          <h1>Thank you, it's been sent</h1>
          <p role="status">{spec.done}</p>
          <p>
            <Link to="/">Back to NAISEMA</Link>
          </p>
        </article>
      </main>
    );
  }
  const errors: Errors = actionData?.errors ?? {};
  const values: Values = actionData?.values ?? (loaderData.about ? { address: loaderData.about } : {});
  return (
    <main id="main">
      <article className="pane pane-narrow">
        <h1>{spec.title}</h1>
        <p className="standfirst">{spec.intro}</p>
        <Form method="post" className="public-form" noValidate>
          <FormAlert errors={errors} />
          <TextField
            name="name"
            label="Your name"
            values={values}
            errors={errors}
            autoComplete="name"
            maxLength={FIELD_LIMITS.name}
            optional={!spec.needsEmail}
          />
          <TextField
            name="email"
            label="Your email address"
            type="email"
            values={values}
            errors={errors}
            autoComplete="email"
            hint="We use it only to reply to you."
            maxLength={FIELD_LIMITS.email}
            optional={!spec.needsEmail}
          />
          {spec.fields.map((field) => (
            <TextField
              key={field.name}
              name={field.name}
              label={field.label}
              hint={field.hint}
              long={field.long}
              optional={field.optional}
              values={values}
              errors={errors}
              maxLength={field.long ? FIELD_LIMITS.long : FIELD_LIMITS.short}
            />
          ))}
          <NoticeField values={values} errors={errors} />
          <TurnstileField siteKey={loaderData.siteKey} />
          <button type="submit">Send</button>
        </Form>
      </article>
    </main>
  );
}
