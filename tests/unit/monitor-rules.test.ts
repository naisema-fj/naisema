import { describe, expect, it } from "vitest";
import { type AlertState, alertPlan, findProblems, type Problem, type Readings } from "~/lib/monitor-rules";

const HOUR = 3_600_000;
const now = new Date("2026-10-05T10:05:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

const healthy: Readings = {
  requests: 2_000,
  serverErrors: 3,
  failedEmails: 0,
  failedVideoAssets: [],
  jobs: [{ job: "daily", lastRun: { startedAt: ago(5 * HOUR), ok: true, error: null } }],
  figuresProblem: null,
};

describe("findProblems", () => {
  it("finds nothing when everything is within its threshold", () => {
    expect(findProblems(healthy, now)).toEqual([]);
  });

  it("reports an error rate of 5% or more, once there are at least 10 failed requests", () => {
    expect(findProblems({ ...healthy, requests: 200, serverErrors: 10 }, now)).toEqual([
      { check: "errors", ongoing: true, summary: "10 of 200 requests failed (5%) since the last check." },
    ]);
    // A handful of errors on a quiet site is not an outage.
    expect(findProblems({ ...healthy, requests: 20, serverErrors: 9 }, now)).toEqual([]);
    expect(findProblems({ ...healthy, requests: 1_000, serverErrors: 49 }, now)).toEqual([]);
  });

  it("still reports a run of failed requests when Cloudflare's total can't be read", () => {
    expect(
      findProblems({ ...healthy, requests: null, serverErrors: 12, figuresProblem: "The token was refused." }, now),
    ).toEqual([
      { check: "errors", ongoing: true, summary: "12 requests failed since the last check." },
      { check: "figures", ongoing: true, summary: "Cloudflare's figures couldn't be read: The token was refused." },
    ]);
  });

  it("reports every failed email send and every Video Asset that failed processing", () => {
    const problems = findProblems(
      {
        ...healthy,
        failedEmails: 2,
        failedVideoAssets: [{ id: "v1", reason: "The file was not recognized as a video." }],
      },
      now,
    );
    expect(problems).toEqual([
      { check: "email", ongoing: false, summary: "2 emails couldn't be sent since the last check." },
      {
        check: "video",
        ongoing: false,
        summary: "1 Video Asset failed processing since the last check:\n  v1: The file was not recognized as a video.",
      },
    ]);
  });

  it("reports a scheduled job whose last run failed, or that hasn't run for longer than expected", () => {
    const failed = findProblems(
      { ...healthy, jobs: [{ job: "daily", lastRun: { startedAt: ago(HOUR), ok: false, error: "D1 timeout" } }] },
      now,
    );
    expect(failed).toEqual([
      { check: "job:daily", ongoing: true, summary: "The daily job failed at 2026-10-05 09:05 UTC: D1 timeout" },
    ]);
    const stale = findProblems(
      { ...healthy, jobs: [{ job: "daily", lastRun: { startedAt: ago(27 * HOUR), ok: true, error: null } }] },
      now,
    );
    expect(stale).toEqual([
      { check: "job:daily", ongoing: true, summary: "The daily job hasn't run since 2026-10-04 07:05 UTC." },
    ]);
  });

  it("says nothing about a job that has never run, as on a fresh deploy", () => {
    expect(findProblems({ ...healthy, jobs: [{ job: "daily", lastRun: null }] }, now)).toEqual([]);
  });

  it("reports when Cloudflare's figures can't be read, so the error-rate check isn't silently off", () => {
    expect(findProblems({ ...healthy, requests: null, figuresProblem: "The token was refused." }, now)).toEqual([
      { check: "figures", ongoing: true, summary: "Cloudflare's figures couldn't be read: The token was refused." },
    ]);
  });
});

describe("alertPlan", () => {
  const errors: Problem = {
    check: "errors",
    ongoing: true,
    summary: "10 of 200 requests failed (5%) since the last check.",
  };
  const email: Problem = { check: "email", ongoing: false, summary: "1 email couldn't be sent since the last check." };

  it("alerts on a new problem and starts remembering it", () => {
    const plan = alertPlan([errors], [], now);
    expect(plan.failing).toEqual([errors.summary]);
    expect(plan.recovered).toEqual([]);
    expect(plan.state).toEqual([{ check: "errors", failingSince: now, lastAlertedAt: now, summary: errors.summary }]);
  });

  it("stays quiet about a problem it already reported, until a day has passed", () => {
    const earlier: AlertState[] = [
      { check: "errors", failingSince: ago(5 * HOUR), lastAlertedAt: ago(5 * HOUR), summary: "old" },
    ];
    const quiet = alertPlan([errors], earlier, now);
    expect(quiet.failing).toEqual([]);
    expect(quiet.state).toEqual([
      { check: "errors", failingSince: ago(5 * HOUR), lastAlertedAt: ago(5 * HOUR), summary: errors.summary },
    ]);

    const reminder = alertPlan(
      [errors],
      [{ check: "errors", failingSince: ago(25 * HOUR), lastAlertedAt: ago(24 * HOUR), summary: "old" }],
      now,
    );
    expect(reminder.failing).toEqual([`${errors.summary} (still failing since 2026-10-04 09:05 UTC)`]);
    expect(reminder.state[0].lastAlertedAt).toEqual(now);
  });

  it("says when a reported problem has cleared, and forgets it", () => {
    const plan = alertPlan(
      [],
      [{ check: "job:daily", failingSince: ago(3 * HOUR), lastAlertedAt: ago(3 * HOUR), summary: "x" }],
      now,
    );
    expect(plan.failing).toEqual([]);
    expect(plan.recovered).toEqual(["The daily job is working again."]);
    expect(plan.state).toEqual([]);
  });

  it("reports each failed send or video once, as it happens, without remembering it", () => {
    const plan = alertPlan([email], [], now);
    expect(plan.failing).toEqual([email.summary]);
    expect(plan.state).toEqual([]);
    expect(alertPlan([], [], now)).toEqual({ failing: [], recovered: [], state: [] });
  });
});
