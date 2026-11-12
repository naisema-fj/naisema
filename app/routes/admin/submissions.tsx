import { Form, redirect } from "react-router";
import { WhatsThis } from "~/components/whats-this";
import { cloudflareContext } from "~/lib/cloudflare";
import { heldItems, itemAtAddress } from "~/lib/content.server";
import { getDb } from "~/lib/db.server";
import { FORMS, type FormKey } from "~/lib/forms";
import { can } from "~/lib/roles";
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
    // A report names where the problem is; when that's a NAISEMA address, link the item itself.
    const item = row.form === "report" && row.fields.address ? await itemAtAddress(db, row.fields.address) : null;
    return {
      one: row,
      item: item && { id: item.id, title: item.title, held: item.heldAt !== null },
      list: null,
      held: [],
    };
  }
  const held = can(actor, "content.hold") ? await heldItems(db) : [];
  return {
    one: null,
    item: null,
    list: await listSubmissions(db, actor),
    held: held.map((row) => ({ id: row.id, title: row.title, heldAt: row.heldAt, reason: row.heldReason })),
  };
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
  const { one, list, item, held } = loaderData;
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
        {item && (
          <p>
            It is about <a href={`/admin/items/${item.id}`}>{item.title}</a>
            {item.held ? ", which is held off the site." : ". You can hold it off the site from its page."}
          </p>
        )}
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
            Safeguarding Lead, who can hold the item off the site from its page while they look into it.
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
      {held.length > 0 && (
        <section aria-labelledby="held-heading">
          <h2 id="held-heading">Held off the site</h2>
          <p>Release each hold from the item's page once its report is dealt with.</p>
          <ul>
            {held.map((row) => (
              <li key={row.id}>
                <a href={`/admin/items/${row.id}`}>{row.title}</a>, since{" "}
                {row.heldAt ? new Date(row.heldAt).toLocaleDateString("en-AU") : ""}: {row.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
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
