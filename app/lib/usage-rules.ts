import type { MediaUsage } from "./cloudflare-metrics.server";
import { DAY_MS } from "./rights-rules";

/**
 * The media cost report's arithmetic (VAC-10; docs/decision-log.md, cost envelope). An estimate
 * for watching the AUD 100 a month ceiling, not a bill: Cloudflare's invoice is the record.
 *
 * Covers the Workers Paid plan and what grows with media: Stream minutes stored and delivered,
 * and R2 storage. Workers requests, D1, Images and Containers stay within what the plan includes
 * at Phase 1a's size, so they aren't counted. Check the prices against Cloudflare's pricing pages
 * when reviewing the report (docs/handover/runbook.md, monitoring and alerts).
 */
export const PRICES_USD = {
  workersPaidMonthly: 5,
  streamStoredPer1000Minutes: 5,
  streamDeliveredPer1000Minutes: 1,
  r2PerGbMonth: 0.015,
  r2FreeGb: 10,
};

/** US dollars to Australian dollars, for comparing with the ceiling. Update it when it drifts. */
export const AUD_PER_USD = 1.55;

export const MONTHLY_CEILING_AUD = 100;

/** The budget alerts, as per cent of the ceiling the month is projected to reach. */
export const BUDGET_ALERT_PERCENTS = [50, 80] as const;

/** Cloudflare bills storage in decimal gigabytes. */
export const BYTES_PER_GB = 1e9;

/**
 * Delivery is projected from at least this much of the month, so one busy first day isn't taken
 * for the whole month's rate (and can't set off a budget alert on its own).
 */
const SHORTEST_PROJECTION_BASIS_MS = 3 * DAY_MS;

export const formatAud = (amount: number) => `AUD ${amount.toFixed(2)}`;
export const formatGigabytes = (bytes: number) => `${(bytes / BYTES_PER_GB).toFixed(1)} GB`;

/** The calendar month in UTC, as "2026-10". */
export const monthOf = (at: Date) => at.toISOString().slice(0, 7);

/** Midnight UTC on the first of `at`'s month. */
export const monthStart = (at: Date) => new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));

/** Rounded to a tenth of a cent, so the parts and the total agree. */
const roundUsd = (usd: number) => Math.round(usd * 1000) / 1000;

/**
 * The month's cost, projected to its end: storage at today's level for the whole month, delivery
 * at the rate so far (counted over at least the first three days).
 */
export function estimateMonth(usage: MediaUsage, now: Date) {
  const start = monthStart(now).getTime();
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const elapsed = Math.max(now.getTime() - start, SHORTEST_PROJECTION_BASIS_MS);
  const deliveredMinutesProjected = Math.round(usage.deliveredMinutes * ((end - start) / elapsed));
  const usd = {
    workers: PRICES_USD.workersPaidMonthly,
    streamStored: roundUsd((usage.storedMinutes / 1000) * PRICES_USD.streamStoredPer1000Minutes),
    streamDelivered: roundUsd((deliveredMinutesProjected / 1000) * PRICES_USD.streamDeliveredPer1000Minutes),
    r2: roundUsd(Math.max(usage.r2Bytes / BYTES_PER_GB - PRICES_USD.r2FreeGb, 0) * PRICES_USD.r2PerGbMonth),
    total: 0,
  };
  usd.total = roundUsd(usd.workers + usd.streamStored + usd.streamDelivered + usd.r2);
  const aud = usd.total * AUD_PER_USD;
  return { deliveredMinutesProjected, usd, aud, percentOfCeiling: Math.round((aud / MONTHLY_CEILING_AUD) * 100) };
}

/** The budget alert to send now, or null: the highest threshold reached that hasn't been sent this month. */
export function budgetAlertDue(percentOfCeiling: number, alreadySent: number) {
  const reached = BUDGET_ALERT_PERCENTS.filter((percent) => percentOfCeiling >= percent).at(-1);
  return reached !== undefined && reached > alreadySent ? reached : null;
}
