import { data, Form } from "react-router";
import { type Errors, FormAlert, TextField, type Values } from "~/components/public/form-fields";
import { APPEAL_DAYS, appealOpen, CASE_KINDS, CASE_LIMITS, outcomeText, readAppeal } from "~/lib/case-rules";
import { appealCase, caseForAppealLink, caseReference } from "~/lib/cases.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import type { Route } from "./+types/case-appeal";

/**
 * Appealing a decision from the link in the decision email (SAFE-03). The link is the person's
 * own; someone other than whoever decided looks at the appeal.
 */
export const handle = { hydrate: false };
export const headers = () => ({ "Cache-Control": "no-store" });

export function meta() {
  return [{ title: "Appeal a decision · NAISEMA" }, { name: "robots", content: "noindex" }];
}

async function caseOrNotFound(env: Env, token: string) {
  const found = await caseForAppealLink(env, getDb(env.DB), token);
  if (!found?.outcome) throw new Response("Not found", { status: 404 });
  return found;
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const found = await caseOrNotFound(env, params.token);
  return {
    kind: CASE_KINDS[found.kind].toLowerCase(),
    reference: caseReference(found.id),
    outcome: found.outcome ? outcomeText(found.kind, found.outcome) : "",
    open: appealOpen(found, new Date()),
    appealed: Boolean(found.appealedAt),
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const found = await caseOrNotFound(env, params.token);
  const read = readAppeal(await request.formData());
  if (!read.ok) return data({ appealed: false as const, errors: read.errors, values: read.values }, { status: 400 });
  const appealed = await appealCase(env, getDb(env.DB), found, read.reasons, null);
  if (!appealed.ok)
    return data({ appealed: false as const, errors: { form: appealed.error }, values: {} }, { status: 409 });
  return { appealed: true as const };
}

export default function CaseAppeal({ loaderData, actionData }: Route.ComponentProps) {
  const { kind, reference, outcome, open, appealed } = loaderData;
  const errors: Errors = actionData && !actionData.appealed ? actionData.errors : {};
  const values: Values = actionData && !actionData.appealed ? actionData.values : {};
  return (
    <main id="main">
      <article className="pane pane-narrow">
        <h1>Appeal a decision</h1>
        <p>
          About your {kind} {reference}: {outcome}.
        </p>
        {actionData?.appealed || appealed ? (
          <p role="status">
            Your appeal has been received. Someone who didn't make the first decision will look at it again and email
            you.
          </p>
        ) : open ? (
          <Form method="post" className="public-form" noValidate>
            <FormAlert errors={errors} />
            <TextField
              name="reasons"
              label="Why should it be looked at again?"
              values={values}
              errors={errors}
              long
              maxLength={CASE_LIMITS.text}
            />
            <button type="submit">Send the appeal</button>
          </Form>
        ) : (
          <p>This decision can no longer be appealed: appeals are taken within {APPEAL_DAYS} days of a decision.</p>
        )}
      </article>
    </main>
  );
}
