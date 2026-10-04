import { CASE_KINDS, CASE_STATES, SEVERITIES } from "~/lib/case-rules";
import { caseQueue, caseReference, requireCaseTeam } from "~/lib/cases.server";
import { cloudflareContext } from "~/lib/cloudflare";
import type { Route } from "./+types/index";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Cases · Na iSema staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db, actor, kinds } = await requireCaseTeam(context.get(cloudflareContext).env, request);
  const show = new URL(request.url).searchParams.get("show") === "closed" ? "closed" : "open";
  const cases = await caseQueue(db, actor, kinds, show);
  return {
    show,
    kinds: kinds.map((kind) => CASE_KINDS[kind]),
    cases: cases.map((row) => ({
      id: row.id,
      reference: caseReference(row.id),
      kind: CASE_KINDS[row.kind],
      state: CASE_STATES[row.state],
      severity: row.severity ? SEVERITIES[row.severity] : "Not triaged",
      ownerName: row.ownerName ?? "Nobody yet",
      receivedOn: row.receivedAt.toISOString().slice(0, 10),
    })),
  };
}

export default function Cases({ loaderData }: Route.ComponentProps) {
  const { show, kinds, cases } = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Cases</h1>
      <p>
        Restricted: only you and others who handle {kinds.join(" and ").toLowerCase()} Cases can open these. Every view
        and change is recorded.
      </p>
      <p>
        {show === "open" ? (
          <>
            <strong>Open</strong> · <a href="/admin/cases?show=closed">Closed</a>
          </>
        ) : (
          <>
            <a href="/admin/cases">Open</a> · <strong>Closed</strong>
          </>
        )}
      </p>
      {cases.length ? (
        <table>
          <thead>
            <tr>
              <th scope="col">Case</th>
              <th scope="col">Kind</th>
              <th scope="col">State</th>
              <th scope="col">Severity</th>
              <th scope="col">Owner</th>
              <th scope="col">Received</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((row) => (
              <tr key={row.id}>
                <td>
                  <a href={`/admin/cases/${row.id}`}>{row.reference}</a>
                </td>
                <td>{row.kind}</td>
                <td>{row.state}</td>
                <td>{row.severity}</td>
                <td>{row.ownerName}</td>
                <td>{row.receivedOn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>{show === "open" ? "No open Cases." : "No closed Cases yet."}</p>
      )}
    </main>
  );
}
