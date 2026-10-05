import { cloudflareContext } from "~/lib/cloudflare";
import { currentProblems } from "~/lib/monitor.server";
import { formatMoment } from "~/lib/monitor-rules";
import { can } from "~/lib/permissions";
import { optionalSecret } from "~/lib/secrets.server";
import { requireStaff } from "~/lib/staff.server";
import { usageReport } from "~/lib/usage.server";
import { AUD_PER_USD, formatAud, formatGigabytes, MONTHLY_CEILING_AUD, PRICES_USD } from "~/lib/usage-rules";
import type { Route } from "./+types/usage";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Usage and costs · Na iSema staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireStaff(env, request);
  if (!can(actor, { action: "usage.read" })) {
    throw new Response("Only administrators can see usage and costs.", { status: 403 });
  }
  const problems = await currentProblems(db);
  return {
    configured: optionalSecret(env, "MONITORING_API_TOKEN") !== undefined,
    months: await usageReport(db),
    problems: problems.map((problem) => ({ ...problem, since: formatMoment(problem.failingSince) })),
  };
}

const usd = (amount: number) => `USD ${amount.toFixed(2)}`;
const minutes = (count: number) => Math.round(count).toLocaleString("en-AU");

export default function Usage({ loaderData }: Route.ComponentProps) {
  const { configured, months, problems } = loaderData;
  const [current, ...earlier] = months;
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Usage and costs</h1>
      <p>
        Media usage for the whole Cloudflare account, read once a day, and what the month is on course to cost against
        the {formatAud(MONTHLY_CEILING_AUD)} monthly ceiling. Cloudflare's billing page has the actual charges.
      </p>
      {!configured && (
        <p role="status">
          Cloudflare's figures aren't read in this environment: MONITORING_API_TOKEN isn't set (runbook, monitoring and
          alerts).
        </p>
      )}

      <h2>This month</h2>
      {current ? (
        <>
          <p>
            {current.month}, last read {formatMoment(current.recordedAt)}. Projected:{" "}
            <strong>
              {formatAud(current.estimate.aud)} ({current.estimate.percentOfCeiling}% of the ceiling)
            </strong>
            .
          </p>
          <table>
            <caption className="visually-hidden">This month's usage and projected cost</caption>
            <thead>
              <tr>
                <th scope="col">What</th>
                <th scope="col">Usage</th>
                <th scope="col">Projected cost</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Workers Paid plan</th>
                <td>Monthly charge</td>
                <td>{usd(current.estimate.usd.workers)}</td>
              </tr>
              <tr>
                <th scope="row">Stream, minutes stored</th>
                <td>{minutes(current.storedMinutes)}</td>
                <td>{usd(current.estimate.usd.streamStored)}</td>
              </tr>
              <tr>
                <th scope="row">Stream, minutes delivered</th>
                <td>
                  {minutes(current.deliveredMinutes)} so far, about{" "}
                  {minutes(current.estimate.deliveredMinutesProjected)} by the month's end
                </td>
                <td>{usd(current.estimate.usd.streamDelivered)}</td>
              </tr>
              <tr>
                <th scope="row">R2 storage</th>
                <td>{formatGigabytes(current.r2Bytes)}</td>
                <td>{usd(current.estimate.usd.r2)}</td>
              </tr>
              <tr>
                <th scope="row">Total</th>
                <td />
                <td>
                  {usd(current.estimate.usd.total)}, about {formatAud(current.estimate.aud)}
                </td>
              </tr>
            </tbody>
          </table>
        </>
      ) : (
        <p>No usage has been recorded yet.</p>
      )}

      {earlier.length > 0 && (
        <>
          <h2>Earlier months</h2>
          <table>
            <caption className="visually-hidden">Usage and estimated cost in earlier months</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Minutes stored</th>
                <th scope="col">Minutes delivered</th>
                <th scope="col">R2 storage</th>
                <th scope="col">Estimated cost</th>
              </tr>
            </thead>
            <tbody>
              {earlier.map((month) => (
                <tr key={month.month}>
                  <th scope="row">{month.month}</th>
                  <td>{minutes(month.storedMinutes)}</td>
                  <td>{minutes(month.deliveredMinutes)}</td>
                  <td>{formatGigabytes(month.r2Bytes)}</td>
                  <td>{formatAud(month.estimate.aud)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>How the estimate is worked out</h2>
      <p>
        Stream costs USD {PRICES_USD.streamStoredPer1000Minutes} per 1,000 minutes stored and USD{" "}
        {PRICES_USD.streamDeliveredPer1000Minutes} per 1,000 minutes delivered. R2 costs USD {PRICES_USD.r2PerGbMonth}{" "}
        per GB a month after the first {PRICES_USD.r2FreeGb} GB, and the Workers Paid plan USD{" "}
        {PRICES_USD.workersPaidMonthly} a month. Storage is counted at today's level for the whole month, and delivery
        at the rate so far. US dollars are converted at {AUD_PER_USD} Australian dollars each. Budget alerts are emailed
        when the month is first on course for 50%, and then 80%, of the ceiling.
      </p>

      <h2>Monitoring</h2>
      {problems.length ? (
        <ul>
          {problems.map((problem) => (
            <li key={problem.check}>
              {problem.summary} (since {problem.since})
            </li>
          ))}
        </ul>
      ) : (
        <p>The hourly monitor isn't reporting any ongoing problems.</p>
      )}
    </main>
  );
}
