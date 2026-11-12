import { data, Form, redirect } from "react-router";
import { WhatsThis } from "~/components/whats-this";
import { cloudflareContext } from "~/lib/cloudflare";
import { heldItems, itemAtAddress } from "~/lib/content.server";
import { getDb } from "~/lib/db.server";
import { deleteAfter, FORMS, type FormKey, RETENTION_MONTHS } from "~/lib/forms";
import { can } from "~/lib/roles";
import { requireStaff } from "~/lib/staff.server";
import { deleteSubmission, listSubmissions, markDone, mayDelete, openSubmission } from "~/lib/submissions.server";
import type { Route } from "./+types/submissions";

/**
 * /admin/submissions[/:id]: what people sent through the public forms, each to the people who
 * handle that form: reports to the safeguarding lead, privacy requests to administrators.
 * Opening one is audited. Each is deleted 12 months after it is dealt with, and the privacy
 * contact can find and delete everything from one address when someone asks.
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
      one: {
        ...row,
        deletable: mayDelete(actor, row.form),
        keptUntil: row.doneAt ? deleteAfter(row.doneAt) : null,
      },
      item: item && { id: item.id, title: item.title, held: item.heldAt !== null },
      list: null,
      held: [],
      email: "",
      deleted: false,
    };
  }
  const url = new URL(request.url);
  const email = (url.searchParams.get("email") ?? "").trim().slice(0, 254);
  const held = can(actor, "content.hold") ? await heldItems(db) : [];
  return {
    one: null,
    item: null,
    list: await listSubmissions(db, actor, { email }),
    held: held.map((row) => ({ id: row.id, title: row.title, heldAt: row.heldAt, reason: row.heldReason })),
    email,
    deleted: url.searchParams.get("deleted") === "1",
  };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireStaff(env, request);
  const db = getDb(env.DB);
  const form = await request.formData();
  if (!params.id) throw new Response("Not found", { status: 404 });
  if (form.get("intent") === "delete") {
    const reason = String(form.get("reason") ?? "").trim();
    if (!reason || form.get("confirm") !== "yes")
      return data(
        { error: "Say why it is being deleted, and tick the box to say you know it can't be undone." },
        { status: 400 },
      );
    if (!(await deleteSubmission(db, actor, params.id, reason))) throw new Response("Not found", { status: 404 });
    return redirect("/admin/submissions?deleted=1");
  }
  if (!(await markDone(db, actor, params.id, form.get("done") === "yes")))
    throw new Response("Not found", { status: 404 });
  return redirect(`/admin/submissions/${params.id}`);
}

export function meta() {
  return [{ title: "Messages and reports · NAISEMA staff" }];
}

const formTitle = (key: string) => FORMS[key as FormKey]?.title ?? key;
const day = (date: Date | string) => new Date(date).toLocaleDateString("en-AU", { dateStyle: "long" });

export default function Submissions({ loaderData, actionData }: Route.ComponentProps) {
  const { one, list, item, held, email } = loaderData;
  if (one) {
    return (
      <main id="main" className="page">
        <p>
          <a href="/admin/submissions">All messages and reports</a>
        </p>
        <h1>{formTitle(one.form)}</h1>
        <p className="meta">
          Sent {new Date(one.createdAt).toLocaleString("en-AU")} under privacy notice {one.noticeVersion}.{" "}
          {one.keptUntil
            ? `Dealt with, so it is deleted on ${day(one.keptUntil)}.`
            : `Kept until ${RETENTION_MONTHS} months after it is dealt with.`}
        </p>
        {actionData?.error && (
          <p role="alert" className="error">
            {actionData.error}
          </p>
        )}
        <dl>
          <dt>Name</dt>
          <dd>{one.name ?? "Not given"}</dd>
          <dt>Email</dt>
          <dd>
            {one.email ? (
              <>
                <a href={`mailto:${one.email}`}>{one.email}</a> (
                <a href={`/admin/submissions?email=${encodeURIComponent(one.email)}`}>everything from this address</a>)
              </>
            ) : (
              "Not given"
            )}
          </dd>
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
        {one.deletable && (
          <Form method="post" className="delete-form">
            <h2>Delete it now</h2>
            <p>
              For when the person asks for what they sent to be deleted. It is gone from the staff site at once, and
              from the weekly backups within 35 days. The audit log keeps only that it was deleted, by whom and why.
            </p>
            <input type="hidden" name="intent" value="delete" />
            <label htmlFor="delete-reason">Why</label>
            <input
              id="delete-reason"
              name="reason"
              required
              maxLength={500}
              placeholder="Their privacy request of 12 November"
            />
            <label className="checkbox">
              <input type="checkbox" name="confirm" value="yes" required /> I know this can't be undone
            </label>
            <button type="submit">Delete for good</button>
          </Form>
        )}
      </main>
    );
  }
  return (
    <main id="main" className="page">
      <h1>Messages and reports</h1>
      {loaderData.deleted && <p role="status">Deleted.</p>}
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
        <p>
          Each one is deleted {RETENTION_MONTHS} months after it is marked as dealt with, as the privacy notice on every
          form promises. When someone asks to see or delete what they sent, an administrator finds it all with{" "}
          <strong>Everything from one address</strong>, and can delete each one from its page.
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
      <Form method="get" className="filters">
        <label htmlFor="email-filter">Everything from one address</label>
        <input id="email-filter" name="email" type="email" defaultValue={email} maxLength={254} />
        <button type="submit">Find</button>
        {email && <a href="/admin/submissions">Show all</a>}
      </Form>
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
        <p>{email ? `Nothing you can read was sent from ${email}.` : "Nothing has been sent yet."}</p>
      )}
    </main>
  );
}
