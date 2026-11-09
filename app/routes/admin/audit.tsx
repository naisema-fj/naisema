import { desc } from "drizzle-orm";
import { auditEvent } from "~db/schema";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { requireStaff } from "~/lib/staff.server";
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
      <div className="table-scroll" role="region" aria-labelledby="audit-caption" tabIndex={0}>
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
      </div>
    </main>
  );
}
