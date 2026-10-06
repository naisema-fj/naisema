import { Form } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { consentsOf, requireConsentStaff, withdrawConsent } from "~/lib/consent.server";
import { can } from "~/lib/permissions";
import { CONSENT_PURPOSES } from "~/lib/submission-fields";
import type { Route } from "./+types/consents";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Consent Records · NAISEMA staff" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db, actor } = await requireConsentStaff(context.get(cloudflareContext).env, request, "consent.manage");
  const email = (new URL(request.url).searchParams.get("email") ?? "").trim();
  const records = email ? await consentsOf(db, email) : [];
  // That someone sent a report is safeguarding information: only the case team for reports sees it.
  const seesReports = can(actor, { action: "case.read", case: { kind: "report" } });
  return {
    email,
    records: records.map((row) => ({
      ...row,
      record: {
        ...row.record,
        sourceForm: row.record.sourceForm === "report" && !seesReports ? "a restricted form" : row.record.sourceForm,
      },
    })),
  };
}

/** Withdraws a consent at the person's request (a data request), recorded as done by staff. */
export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireConsentStaff(env, request, "consent.manage");
  const form = await request.formData();
  const withdrawn = await withdrawConsent(env, db, String(form.get("recordId") ?? ""), "staff", actor.userId);
  if (!withdrawn) throw new Response("Not found", { status: 404 });
  return { withdrawn: true };
}

export default function Consents({ loaderData, actionData }: Route.ComponentProps) {
  const { email, records } = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Consent Records</h1>
      <p>Find what a person agreed to, under which notice, and withdraw an agreement when they ask.</p>
      <Form method="get" className="article-form">
        <label htmlFor="email">Their email address</label>
        <input id="email" name="email" type="email" defaultValue={email} />
        <button type="submit">Find</button>
      </Form>
      {actionData?.withdrawn && <p role="status">Withdrawn.</p>}
      {email &&
        (records.length ? (
          <table>
            <thead>
              <tr>
                <th scope="col">Agreed to</th>
                <th scope="col">Notice</th>
                <th scope="col">On</th>
                <th scope="col">Form</th>
                <th scope="col">Withdrawn</th>
              </tr>
            </thead>
            <tbody>
              {records.map(({ record, notice }) => (
                <tr key={record.id}>
                  <td>{CONSENT_PURPOSES[record.purpose]}</td>
                  <td>Version {notice.version}</td>
                  <td>{record.givenAt.toISOString().slice(0, 10)}</td>
                  <td>{record.sourceForm}</td>
                  <td>
                    {record.withdrawnAt ? (
                      `${record.withdrawnAt.toISOString().slice(0, 10)} (${record.withdrawnVia})`
                    ) : (
                      <Form method="post">
                        <input type="hidden" name="recordId" value={record.id} />
                        <button type="submit">Withdraw at their request</button>
                      </Form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No Consent Records for {email}.</p>
        ))}
    </main>
  );
}
