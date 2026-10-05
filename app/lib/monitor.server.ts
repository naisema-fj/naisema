import { and, count, desc, eq, gte, lt } from "drizzle-orm";
import { emailFailure, jobRun, monitorAlert, videoAsset } from "~db/schema";
import { adminUrl } from "./admin-url";
import { MetricsError, type PlatformMetrics, platformMetrics } from "./cloudflare-metrics.server";
import type { Database } from "./db.server";
import { getDb } from "./db.server";
import { sendEmail } from "./email.server";
import { logError, redact } from "./log.server";
import { type AlertState, alertPlan, findProblems, type JobRun, type Readings, WATCHED_JOBS } from "./monitor-rules";

/**
 * The hourly monitor (docs/phase-1a-defaults.md §7): reads what happened since its last run,
 * decides what counts as a problem (monitor-rules.ts) and emails the technical owner
 * (ALERT_EMAILS). Uptime is watched from outside Cloudflare instead (ADR-0012).
 */

const HOUR_MS = 3_600_000;
/** However long ago the last run was, look back at most this far, so a long gap can't flood an email. */
const LONGEST_WINDOW_MS = 24 * HOUR_MS;

/**
 * Runs a scheduled job and records the run (job_run), so the monitor sees a run that failed and a
 * job that stopped running. A failure is recorded redacted and thrown on, so the cron run shows
 * as failed too.
 */
export async function runJob(db: Database, job: string, now: Date, work: () => Promise<void>) {
  const id = crypto.randomUUID();
  await db.insert(jobRun).values({ id, job, startedAt: now });
  try {
    await work();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await db
      .update(jobRun)
      .set({ ok: false, finishedAt: new Date(), error: String(redact(reason)).slice(0, 500) })
      .where(eq(jobRun.id, id));
    throw error;
  }
  await db.update(jobRun).set({ ok: true, finishedAt: new Date() }).where(eq(jobRun.id, id));
}

/** Where the last successful check started, so each failure is reported in exactly one run. */
async function lastCheck(db: Database, now: Date) {
  const last = await db
    .select({ startedAt: jobRun.startedAt })
    .from(jobRun)
    .where(and(eq(jobRun.job, "monitor"), eq(jobRun.ok, true), lt(jobRun.startedAt, now)))
    .orderBy(desc(jobRun.startedAt))
    .limit(1)
    .get();
  const earliest = now.getTime() - LONGEST_WINDOW_MS;
  return new Date(Math.max(last?.startedAt.getTime() ?? now.getTime() - HOUR_MS, earliest));
}

async function readRequests(env: Env, metrics: PlatformMetrics | null, since: Date, now: Date) {
  if (!metrics) {
    // Local development and tests have no Cloudflare figures; a deployed environment should.
    return env.ENVIRONMENT === "development"
      ? { requests: null, figuresProblem: null }
      : {
          requests: null,
          figuresProblem: "MONITORING_API_TOKEN isn't set in this environment, so the error rate isn't being checked.",
        };
  }
  try {
    return { requests: await metrics.workerRequests(since, now), figuresProblem: null };
  } catch (error) {
    if (!(error instanceof MetricsError)) throw error;
    return { requests: null, figuresProblem: error.message };
  }
}

async function lastRuns(db: Database) {
  return Promise.all(
    WATCHED_JOBS.map(async (job) => {
      const run = await db
        .select()
        .from(jobRun)
        .where(eq(jobRun.job, job))
        .orderBy(desc(jobRun.startedAt))
        .limit(1)
        .get();
      // A run still under way (or that died part-way) counts as not failed; if it never
      // finishes, the job going overdue is reported instead.
      const lastRun: JobRun | null = run ? { startedAt: run.startedAt, ok: run.ok !== false, error: run.error } : null;
      return { job, lastRun };
    }),
  );
}

async function gatherReadings(
  env: Env,
  db: Database,
  metrics: PlatformMetrics | null,
  since: Date,
  now: Date,
): Promise<Readings> {
  const [{ failedEmails }] = await db
    .select({ failedEmails: count() })
    .from(emailFailure)
    .where(and(gte(emailFailure.failedAt, since), lt(emailFailure.failedAt, now)));
  const failedVideos = await db
    .select({ id: videoAsset.id, reason: videoAsset.stateReason })
    .from(videoAsset)
    .where(and(eq(videoAsset.state, "failed"), gte(videoAsset.updatedAt, since), lt(videoAsset.updatedAt, now)));
  return {
    ...(await readRequests(env, metrics, since, now)),
    failedEmails,
    failedVideos,
    jobs: await lastRuns(db),
  };
}

/** Everyone ALERT_EMAILS names (a comma-separated list). */
export const alertRecipients = (env: Env) =>
  (env.ALERT_EMAILS ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

async function sendAlert(env: Env, plan: { failing: string[]; recovered: string[] }) {
  const subject = plan.failing.length
    ? `Na iSema ${env.ENVIRONMENT}: ${plan.failing.length} ${plan.failing.length === 1 ? "problem" : "problems"}`
    : `Na iSema ${env.ENVIRONMENT}: back to normal`;
  const text = [
    ...(plan.failing.length ? ["These need attention:", "", ...plan.failing.map((line) => `- ${line}`), ""] : []),
    ...(plan.recovered.length ? ["Back to normal:", "", ...plan.recovered.map((line) => `- ${line}`), ""] : []),
    `What each alert means and what to check: docs/handover/runbook.md, "Monitoring and alerts".`,
    `Usage, cost and the monitor's current problems: ${adminUrl(env, "/admin/usage")}`,
  ].join("\n");
  const recipients = alertRecipients(env);
  if (!recipients.length) {
    logError("No one to alert: ALERT_EMAILS isn't set", { subject, text });
    return;
  }
  const results = await Promise.allSettled(recipients.map((to) => sendEmail(env, { to, subject, text })));
  const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
  // If nobody could be told, the problems stay unreported and the next run tries again.
  if (failures.length === recipients.length) throw new AggregateError(failures, "No alert email could be sent");
}

async function saveState(db: Database, state: AlertState[]) {
  await db.batch([db.delete(monitorAlert), ...state.map((alert) => db.insert(monitorAlert).values(alert))]);
}

/** The ongoing problems the monitor has reported and that haven't cleared, for the usage page. */
export const currentProblems = (db: Database) => db.select().from(monitorAlert).orderBy(monitorAlert.failingSince);

/** The hourly check. `metrics` defaults to this environment's Cloudflare figures. */
export async function runMonitor(env: Env, now: Date, metrics: PlatformMetrics | null = platformMetrics(env)) {
  const db = getDb(env.DB);
  await runJob(db, "monitor", now, async () => {
    const since = await lastCheck(db, now);
    const problems = findProblems(await gatherReadings(env, db, metrics, since, now), now);
    const plan = alertPlan(problems, await db.select().from(monitorAlert), now);
    if (plan.failing.length || plan.recovered.length) await sendAlert(env, plan);
    await saveState(db, plan.state);
  });
}
