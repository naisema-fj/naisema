import { CASE_KINDS } from "./case-rules";
import { type Actor, type CaseKind, can } from "./permissions";
import { DAY_MS } from "./rights-rules";
import { waitedText } from "./staff-dashboard";

/**
 * The rules behind "What's coming up" (#59): which range is shown, how a day and a wait are put,
 * and how entries from different places are ordered. The queries are app/lib/staff-schedule.server.ts.
 * Days are Fiji's (app/lib/calendar.ts), as Submissions' due dates and Rights Records are kept.
 */

export const RANGES = [7, 30, 90] as const;
export const DEFAULT_DAYS = 30;

/** The range asked for, if it is one that is offered; otherwise the default. */
export function rangeDays(raw: string | null) {
  const asked = Number(raw);
  return (RANGES as readonly number[]).includes(asked) ? asked : DEFAULT_DAYS;
}

/** The last day of a range of days from today, as YYYY-MM-DD: the next 30 days end 30 days from today. */
export function lastDayOf(today: string, days: number) {
  return new Date(Date.parse(`${today}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** A Fiji day as a person reads it: "Monday 19 October 2026". */
export const dayText = (date: string) =>
  new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** How far a day is from today, in words. */
export function dueText(date: string, today: string) {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return days > 0 ? `due in ${days} days` : `overdue by ${plural(-days, "day", "days")}`;
}

export type ScheduleKind = "rights" | "submission" | "case" | "review";

/** One line of the schedule: a day something is due, or the moment it started waiting, never both. */
export type ScheduleEntry = {
  key: string;
  kind: ScheduleKind;
  title: string;
  /** What kind of thing it is, and what is needed, in plain words; never what a Case or Submission says. */
  detail: string | null;
  /** The Fiji day it is due, YYYY-MM-DD; null for something that is only waiting. */
  date: string | null;
  /** When it started waiting for someone; null for something with a due day. */
  since: Date | null;
  href: string;
};

const byTitle = (a: ScheduleEntry, b: ScheduleEntry) => a.title.localeCompare(b.title);

/**
 * Dated entries split into overdue and coming up within the range, each soonest first; entries
 * that are only waiting, longest-waiting first. A wait is as of now, so the range does not limit it.
 */
export function arrangeSchedule(entries: ScheduleEntry[], today: string, days: number) {
  const last = lastDayOf(today, days);
  const dated = entries.filter((entry): entry is ScheduleEntry & { date: string } => entry.date !== null);
  const byDay = (a: ScheduleEntry & { date: string }, b: ScheduleEntry & { date: string }) =>
    a.date.localeCompare(b.date) || byTitle(a, b);
  return {
    overdue: dated.filter((entry) => entry.date < today).sort(byDay),
    upcoming: dated.filter((entry) => entry.date >= today && entry.date <= last).sort(byDay),
    waiting: entries
      .filter((entry) => entry.date === null && entry.since !== null)
      .sort((a, b) => (a.since as Date).getTime() - (b.since as Date).getTime() || byTitle(a, b)),
  };
}

/** How long an entry has been waiting, in the dashboard's words. */
export const waitText = (entry: ScheduleEntry, now: Date) => (entry.since ? waitedText(entry.since, now) : null);

/** The kinds of thing this person's schedule covers, from the same rules as the pages they open. */
export function scheduleKinds(actor: Actor) {
  const handlesCases = (Object.keys(CASE_KINDS) as CaseKind[]).some((kind) =>
    can(actor, { action: "case.read", case: { kind } }),
  );
  return [
    can(actor, { action: "rights.manage" }) && "Rights Records about to expire",
    can(actor, { action: "submission.manage" }) && "Submission due dates",
    handlesCases && "Cases waiting to be triaged or to have an appeal decided",
    (can(actor, { action: "content.edit" }) || can(actor, { action: "reviewQueue.view" })) &&
      "Reviews that are waiting",
  ].filter((kind): kind is string => kind !== false);
}
