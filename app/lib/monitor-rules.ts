/**
 * What the hourly monitor counts as a problem, and when it tells the technical owner
 * (docs/phase-1a-defaults.md §7; app/lib/monitor.server.ts gathers the readings and sends).
 *
 * Two kinds of problem:
 * - **Ongoing** conditions (a high error rate, a failing or stalled scheduled job, unreadable
 *   Cloudflare figures) are alerted once when they start, reminded daily while they last, and
 *   reported again when they clear.
 * - **Events** (a failed email send, a Video Asset that failed processing) are each reported
 *   once, in the run after they happen: every run looks only at what happened since the run before.
 */

export const HOUR_MS = 3_600_000;

/** The scheduled jobs, by the name each records its runs under (job_run; workers/app.ts). */
export type JobName = "daily" | "usage" | "monitor";

export const MONITOR_THRESHOLDS = {
  /** Share of requests that failed since the last check, counted once there are `minErrors`. */
  errorShare: 0.05,
  minErrors: 10,
  /**
   * How long each watched job may go without running before that is a problem. The monitor
   * doesn't watch itself: the external uptime monitor is the backstop (runbook).
   */
  jobOverdueMs: {
    daily: 26 * HOUR_MS,
    usage: 26 * HOUR_MS,
  } satisfies Partial<Record<JobName, number>>,
  /** How often an ongoing problem is mentioned again while it lasts. */
  remindAfterMs: 24 * HOUR_MS,
};

export type WatchedJob = keyof typeof MONITOR_THRESHOLDS.jobOverdueMs;

/** The scheduled jobs the monitor expects to run. */
export const WATCHED_JOBS = Object.keys(MONITOR_THRESHOLDS.jobOverdueMs) as WatchedJob[];

export type JobRun = { startedAt: Date; ok: boolean; error: string | null };

export type Readings = {
  /** Requests to this Worker since the last check, from Cloudflare; null if unreadable. */
  requests: number | null;
  /** Requests the Worker answered with a 5xx or failed outright, since the last check. */
  serverErrors: number;
  failedEmails: number;
  failedVideoAssets: { id: string; reason: string | null }[];
  /** Each watched job's latest run; a job that has never run (a fresh deploy) has none. */
  jobs: { job: WatchedJob; lastRun: JobRun | null }[];
  /** Why Cloudflare's figures couldn't be read, where they should be; null when they could be. */
  figuresProblem: string | null;
};

export type CheckId = "errors" | "email" | "video" | "figures" | `job:${WatchedJob}`;

export type Problem = { check: CheckId; ongoing: boolean; summary: string };

/** An ongoing problem the monitor has already reported (the monitor_alert table). */
export type AlertState = { check: CheckId; failingSince: Date; lastAlertedAt: Date; summary: string };

/** A moment as the technical owner reads it in an email: UTC, to the minute. */
export const formatMoment = (at: Date) => `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`;

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** What the technical owner is told when an ongoing problem clears. */
const RECOVERED: Record<Exclude<CheckId, "email" | "video">, string> = {
  errors: "Requests are succeeding again.",
  figures: "Cloudflare's figures can be read again.",
  "job:daily": "The daily job is working again.",
  "job:usage": "The usage job is working again.",
};

function errorRateProblem({ requests, serverErrors }: Readings): Problem | null {
  if (serverErrors < MONITOR_THRESHOLDS.minErrors) return null;
  if (requests === null) {
    // Without Cloudflare's total, a run of failures is still worth knowing about.
    return { check: "errors", ongoing: true, summary: `${serverErrors} requests failed since the last check.` };
  }
  // The two counts come from different places, so the total can lag the failures slightly.
  const total = Math.max(requests, serverErrors);
  if (serverErrors < total * MONITOR_THRESHOLDS.errorShare) return null;
  const percent = Math.round((serverErrors / total) * 100);
  return {
    check: "errors",
    ongoing: true,
    summary: `${serverErrors} of ${total} requests failed (${percent}%) since the last check.`,
  };
}

export function findProblems(readings: Readings, now: Date): Problem[] {
  const problems: Problem[] = [];
  const errors = errorRateProblem(readings);
  if (errors) problems.push(errors);
  if (readings.failedEmails > 0) {
    problems.push({
      check: "email",
      ongoing: false,
      summary: `${plural(readings.failedEmails, "email", "emails")} couldn't be sent since the last check.`,
    });
  }
  if (readings.failedVideoAssets.length) {
    const lines = readings.failedVideoAssets.map((asset) => `  ${asset.id}: ${asset.reason ?? "no reason given"}`);
    problems.push({
      check: "video",
      ongoing: false,
      summary: [
        `${plural(readings.failedVideoAssets.length, "Video Asset", "Video Assets")} failed processing since the last check:`,
        ...lines,
      ].join("\n"),
    });
  }
  for (const { job, lastRun } of readings.jobs) {
    if (!lastRun) continue;
    if (!lastRun.ok) {
      problems.push({
        check: `job:${job}`,
        ongoing: true,
        summary: `The ${job} job failed at ${formatMoment(lastRun.startedAt)}: ${lastRun.error ?? "no reason given"}`,
      });
    } else if (now.getTime() - lastRun.startedAt.getTime() > MONITOR_THRESHOLDS.jobOverdueMs[job]) {
      problems.push({
        check: `job:${job}`,
        ongoing: true,
        summary: `The ${job} job hasn't run since ${formatMoment(lastRun.startedAt)}.`,
      });
    }
  }
  if (readings.figuresProblem) {
    problems.push({
      check: "figures",
      ongoing: true,
      summary: `Cloudflare's figures couldn't be read: ${readings.figuresProblem}`,
    });
  }
  return problems;
}

/**
 * What to tell the technical owner this run, and the ongoing problems to remember for the next.
 * New problems and daily reminders go in `failing`; problems that cleared go in `recovered`.
 */
export function alertPlan(problems: Problem[], previous: AlertState[], now: Date) {
  const failing: string[] = [];
  const state: AlertState[] = [];
  for (const problem of problems) {
    if (!problem.ongoing) {
      failing.push(problem.summary);
      continue;
    }
    const known = previous.find((alert) => alert.check === problem.check);
    if (!known) {
      failing.push(problem.summary);
      state.push({ check: problem.check, failingSince: now, lastAlertedAt: now, summary: problem.summary });
    } else if (now.getTime() - known.lastAlertedAt.getTime() >= MONITOR_THRESHOLDS.remindAfterMs) {
      failing.push(`${problem.summary} (still failing since ${formatMoment(known.failingSince)})`);
      state.push({ ...known, lastAlertedAt: now, summary: problem.summary });
    } else {
      state.push({ ...known, summary: problem.summary });
    }
  }
  const recovered = previous
    .filter((alert) => !problems.some((problem) => problem.check === alert.check))
    .map((alert) => RECOVERED[alert.check as keyof typeof RECOVERED]);
  return { failing, recovered, state };
}
