/**
 * The rules for Rights Records (CONTEXT.md, ADR-0007): which Permitted Uses exist, whether the
 * rights on an item are current enough to publish it, when expiry warnings are due, and which
 * evidence files are accepted. Pure, so every content type and the scheduled job share them.
 */

/** Each Permitted Use is granted separately; none implies another. */
export const PERMITTED_USES = [
  "publish",
  "excerpt",
  "translate",
  "transcribe",
  "educationalAdaptation",
  "commercial",
  "aiTraining",
] as const;
export type PermittedUse = (typeof PERMITTED_USES)[number];

export const isPermittedUse = (value: string): value is PermittedUse =>
  (PERMITTED_USES as readonly string[]).includes(value);

/** What the rules need to know about a Rights Record. */
export type RightsFacts = {
  id: string;
  permittedUses: PermittedUse[];
  /** The record is documented permission from the guardian of children who can be identified. */
  guardianPermission: boolean;
  expiresAt: Date | null;
  withdrawnAt: Date | null;
};

/** Current: not withdrawn, and not yet expired. A record expiring at this very moment has expired. */
export const isCurrent = (record: RightsFacts, now: Date) =>
  record.withdrawnAt === null && (record.expiresAt === null || record.expiresAt > now);

const grantsPublish = (record: RightsFacts) => record.permittedUses.includes("publish");

export const DAY_MS = 86_400_000;

/** A day as staff read it in rights pages and emails: "30 Sept 2026" (UTC). */
export const formatDay = (date: Date | string) =>
  new Date(date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Why an item's rights don't allow publishing right now, or nothing if they do. Evaluated at the
 * moment of asking, so an expiry or withdrawal takes effect on the next request (ADR-0007).
 */
export function rightsProblems(input: {
  records: RightsFacts[];
  needsGuardianPermission: boolean;
  now: Date;
}): string[] {
  const { now } = input;
  const publishable = input.records.filter(grantsPublish);
  const problems: string[] = [];

  if (!publishable.some((record) => isCurrent(record, now))) {
    const latest = publishable.at(-1);
    if (latest?.withdrawnAt) problems.push("Its Rights Record granting Publish was withdrawn.");
    else if (latest?.expiresAt) {
      problems.push(`Its Rights Record granting Publish expired on ${formatDay(latest.expiresAt)}.`);
    } else problems.push("No current Rights Record grants Publish.");
  }
  if (
    input.needsGuardianPermission &&
    !publishable.some((record) => record.guardianPermission && isCurrent(record, now))
  ) {
    problems.push("Identifiable children need current, documented guardian permission granting Publish.");
  }
  return problems;
}

/** Warnings go out as a record enters each window before it expires, tightest first. */
export const EXPIRY_WARNING_DAYS = [7, 30] as const;
export type ExpiryWarning = { recordId: string; withinDays: (typeof EXPIRY_WARNING_DAYS)[number] };

/**
 * The expiry warnings to send today: for each current record expiring within 30 days, the
 * tightest window it is in, unless that warning was already sent. A record found first at 5 days
 * gets one 7-day warning, not two.
 */
export function expiryWarningsDue(input: {
  records: RightsFacts[];
  sent: ExpiryWarning[];
  now: Date;
}): ExpiryWarning[] {
  const sent = new Set(input.sent.map((warning) => `${warning.recordId}:${warning.withinDays}`));
  return input.records.flatMap((record) => {
    if (!record.expiresAt || !isCurrent(record, input.now)) return [];
    const daysLeft = (record.expiresAt.getTime() - input.now.getTime()) / DAY_MS;
    const withinDays = EXPIRY_WARNING_DAYS.find((window) => daysLeft <= window);
    if (!withinDays || sent.has(`${record.id}:${withinDays}`)) return [];
    return [{ recordId: record.id, withinDays }];
  });
}
