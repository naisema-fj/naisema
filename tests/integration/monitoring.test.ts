import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { PlatformMetrics } from "~/lib/cloudflare-metrics.server";
import { getDb } from "~/lib/db.server";
import { sendEmail } from "~/lib/email.server";
import { runJob, runMonitor } from "~/lib/monitor.server";
import { scanUpload } from "~/lib/scan.server";
import { localProvider } from "~/lib/video-provider.server";
import { mp4 } from "../fixtures/mp4";
import { staff } from "./support/articles";
import { completeUpload, sendPart, startUpload } from "./support/media";
import { emailsTo } from "./support/staff";
import { cleanScanner } from "./support/video";

const HOUR = 3_600_000;
const owner = env.ALERT_EMAILS as string;

/** Cloudflare's request count, as the monitor would read it. */
const figures = (requests: number): PlatformMetrics => ({
  workerRequests: async () => requests,
  mediaUsage: async () => ({ storedMinutes: 0, deliveredMinutes: 0, r2Bytes: 0 }),
});
const healthy = figures(1_000);

/** Requests the Worker answered with a 5xx at `at`, as it records them (workers/app.ts). */
async function failRequests(count: number, at: number) {
  const insert = env.DB.prepare("INSERT INTO server_error (failed_at) VALUES (?1)").bind(at);
  await env.DB.batch(Array.from({ length: count }, () => insert));
}

/** What the Worker's hourly cron runs (workers/app.ts). */
const hourly = (at: number, metrics: PlatformMetrics | null = healthy, onEnv: Env = env) =>
  runMonitor(onEnv, new Date(at), metrics);

const alerts = async () => (await emailsTo(owner)).filter((email) => email.subject.startsWith("Na iSema"));

beforeEach(async () => {
  await env.DB.batch(
    ["monitor_alert", "job_run", "email_failure", "server_error"].map((table) =>
      env.DB.prepare(`DELETE FROM ${table}`),
    ),
  );
  await env.DB.prepare('DELETE FROM email_outbox WHERE "to" = ?1').bind(owner).run();
});

describe("the hourly monitor", () => {
  it("sends nothing while everything is healthy", async () => {
    const now = Date.now();
    await hourly(now);
    await hourly(now + HOUR);
    expect(await alerts()).toEqual([]);
  });

  it("reports a failed email send once, by its subject only", async () => {
    const now = Date.now();
    await hourly(now);
    const broken = { ...env, EMAIL_OUTBOX: "false" } as unknown as Env;
    await expect(
      sendEmail(broken, { to: "sera@example.com", subject: "Sign in to Na iSema", text: "secret link" }),
    ).rejects.toThrow();

    await hourly(now + HOUR);
    await hourly(now + 2 * HOUR);

    const sent = await alerts();
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("Na iSema development: 1 problem");
    expect(sent[0].text).toContain("1 email couldn't be sent since the last check.");
    expect(sent[0].text).not.toContain("sera@example.com");
    expect(sent[0].text).not.toContain("secret link");
  });

  it("alerts on a high error rate once, stays quiet while it lasts, and says when it clears", async () => {
    const now = Date.now();
    await failRequests(60, now - 1000);
    await hourly(now, figures(400));
    await failRequests(55, now + HOUR - 1000);
    await hourly(now + HOUR, figures(400));
    await hourly(now + 2 * HOUR, figures(400));

    const sent = await alerts();
    expect(sent.map((email) => email.subject)).toEqual([
      "Na iSema development: 1 problem",
      "Na iSema development: back to normal",
    ]);
    expect(sent[0].text).toContain("60 of 400 requests failed (15%) since the last check.");
    expect(sent[1].text).toContain("Requests are succeeding again.");
  });

  it("reminds the technical owner daily while a problem lasts", async () => {
    const now = Date.now();
    for (let hour = 0; hour <= 25; hour++) {
      await failRequests(60, now + hour * HOUR - 1000);
      await hourly(now + hour * HOUR, figures(400));
    }
    expect((await alerts()).map((email) => email.subject)).toEqual([
      "Na iSema development: 1 problem",
      "Na iSema development: 1 problem",
    ]);
    expect((await alerts())[1].text).toContain("still failing since");
  });

  it("counts failed requests even where Cloudflare's total can't be read", async () => {
    const now = Date.now();
    await failRequests(12, now - 1000);
    await hourly(now, null);
    const [alert] = await alerts();
    expect(alert.text).toContain("12 requests failed since the last check.");
  });

  it("reports a Video Asset Stream couldn't process, with its ID and Stream's reason", async () => {
    const now = Date.now();
    await hourly(now - HOUR);
    const educator = await staff("educator", { role: "educator" });
    const bytes = mp4({ seconds: 30 });
    const started = await startUpload(educator.browser, {
      name: "lovo.mp4",
      type: "video/mp4",
      size: bytes.length,
      head: bytes,
    });
    const { id } = (await started.json()) as { id: string };
    await sendPart(educator.browser, id, 1, bytes);
    await completeUpload(educator.browser, id);
    const refusing = {
      ...localProvider(env),
      copy: async () => ({
        providerId: `refused-${id}`,
        update: { state: "failed" as const, reason: "The file was not recognized as a video.", durationMs: null },
      }),
    };
    await scanUpload(env, getDb(env.DB), id, cleanScanner, refusing);

    await hourly(Date.now() + 1000);

    const [alert] = await alerts();
    expect(alert.text).toContain("1 Video Asset failed processing since the last check:");
    expect(alert.text).toContain(`${id}: The file was not recognized as a video.`);
  });

  it("reports a scheduled job that failed, and when it works again", async () => {
    const now = Date.now();
    const db = getDb(env.DB);
    await expect(
      runJob(db, "daily", new Date(now), async () => {
        throw new Error("D1 was unavailable for sera@example.com");
      }),
    ).rejects.toThrow();

    await hourly(now + HOUR);
    await runJob(db, "daily", new Date(now + 24 * HOUR), async () => {});
    await hourly(now + 25 * HOUR);

    const sent = await alerts();
    expect(sent[0].text).toContain("The daily job failed at");
    expect(sent[0].text).toContain("D1 was unavailable for [email]");
    expect(sent[1].text).toContain("The daily job is working again.");
  });

  it("reports that Cloudflare's figures can't be read where the monitoring token isn't set", async () => {
    const now = Date.now();
    await hourly(now);
    await hourly(now + HOUR, null, { ...env, ENVIRONMENT: "staging" } as unknown as Env);
    const alert = (await alerts()).at(-1) as { subject: string; text: string };
    expect(alert.subject).toBe("Na iSema staging: 1 problem");
    expect(alert.text).toContain("Cloudflare's figures couldn't be read: MONITORING_API_TOKEN isn't set");
  });
});
