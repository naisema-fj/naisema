import { eq } from "drizzle-orm";
import { data, Form, redirect } from "react-router";
import { fijiToday } from "~/lib/calendar";
import { cloudflareContext } from "~/lib/cloudflare";
import { Refused } from "~/lib/content.server";
import { getDb } from "~/lib/db.server";
import { storeEvidence } from "~/lib/media.server";
import { addRights, rightsFor, withdrawRights } from "~/lib/rights.server";
import { formatDay, isCurrent, PERMITTED_USE_NAMES, PERMITTED_USES } from "~/lib/rights-rules";
import { requireStaff } from "~/lib/staff.server";
import { contentItem, media } from "~db/schema";
import type { Route } from "./+types/rights";

/**
 * /admin/rights/:type/:id: the Rights Records on a Content Item or a media file (ADR-0007). Records
 * are added and withdrawn, never edited. Evidence (the signed permission) is kept privately.
 */
async function subjectOf(db: ReturnType<typeof getDb>, type: string, id: string) {
  if (type === "item") {
    const item = await db.query.contentItem.findFirst({ where: eq(contentItem.id, id) });
    return item ? { type: "item" as const, id, name: item.title, back: `/admin/items/${id}` } : null;
  }
  if (type === "media") {
    const file = await db.query.media.findFirst({ where: eq(media.id, id) });
    return file ? { type: "media" as const, id, name: file.filename, back: "/admin/media" } : null;
  }
  return null;
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireStaff(env, request, "rights.manage");
  const db = getDb(env.DB);
  const subject = await subjectOf(db, params.type, params.id);
  if (!subject) throw new Response("Not found", { status: 404 });
  const today = fijiToday();
  const records = await rightsFor(db, subject);
  return { subject, records: records.map((record) => ({ ...record, current: isCurrent(record, today) })) };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireStaff(env, request, "rights.manage");
  const db = getDb(env.DB);
  const subject = await subjectOf(db, params.type, params.id);
  if (!subject) throw new Response("Not found", { status: 404 });
  const form = await request.formData();
  const field = (name: string) => String(form.get(name) ?? "");
  try {
    if (field("intent") === "withdraw") {
      await withdrawRights(db, actor, field("recordId"), field("reason"));
    } else {
      const file = form.get("evidence");
      const evidenceKey = file instanceof File && file.size > 0 ? await storeEvidence(env, actor, file) : null;
      await addRights(db, actor, subject, {
        holder: field("holder"),
        uses: form.getAll("uses").map(String),
        guardianPermission: field("guardianPermission") === "on",
        expiresOn: field("expiresOn"),
        notes: field("notes"),
        evidenceKey,
      });
    }
  } catch (error) {
    if (error instanceof Refused) return data({ error: error.message }, { status: error.status });
    throw error;
  }
  return redirect(`/admin/rights/${params.type}/${params.id}`);
}

export function meta() {
  return [{ title: "Rights Records · NAISEMA staff" }];
}

export default function Rights({ loaderData, actionData }: Route.ComponentProps) {
  const { subject, records } = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <a href={subject.back}>Back to {subject.name}</a>
      </p>
      <h1>Rights Records: {subject.name}</h1>
      {actionData?.error && (
        <p role="alert" className="error">
          {actionData.error}
        </p>
      )}
      {records.length ? (
        <ul className="rights-list">
          {records.map((record) => (
            <li key={record.id}>
              <p>
                <strong>{record.holder}</strong> permits{" "}
                {record.permittedUses.map((use) => PERMITTED_USE_NAMES[use]).join(", ")}
                {record.guardianPermission && ", with guardian permission for children shown"}.{" "}
                {record.withdrawnAt
                  ? "Withdrawn."
                  : record.expiresOn
                    ? `${record.current ? "Holds until" : "Expired after"} ${formatDay(record.expiresOn)}.`
                    : "No end date."}
              </p>
              {record.notes && <p className="meta">{record.notes}</p>}
              {record.evidenceKey && (
                <p>
                  <a href={`/admin/rights/evidence/${record.id}`}>Download the evidence</a>
                </p>
              )}
              {!record.withdrawnAt && (
                <Form method="post" className="inline-form">
                  <input type="hidden" name="intent" value="withdraw" />
                  <input type="hidden" name="recordId" value={record.id} />
                  <label htmlFor={`reason-${record.id}`}>Reason</label>
                  <input id={`reason-${record.id}`} name="reason" required maxLength={500} />
                  <button type="submit">Withdraw this record</button>
                </Form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No Rights Records yet. Nothing here can be public until one grants Publish.</p>
      )}

      <Form method="post" encType="multipart/form-data" aria-labelledby="add-heading">
        <h2 id="add-heading">Add a Rights Record</h2>
        <input type="hidden" name="intent" value="add" />
        <label htmlFor="holder">Who holds the rights</label>
        <input id="holder" name="holder" required maxLength={300} />
        <fieldset>
          <legend>What they permit</legend>
          {PERMITTED_USES.map((use) => (
            <label key={use} className="checkbox">
              <input type="checkbox" name="uses" value={use} /> {PERMITTED_USE_NAMES[use]}
            </label>
          ))}
        </fieldset>
        <label className="checkbox">
          <input type="checkbox" name="guardianPermission" /> Includes documented permission from the guardian of any
          children who can be identified
        </label>
        <label htmlFor="expiresOn">Last day it holds (leave empty for no end)</label>
        <input id="expiresOn" name="expiresOn" type="date" />
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={3} maxLength={2000} />
        <label htmlFor="evidence">The signed permission (PDF, JPEG, PNG or WebP, up to 10 MB)</label>
        <input id="evidence" name="evidence" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
        <button type="submit">Add the record</button>
      </Form>
    </main>
  );
}
