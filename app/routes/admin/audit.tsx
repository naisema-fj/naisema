import { Form } from "react-router";
import { auditLog, cursorText, readCursor } from "~/lib/audit.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { can } from "~/lib/permissions";
import { requireStaff } from "~/lib/staff.server";
import type { Route } from "./+types/audit";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Audit log · NAISEMA staff" }, { name: "robots", content: "noindex" }];
}

const FILTERS = ["object", "actor", "action"] as const;

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db, actor } = await requireStaff(context.get(cloudflareContext).env, request);
  if (!can(actor, { action: "audit.read" })) {
    throw new Response("Only administrators can read the audit log.", { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const filter = Object.fromEntries(
    FILTERS.map((name) => [name, (params.get(name) ?? "").trim().slice(0, 320)]).filter(([, value]) => value),
  ) as Partial<Record<(typeof FILTERS)[number], string>>;
  const { events, more } = await auditLog(db, { ...filter, before: readCursor(params.get("before")) });
  const last = events.at(-1);
  const next = new URLSearchParams(filter);
  if (more && last) next.set("before", cursorText({ at: last.createdAt.getTime(), id: last.id }));
  return {
    filter,
    events: events.map((event) => ({
      id: event.id,
      at: event.createdAt.toISOString().replace("T", " ").slice(0, 19),
      who: event.actorEmail ?? event.actorId ?? "The system or a member of the public",
      action: event.action,
      object: event.objectId ? `${event.objectType} ${event.objectId}` : event.objectType,
      reason: event.reason,
      details: event.details ? JSON.stringify(event.details) : "",
    })),
    nextPage: more ? `?${next}` : null,
  };
}

export default function AuditLog({ loaderData }: Route.ComponentProps) {
  const { filter, events, nextPage } = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Audit log</h1>
      <p>
        Who did what to which object, when, and why where a reason was given: publishing, reviews, permissions, rights,
        accounts and moderation. Times are UTC. Nothing here can be changed or removed. Case events show what was done,
        never what the Case says.
      </p>
      <Form method="get" className="article-form">
        <label htmlFor="object">Object ID</label>
        <input id="object" name="object" defaultValue={filter.object ?? ""} />
        <label htmlFor="actor">Who acted (email address or user ID)</label>
        <input id="actor" name="actor" defaultValue={filter.actor ?? ""} />
        <label htmlFor="action">Action starts with</label>
        <input id="action" name="action" defaultValue={filter.action ?? ""} aria-describedby="action-hint" />
        <p id="action-hint">For example content_item. or role.</p>
        <button type="submit">Show</button>
      </Form>
      {events.length ? (
        <table>
          <thead>
            <tr>
              <th scope="col">When (UTC)</th>
              <th scope="col">Who</th>
              <th scope="col">Action</th>
              <th scope="col">Object</th>
              <th scope="col">Reason</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{event.at}</td>
                <td>{event.who}</td>
                <td>{event.action}</td>
                <td>{event.object}</td>
                <td>{event.reason ?? ""}</td>
                <td>
                  <code>{event.details}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No events match.</p>
      )}
      {nextPage && (
        <p>
          <a href={nextPage}>Older events</a>
        </p>
      )}
    </main>
  );
}
