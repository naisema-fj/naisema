import { data, Form } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { allNotices, publishNotice, requireConsentStaff } from "~/lib/consent.server";
import { CONSENT_PURPOSES, type ConsentPurpose } from "~/lib/submission-fields";
import type { Route } from "./+types/notices";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Consent notices · Na iSema staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db } = await requireConsentStaff(context.get(cloudflareContext).env, request, "notice.publish");
  return { notices: await allNotices(db) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { db, actor } = await requireConsentStaff(context.get(cloudflareContext).env, request, "notice.publish");
  const form = await request.formData();
  const purpose = String(form.get("purpose") ?? "");
  const result = await publishNotice(db, actor.userId, purpose, String(form.get("wording") ?? ""));
  if (!result.ok) return data({ purpose, error: result.error }, { status: 400 });
  return { purpose, published: result.version };
}

export default function Notices({ loaderData, actionData }: Route.ComponentProps) {
  const purposes = Object.keys(CONSENT_PURPOSES) as ConsentPurpose[];
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Consent notices</h1>
      <p>
        The words people read before they agree to something on a public form. Changing them publishes a new version;
        every earlier version stays here, so what anyone agreed to can always be read again.
      </p>
      {purposes.map((purpose) => {
        const versions = loaderData.notices.filter((notice) => notice.purpose === purpose);
        const current = versions[0];
        const result = actionData?.purpose === purpose ? actionData : null;
        return (
          <section key={purpose} aria-labelledby={`${purpose}-heading`}>
            <h2 id={`${purpose}-heading`}>{CONSENT_PURPOSES[purpose]}</h2>
            {result && "published" in result && <p role="status">Version {result.published} is now in use.</p>}
            <Form method="post" className="article-form">
              <input type="hidden" name="purpose" value={purpose} />
              <label htmlFor={`${purpose}-wording`}>Wording in use (version {current?.version ?? 0})</label>
              <textarea
                id={`${purpose}-wording`}
                name="wording"
                rows={6}
                defaultValue={current?.wording ?? ""}
                aria-describedby={result && "error" in result ? `${purpose}-error` : undefined}
              />
              {result && "error" in result && (
                <p id={`${purpose}-error`} className="field-error">
                  {result.error}
                </p>
              )}
              <button type="submit">Publish as a new version</button>
            </Form>
            {versions.length > 1 && (
              <details>
                <summary>Earlier versions</summary>
                {versions.slice(1).map((notice) => (
                  <div key={notice.id}>
                    <h3>
                      Version {notice.version}, published {notice.publishedAt.toISOString().slice(0, 10)}
                    </h3>
                    <p className="preserve-lines">{notice.wording}</p>
                  </div>
                ))}
              </details>
            )}
          </section>
        );
      })}
    </main>
  );
}
