import { desc } from "drizzle-orm";
import { TableScroll } from "~/components/table-scroll";
import { WhatsThis } from "~/components/whats-this";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { requireStaff } from "~/lib/staff.server";
import { auditEvent } from "~db/schema";
import type { Route } from "./+types/audit";

/** /admin/audit: the latest 500 audit events, for administrators. Older ones: `pnpm db:export`. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireStaff(env, request, "audit.read");
  return { events: await getDb(env.DB).select().from(auditEvent).orderBy(desc(auditEvent.createdAt)).limit(500) };
}

export function meta() {
  return [{ title: "Audit log · NAISEMA staff" }];
}

export default function Audit({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <h1>Audit log</h1>
      <WhatsThis summary="What is this?">
        <p>
          A record of what anyone did on the staff site: who, what, on which item, when, and why where a reason was
          given. It shows the latest 500 events, and nothing in it can be changed.
        </p>
      </WhatsThis>
      <TableScroll label="Audit events">
        <table>
          <caption id="audit-caption">The latest 500 events, newest first</caption>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Who</th>
              <th scope="col">What</th>
              <th scope="col">On</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {loaderData.events.map((event) => (
              <tr key={event.id}>
                <td>{new Date(event.createdAt).toLocaleString("en-AU")}</td>
                <td>{event.actorEmail}</td>
                <td>{event.action}</td>
                <td>{`${event.subjectType} ${event.subjectId}`}</td>
                <td>
                  <code>{JSON.stringify(event.details)}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </main>
  );
}
