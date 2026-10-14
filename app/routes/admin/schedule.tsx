import { Form } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireStaff } from "~/lib/staff.server";
import { dayText, dueText, RANGES, rangeDays, type ScheduleEntry, scheduleKinds, waitText } from "~/lib/staff-schedule";
import { staffSchedule } from "~/lib/staff-schedule.server";
import type { Route } from "./+types/schedule";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "What's coming up · NAISEMA staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db, actor } = await requireStaff(context.get(cloudflareContext).env, request);
  const days = rangeDays(new URL(request.url).searchParams.get("days"));
  const now = new Date();
  const schedule = await staffSchedule(db, actor, now, days);
  const wrap = (entry: ScheduleEntry) => ({
    key: entry.key,
    title: entry.title,
    detail: entry.detail,
    href: entry.href,
    when: entry.date ? `${dueText(entry.date, schedule.today)} (${dayText(entry.date)})` : waitText(entry, now),
  });
  return {
    days,
    kinds: scheduleKinds(actor),
    unavailable: schedule.unavailable,
    limited: schedule.limited,
    overdue: schedule.overdue.map(wrap),
    upcoming: schedule.upcoming.map(wrap),
    waiting: schedule.waiting.map(wrap),
  };
}

type Row = Route.ComponentProps["loaderData"]["overdue"][number];

function EntryTable({ caption, whenHeading, rows }: { caption: string; whenHeading: string; rows: Row[] }) {
  return (
    <table>
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Item</th>
          <th scope="col">What it is</th>
          <th scope="col">{whenHeading}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">
              <a href={row.href}>{row.title}</a>
            </th>
            <td>{row.detail}</td>
            <td>{row.when}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Schedule({ loaderData }: Route.ComponentProps) {
  const { days, kinds, unavailable, limited, overdue, upcoming, waiting } = loaderData;
  const nothing = overdue.length + upcoming.length + waiting.length === 0;
  return (
    <main id="main" className="page">
      <h1>What's coming up</h1>
      {kinds.length === 0 ? (
        <p>Nothing on this page is handled by your roles.</p>
      ) : (
        <p>For your roles: {kinds.join("; ")}. It shows dates and waits only, never what a Case or Submission says.</p>
      )}

      <Form method="get" className="inline-form">
        <label htmlFor="schedule-days">Show what is due in the next</label>
        <select id="schedule-days" name="days" defaultValue={String(days)}>
          {RANGES.map((range) => (
            <option key={range} value={range}>
              {range} days
            </option>
          ))}
        </select>
        <button type="submit">Show</button>
      </Form>

      {unavailable.length > 0 && (
        <p role="alert">{unavailable.join(" and ")} couldn't be checked just now. The rest is shown below.</p>
      )}

      {limited && (
        <p role="status">
          Only the 60 longest-waiting Content Items are checked for reviews, so some newer ones may not be listed.
        </p>
      )}

      {nothing && kinds.length > 0 && unavailable.length === 0 && (
        <div role="status">
          <p>Nothing is due in the next {days} days, nothing is overdue and nothing is waiting.</p>
          <p>Choose a longer range to look further ahead.</p>
        </div>
      )}

      {overdue.length > 0 && (
        <section aria-labelledby="overdue-heading">
          <h2 id="overdue-heading">Overdue</h2>
          <EntryTable caption="Overdue items, most overdue first" whenHeading="How late" rows={overdue} />
        </section>
      )}
      {upcoming.length > 0 && (
        <section aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading">Due in the next {days} days</h2>
          <EntryTable
            caption={`Items due in the next ${days} days, soonest first`}
            whenHeading="When"
            rows={upcoming}
          />
        </section>
      )}
      {waiting.length > 0 && (
        <section aria-labelledby="waiting-heading">
          <h2 id="waiting-heading">Waiting longest</h2>
          <EntryTable caption="Items waiting for someone, longest-waiting first" whenHeading="Waiting" rows={waiting} />
        </section>
      )}
    </main>
  );
}
