/**
 * What the hourly monitor counts as a problem, and when it tells the technical owner
 * (docs/phase-1a-defaults.md §7; app/lib/monitor.server.ts gathers the readings and sends).
 *
 * Two kinds of problem:
 * - **Ongoing** conditions (a high error rate, a failing or stalled scheduled job, unreadable
 *   Cloudflare figures) are alerted once when they start, reminded daily while they last, and
 *   reported again when they clear.
 * - **Events** (a failed email send, a video Stream couldn't process) are each reported once, in
 *   the run after they happen: every run looks only at what happened since the run before.
 */

const HOUR_MS = 3_600_000;

export const MONITOR_THRESHOLDS = {
  /** Share of requests that failed since the last check, counted once there are `minErrors`. */
  errorShare: 0.05,
  minErrors: 10,
  /** How long a scheduled job may go without running before that is a problem. */
  jobOverdueMs: {
    daily: 26 * HOUR_MS,
  } as Record<string, number>,
  /** How often an ongoing problem is mentioned again while it lasts. */
  remindAfterMs: 24 * HOUR_MS,
};

/** The scheduled jobs the monitor expects to run (workers/app.ts), by the name they record. */
export const WATCHED_JOBS = Object.keys(MONITOR_THRESHOLDS.jobOverdueMs);

export type JobRun = { startedAt: Date; ok: boolean; error: string | null };

export type Readings = {
  /** Requests and failed requests since the last check, from Cloudflare; null if unreadable. */
  requests: { requests: number; errors: number } | null;
  failedEmails: number;
  failedVideos: { id: string; reason: string | null }[];
  jobs: { job: string; lastRun: JobRun | null }[];
  /** Why Cloudflare's figures couldn't be read, where they should be; null when they could be. */
  figuresProblem: string | null;
};

export type CheckId = "errors" | "email" | "video" | "figures" | `job:${string}`;

export type Problem = { check: CheckId; ongoing: boolean; summary: string };

/** An ongoing problem the monitor has already reported (the monitor_alert table). */
export type AlertState = { check: CheckId; failingSince: Date; lastAlertedAt: Date; summary: string };

/** A moment as the technical owner reads it in an email: UTC, to the minute. */
export const formatMoment = (at: Date) => `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function findProblems(readings: Readings, now: Date): Problem[] {
  const problems: Problem[] = [];
  const { requests } = readings;
  if (
    requests &&
    requests.errors >= MONITOR_THRESHOLDS.minErrors &&
    requests.errors >= requests.requests * MONITOR_THRESHOLDS.errorShare
  ) {
    const percent = Math.round((requests.errors / requests.requests) * 100);
    problems.push({
      check: "errors",
      ongoing: true,
      summary: `${requests.errors} of ${requests.requests} requests failed (${percent}%) since the last check.`,
    });
  }
  if (readings.failedEmails > 0) {
    problems.push({
      check: "email",
      ongoing: false,
      summary: `${plural(readings.failedEmails, "email", "emails")} couldn't be sent since the last check.`,
    });
  }
  if (readings.failedVideos.length) {
    const lines = readings.failedVideos.map((video) => `  ${video.id}: ${video.reason ?? "no reason given"}`);
    problems.push({
      check: "video",
      ongoing: false,
      summary: [
        `${plural(readings.failedVideos.length, "video", "videos")} failed processing since the last check:`,
        ...lines,
      ].join("\n"),
    });
  }
  for (const { job, lastRun } of readings.jobs) {
    if (!lastRun) continue;
    const overdueMs = MONITOR_THRESHOLDS.jobOverdueMs[job];
    if (!lastRun.ok) {
      problems.push({
        check: `job:${job}`,
        ongoing: true,
        summary: `The ${job} job failed at ${formatMoment(lastRun.startedAt)}: ${lastRun.error ?? "no reason given"}`,
      });
    } else if (overdueMs !== undefined && now.getTime() - lastRun.startedAt.getTime() > overdueMs) {
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

function recoveredText(check: CheckId) {
  if (check === "errors") return "Requests are succeeding again.";
  if (check === "figures") return "Cloudflare's figures can be read again.";
  return `The ${check.slice("job:".length)} job is working again.`;
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
    .map((alert) => recoveredText(alert.check));
  return { failing, recovered, state };
}
