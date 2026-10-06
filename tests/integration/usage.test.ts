import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { MediaUsage, PlatformMetrics } from "~/lib/cloudflare-metrics.server";
import { getDb } from "~/lib/db.server";
import { recordUsage } from "~/lib/usage.server";
import { staff } from "./support/articles";
import { emailsTo } from "./support/staff";

const owner = env.ALERT_EMAILS as string;

const reading = (usage: Partial<MediaUsage>): PlatformMetrics => ({
  workerRequests: async () => 0,
  mediaUsage: async () => ({ storedMinutes: 0, deliveredMinutes: 0, r2Bytes: 0, ...usage }),
});

/** The daily job's last step (workers/app.ts). */
const daily = (at: string, metrics: PlatformMetrics | null) => recordUsage(env, getDb(env.DB), metrics, new Date(at));

const budgetAlerts = async (address: string) =>
  (await emailsTo(address)).filter((email) => email.subject.includes("of the monthly ceiling"));

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM usage_month").run();
  await env.DB.prepare('DELETE FROM email_outbox WHERE "to" = ?1').bind(owner).run();
});

describe("the media cost report", () => {
  it("shows administrators this month's usage and projected cost", async () => {
    const administrator = await staff("admin", { role: "administrator" });
    await daily("2026-10-11T00:00:00Z", reading({ storedMinutes: 2_000, deliveredMinutes: 1_000, r2Bytes: 25e9 }));

    const page = await administrator.browser.fetch("/admin/usage");
    expect(page.status).toBe(200);
    // The page's words, without React's text separators.
    const html = (await page.text()).replaceAll("<!-- -->", "");
    expect(html).toContain("2026-10");
    expect(html).toContain("2,000");
    expect(html).toContain("1,000 so far, about 3,100");
    expect(html).toContain("25.0 GB");
    // USD 5 + 10 + 3.10 + 0.225 = 18.325, at 1.55 AUD per USD.
    expect(html).toContain("AUD 28.40");
    expect(html).toContain("AUD 28.40 (28% of the ceiling)");
  });

  it("is for administrators only", async () => {
    const editor = await staff("editor", { role: "editor" });
    expect((await editor.browser.fetch("/admin/usage")).status).toBe(403);
  });

  it("says so where Cloudflare's figures aren't read, and records nothing", async () => {
    const administrator = await staff("admin", { role: "administrator" });
    await daily("2026-10-11T00:00:00Z", null);
    const html = await (await administrator.browser.fetch("/admin/usage")).text();
    expect(html).toContain("MONITORING_API_TOKEN isn&#x27;t set");
    expect(html).toContain("No usage has been recorded yet.");
  });

  it("emails a budget alert once at 50% of the ceiling, and again at 80%", async () => {
    const administrator = await staff("admin", { role: "administrator" });
    const address = (
      (await env.DB.prepare("SELECT email FROM user WHERE id = ?1")
        .bind(administrator.userId)
        .first<{ email: string }>()) as { email: string }
    ).email;

    await daily("2026-10-11T00:00:00Z", reading({ storedMinutes: 1_000 }));
    // USD 5 + 30 = 35, about AUD 54: past half the ceiling.
    await daily("2026-10-12T00:00:00Z", reading({ storedMinutes: 6_000 }));
    await daily("2026-10-13T00:00:00Z", reading({ storedMinutes: 6_500 }));
    // USD 5 + 50 = 55, about AUD 85.
    await daily("2026-10-14T00:00:00Z", reading({ storedMinutes: 10_000 }));
    await daily("2026-10-15T00:00:00Z", reading({ storedMinutes: 10_000 }));

    const subjects = (await budgetAlerts(owner)).map((email) => email.subject);
    expect(subjects).toEqual([
      "NAISEMA development: media costs on course for 50% of the monthly ceiling",
      "NAISEMA development: media costs on course for 80% of the monthly ceiling",
    ]);
    expect(await budgetAlerts(address)).toHaveLength(2);
    expect((await budgetAlerts(owner))[0].text).toContain("6000 minutes stored");
  });

  it("starts each month's budget alerts afresh", async () => {
    await daily("2026-10-20T00:00:00Z", reading({ storedMinutes: 6_000 }));
    await daily("2026-11-02T00:00:00Z", reading({ storedMinutes: 6_000 }));
    expect(await budgetAlerts(owner)).toHaveLength(2);
  });
});
