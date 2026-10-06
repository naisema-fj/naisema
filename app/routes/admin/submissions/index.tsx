import { fijiToday } from "~/lib/calendar";
import { cloudflareContext } from "~/lib/cloudflare";
import { SUBMISSION_STATUSES, SUBMISSION_TYPES } from "~/lib/submission-fields";
import { requireSubmissionManager, submissionQueue } from "~/lib/submissions.server";
import type { Route } from "./+types/index";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Submissions · NAISEMA staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db } = await requireSubmissionManager(context.get(cloudflareContext).env, request);
  const show = new URL(request.url).searchParams.get("show") === "closed" ? "closed" : "open";
  return { show, today: fijiToday(), submissions: await submissionQueue(db, show) };
}

export default function Submissions({ loaderData }: Route.ComponentProps) {
  const { show, today, submissions } = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Submissions</h1>
      <p>
        What the public sends through the site's forms. Nothing here is ever published. Each Submission has an owner and
        a day it should be answered by.
      </p>
      <p>
        {show === "open" ? (
          <>
            <strong>Open</strong> · <a href="/admin/submissions?show=closed">Closed</a>
          </>
        ) : (
          <>
            <a href="/admin/submissions">Open</a> · <strong>Closed</strong>
          </>
        )}
      </p>
      {submissions.length ? (
        <table>
          <thead>
            <tr>
              <th scope="col">From</th>
              <th scope="col">Kind</th>
              <th scope="col">Received</th>
              <th scope="col">Due</th>
              <th scope="col">Owner</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((row) => (
              <tr key={row.id}>
                <td>
                  <a href={`/admin/submissions/${row.id}`}>{row.name}</a>
                </td>
                <td>{SUBMISSION_TYPES[row.type].name}</td>
                <td>{row.receivedAt.toISOString().slice(0, 10)}</td>
                <td>
                  {row.dueOn}
                  {show === "open" && row.dueOn < today && <strong> (overdue)</strong>}
                </td>
                <td>{row.ownerName ?? "Nobody yet"}</td>
                <td>{SUBMISSION_STATUSES[row.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>{show === "open" ? "Nothing is waiting." : "Nothing has been closed yet."}</p>
      )}
    </main>
  );
}
