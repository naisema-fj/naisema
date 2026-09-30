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

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

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
      problems.push(`Its Rights Record granting Publish expired on ${formatDate(latest.expiresAt)}.`);
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

const DAY_MS = 86_400_000;

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

export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;

export type EvidenceType = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

/**
 * The type of an evidence file, read from its first bytes rather than its name or declared type,
 * or null if it isn't one of the accepted kinds (docs/phase-1a-defaults.md §1).
 */
export function evidenceTypeOf(bytes: Uint8Array): EvidenceType | null {
  const startsWith = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const ascii = (from: number, text: string) =>
    [...text].every((char, index) => bytes[from + index] === char.charCodeAt(0));
  if (ascii(0, "%PDF-")) return "application/pdf";
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  return null;
}
