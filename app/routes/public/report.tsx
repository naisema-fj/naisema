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
import { CASE_LIMITS, REPORT_REASONS, readReport } from "~/lib/case-rules";
import { alreadyReceived, receiveCase } from "~/lib/cases.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { currentNotices } from "~/lib/consent.server";
import { type Database, getDb } from "~/lib/db.server";
import { guardForm } from "~/lib/form-guard.server";
import { itemPath } from "~/lib/public.server";
import { formValues } from "~/lib/submission-fields";
import { newFormKey } from "~/lib/submissions.server";
import { publicItem } from "~/lib/visibility.server";
import type { Route } from "./+types/report";

/**
 * Reporting a problem (SAFE-01, SAFE-03). Every content page links here with its item's id, so the
 * Case knows what it is about. A report can be anonymous; only the case team ever sees who sent it.
 */
export const handle = { hydrate: false, turnstile: true };
export const headers = () => ({ "Cache-Control": "no-store" });

export function meta() {
  return [{ title: "Report a problem · NAISEMA" }, { name: "robots", content: "noindex" }];
}

/** The public item a report is about, by the id its page's link carries. */
async function reportedItem(db: Database, id: string | null) {
  if (!id) return null;
  const published = await publicItem(db, id);
  return published ? { id: published.item.id, title: published.snapshot.title, path: itemPath(published.item) } : null;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const db = getDb(env.DB);
  const notices = await currentNotices(db);
  return {
    item: await reportedItem(db, new URL(request.url).searchParams.get("item")),
    notice: notices.reply,
    formKey: newFormKey(),
    siteKey: env.TURNSTILE_SITE_KEY,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const form = await request.formData();
  const db = getDb(env.DB);
  const formKey = String(form.get("formKey") ?? "");
  // A form sent again is answered from what the first send stored, before Turnstile (as for Submissions).
  const earlier = await alreadyReceived(db, formKey);
  if (earlier?.ok) return { sent: true as const, reference: earlier.reference };
  const refuse = (status: number, errors: Errors, values: Values) =>
    data({ sent: false as const, errors, values }, { status });
  const guarded = await guardForm(env, request, form, "report");
  if (!guarded.ok) return refuse(guarded.status, { form: guarded.error }, formValues(form));
  const read = readReport(form);
  if (!read.ok) return refuse(400, read.errors, read.values);
  const opened = await receiveCase(env, db, read.report, formKey);
  if (!opened.ok) return refuse(400, { form: opened.error }, formValues(form));
  return { sent: true as const, reference: opened.reference };
}

export default function Report({ loaderData, actionData }: Route.ComponentProps) {
  const { item, notice, formKey, siteKey } = loaderData;
  if (actionData?.sent) {
    return (
      <main id="main">
        <article className="pane pane-narrow">
          <h1>Thank you for telling us</h1>
          <p role="status">
            Your report has been received, reference {actionData.reference}. Only the people who handle reports can read
            it, and they will look at it.
          </p>
          <p>
            If you left your email address, we'll tell you what we decided and how to ask for it to be looked at again.
          </p>
          <p>{item ? <Link to={item.path}>Back to {item.title}</Link> : <Link to="/">Back to NAISEMA</Link>}</p>
        </article>
      </main>
    );
  }
  const errors: Errors = actionData?.errors ?? {};
  const values: Values = actionData?.values ?? {};
  return (
    <main id="main">
      <article className="pane pane-narrow">
        <h1>Report a problem</h1>
        <p className="standfirst">
          {item ? (
            <>
              You're reporting <Link to={item.path}>{item.title}</Link>.{" "}
            </>
          ) : null}
          Tell us if something on NAISEMA could cause harm, is wrong, or uses someone's work without permission. Only
          the people who handle reports will see what you send.{" "}
          <Link to="/community-standards">Our community standards</Link>
        </p>
        <Form method="post" className="public-form" noValidate>
          <FormAlert errors={errors} />
          <input type="hidden" name="formKey" value={formKey} />
          {item && <input type="hidden" name="item" value={item.id} />}
          <ChoiceField name="reason" legend="What is wrong?" options={REPORT_REASONS} values={values} errors={errors} />
          <TextField
            name="details"
            label="Tell us more"
            hint="What is wrong, and where. If it's about you or your work, say so."
            values={values}
            errors={errors}
            long
            maxLength={CASE_LIMITS.text}
          />
          <fieldset className="form-consents">
            <legend>Hear back from us (optional)</legend>
            <p className="hint">
              Leave these empty to report without telling us who you are. With your email address, we can tell you what
              we decided, and you can appeal it.
            </p>
            <TextField
              name="name"
              label="Your name"
              values={values}
              errors={errors}
              autoComplete="name"
              optional
              maxLength={CASE_LIMITS.name}
            />
            <TextField
              name="email"
              label="Your email address"
              type="email"
              values={values}
              errors={errors}
              autoComplete="email"
              optional
              maxLength={CASE_LIMITS.email}
            />
            <ConsentField purpose="reply" notice={notice} required={false} values={values} errors={errors} />
          </fieldset>
          <TurnstileField siteKey={siteKey} />
          <button type="submit">Send the report</button>
        </Form>
      </article>
    </main>
  );
}
