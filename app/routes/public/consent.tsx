import { Form, Link } from "react-router";
import { fijiDateText } from "~/lib/calendar";
import { cloudflareContext } from "~/lib/cloudflare";
import { consentForLink, withdrawConsent } from "~/lib/consent.server";
import { getDb } from "~/lib/db.server";
import { CONSENT_PURPOSES } from "~/lib/submission-fields";
import type { Route } from "./+types/consent";

/**
 * Withdrawing a consent from the link in its confirmation email (DATA-02). Opening the link only
 * shows the agreement; withdrawing takes a button, so a mail scanner following links can't do it.
 */
export const handle = { hydrate: false };
export const headers = () => ({ "Cache-Control": "no-store" });

export function meta() {
  return [{ title: "Your agreement · NAISEMA" }, { name: "robots", content: "noindex" }];
}

async function consentOrNotFound(env: Env, token: string) {
  const consent = await consentForLink(env, getDb(env.DB), token);
  if (!consent) throw new Response("Not found", { status: 404 });
  return consent;
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { record, notice } = await consentOrNotFound(env, params.token);
  return {
    purpose: CONSENT_PURPOSES[record.purpose],
    givenOn: fijiDateText(record.givenAt),
    withdrawnOn: record.withdrawnAt ? fijiDateText(record.withdrawnAt) : null,
    wording: notice.wording,
    version: notice.version,
  };
}

export async function action({ params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { record } = await consentOrNotFound(env, params.token);
  await withdrawConsent(env, getDb(env.DB), record.id, "link", null);
  return { withdrawn: true };
}

export default function Consent({ loaderData, actionData }: Route.ComponentProps) {
  const { purpose, givenOn, withdrawnOn, wording, version } = loaderData;
  return (
    <main id="main">
      <article className="letter letter-narrow">
        <h1>Your agreement</h1>
        <p>
          On {givenOn} you agreed to: <strong>{purpose}</strong>.
        </p>
        <h2>{`What you were told (notice version ${version})`}</h2>
        <blockquote className="notice-wording">{wording}</blockquote>
        {withdrawnOn ? (
          <p role={actionData?.withdrawn ? "status" : undefined}>
            You withdrew this agreement on {withdrawnOn}. We won't use your details for it again.
          </p>
        ) : (
          <Form method="post" className="public-form">
            <p>Withdrawing doesn't undo anything already done, but we won't use your details for this again.</p>
            <button type="submit">Withdraw my agreement</button>
          </Form>
        )}
        <p>
          <Link to="/privacy">How NAISEMA handles your information</Link>
        </p>
      </article>
    </main>
  );
}
