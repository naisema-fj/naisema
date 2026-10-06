import { desc, eq } from "drizzle-orm";
import { usageMonth } from "~db/schema";
import { adminUrl } from "./admin-url";
import type { PlatformMetrics } from "./cloudflare-metrics.server";
import type { Database } from "./db.server";
import { alertRecipients, sendToEach } from "./email.server";
import { activeHolders } from "./staff-roles.server";
import {
  budgetAlertDue,
  estimateMonth,
  formatAud,
  formatGigabytes,
  MONTHLY_CEILING_AUD,
  monthOf,
  monthStart,
} from "./usage-rules";

/**
 * The media cost report (VAC-10). The daily job reads the account's media usage from Cloudflare,
 * keeps the month's latest reading and projection (usage_month), and emails a budget alert the
 * first time the month is projected to pass 50%, and then 80%, of the ceiling.
 */

export type UsageMonth = typeof usageMonth.$inferSelect;

/** Records this month's usage. Does nothing where Cloudflare's figures aren't available. */
export async function recordUsage(env: Env, db: Database, metrics: PlatformMetrics | null, now: Date) {
  if (!metrics) return;
  const usage = await metrics.mediaUsage(monthStart(now), now);
  const estimate = estimateMonth(usage, now);
  const month = monthOf(now);
  const row = { ...usage, recordedAt: now };
  const [saved] = await db
    .insert(usageMonth)
    .values({ month, ...row })
    .onConflictDoUpdate({ target: usageMonth.month, set: row })
    .returning();

  const due = budgetAlertDue(estimate.percentOfCeiling, saved.budgetAlertPercent);
  if (due === null) return;
  const administrators = (await activeHolders(db, "administrator")).map((holder) => holder.email);
  const recipients = [...new Set([...alertRecipients(env), ...administrators])];
  const subject = `NAISEMA ${env.ENVIRONMENT}: media costs on course for ${due}% of the monthly ceiling`;
  const text = [
    `This month is projected to cost about ${formatAud(estimate.aud)}, ${estimate.percentOfCeiling}% of the ${formatAud(MONTHLY_CEILING_AUD)} ceiling.`,
    "",
    `Stream: ${Math.round(usage.storedMinutes)} minutes stored, ${Math.round(usage.deliveredMinutes)} delivered so far (about ${estimate.deliveredMinutesProjected} by the month's end).`,
    `R2: ${formatGigabytes(usage.r2Bytes)} stored.`,
    "",
    `The figures and how they are worked out: ${adminUrl(env, "/admin/usage")}`,
    "Cloudflare's billing page has the actual charges.",
  ].join("\n");
  // Sent to at least one person: don't send this level again this month.
  if ((await sendToEach(env, recipients, { subject, text })) > 0) {
    await db.update(usageMonth).set({ budgetAlertPercent: due }).where(eq(usageMonth.month, month));
  }
}

/** The last twelve months recorded, newest first, each with its cost worked out again. */
export async function usageReport(db: Database) {
  const months = await db.select().from(usageMonth).orderBy(desc(usageMonth.month)).limit(12);
  return months.map((month) => ({ ...month, estimate: estimateMonth(month, month.recordedAt) }));
}
