import { Form, redirect } from "react-router";
import { WhatsThis } from "~/components/whats-this";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { FORMS, type FormKey } from "~/lib/forms";
import { requireStaff } from "~/lib/staff.server";
import { listSubmissions, markDone, openSubmission } from "~/lib/submissions.server";
import type { Route } from "./+types/submissions";

/**
 * /admin/submissions[/:id]: what people sent through the public forms, each to the people who
 * handle that form: reports to the safeguarding lead, privacy requests to administrators.
 * Opening one is audited.
 */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireStaff(env, request);
  const db = getDb(env.DB);
  if (params.id) {
    const row = await openSubmission(db, actor, params.id);
    if (!row) throw new Response("Not found", { status: 404 });
    return { one: row, list: null };
  }
  return { one: null, list: await listSubmissions(db, actor) };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireStaff(env, request);
  const form = await request.formData();
  if (!params.id || !(await markDone(getDb(env.DB), actor, params.id, form.get("done") === "yes")))
    throw new Response("Not found", { status: 404 });
  return redirect(`/admin/submissions/${params.id}`);
}

export function meta() {
  return [{ title: "Messages and reports · NAISEMA staff" }];
}

const formTitle = (key: string) => FORMS[key as FormKey]?.title ?? key;

export default function Submissions({ loaderData }: Route.ComponentProps) {
  const { one, list } = loaderData;
  if (one) {
    return (
      <main id="main" className="page">
        <p>
          <a href="/admin/submissions">All messages and reports</a>
        </p>
        <h1>{formTitle(one.form)}</h1>
        <p className="meta">
          Sent {new Date(one.createdAt).toLocaleString("en-AU")} under privacy notice {one.noticeVersion}
        </p>
        <dl>
          <dt>Name</dt>
          <dd>{one.name ?? "Not given"}</dd>
          <dt>Email</dt>
          <dd>{one.email ? <a href={`mailto:${one.email}`}>{one.email}</a> : "Not given"}</dd>
          {Object.entries(one.fields).map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd className="preserve-lines">{value}</dd>
            </div>
          ))}
        </dl>
        <Form method="post">
          <input type="hidden" name="done" value={one.done ? "no" : "yes"} />
          <button type="submit">{one.done ? "Mark as not dealt with" : "Mark as dealt with"}</button>
        </Form>
      </main>
    );
  }
  return (
    <main id="main" className="page">
      <h1>Messages and reports</h1>
      <WhatsThis summary="Who sees what">
        <ul>
          <li>
            <strong>Reports</strong> about something harmful, wrong or used without permission go only to the
            Safeguarding Lead.
          </li>
          <li>
            <strong>Requests about people's own information</strong> go only to administrators.
          </li>
          <li>Other messages go to administrators and editors.</li>
        </ul>
        <p>
          You see only the ones your roles allow. Opening one is recorded in the audit log. Reply by email, then press{" "}
          <strong>Mark as dealt with</strong>. Nothing sent here is ever published.
        </p>
      </WhatsThis>
      {list?.length ? (
        <ul>
          {list.map((row) => (
            <li key={row.id}>
              <a href={`/admin/submissions/${row.id}`}>{formTitle(row.form)}</a>,{" "}
              {new Date(row.createdAt).toLocaleDateString("en-AU")}
              {row.done ? " (dealt with)" : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p>Nothing has been sent yet.</p>
      )}
    </main>
  );
}
