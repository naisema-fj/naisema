/**
 * The rules behind the staff dashboard (#56): how a wait, a due date and the last backup are put to
 * a person. The queries are app/lib/staff-dashboard.server.ts.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** How long something has been waiting for someone, in whole days. */
export function waitedText(since: Date, now: Date) {
  const days = Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY_MS));
  return days === 0 ? "waiting since today" : `waiting ${plural(days, "day", "days")}`;
}

/**
 * Due dates (YYYY-MM-DD) already past, and those falling today or in the next two days. Days are
 * Fiji's, as Submissions' due dates are set (app/lib/calendar.ts): `today` is Fiji's today.
 */
export function dueCounts(dueDates: string[], today: string) {
  const soonest = new Date(Date.parse(`${today}T00:00:00Z`) + 2 * DAY_MS).toISOString().slice(0, 10);
  return {
    overdue: dueDates.filter((due) => due < today).length,
    soon: dueDates.filter((due) => due >= today && due <= soonest).length,
  };
}

/** "The longest has been waiting 3 days.", for the oldest of some moments; null if there are none. */
export function longestWaitText(times: Date[], now: Date) {
  if (!times.length) return null;
  const oldest = new Date(Math.min(...times.map((time) => time.getTime())));
  return `The longest has been ${waitedText(oldest, now)}.`;
}

/** A backup that succeeded this long ago is overdue: the nightly one is late (the monitor allows 26 hours). */
const BACKUP_STALE_MS = 36 * HOUR_MS;

function ago(then: Date, now: Date) {
  const hours = Math.floor((now.getTime() - then.getTime()) / HOUR_MS);
  return hours < 24
    ? plural(Math.max(hours, 0), "hour", "hours") + " ago"
    : `${plural(Math.floor(hours / 24), "day", "days")} ago`;
}

/** The last backup run, put plainly; `ok` is false when it needs a person's attention. */
export function backupLine(run: { startedAt: Date; ok: boolean } | null, now: Date) {
  if (!run) return { ok: false, text: "No backup has run yet." };
  if (!run.ok) return { ok: false, text: `The last backup failed, ${ago(run.startedAt, now)}.` };
  const late = now.getTime() - run.startedAt.getTime() > BACKUP_STALE_MS;
  return {
    ok: !late,
    text: `The last backup succeeded ${ago(run.startedAt, now)}${late ? ", which is overdue" : ""}.`,
  };
}
