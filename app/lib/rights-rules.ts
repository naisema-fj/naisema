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

/**
 * The parts of an item that can carry their own Rights Records, apart from the item as a whole: a
 * speaker or guest, a piece of music, an archive clip (Voices Episodes, PRD §04).
 */
export const RIGHTS_PART_KINDS = ["speaker", "music", "archive"] as const;
export type RightsPartKind = (typeof RIGHTS_PART_KINDS)[number];
export type RightsPart = { kind: RightsPartKind; name: string };

export const RIGHTS_PART_NAMES: Record<RightsPartKind, string> = {
  speaker: "speaker or guest",
  music: "music",
  archive: "archive clip",
};

export const isRightsPartKind = (value: string): value is RightsPartKind =>
  (RIGHTS_PART_KINDS as readonly string[]).includes(value);

/** What the rules need to know about a Rights Record. */
export type RightsFacts = {
  id: string;
  /** The part of the item it covers; absent or null for the item as a whole. */
  part?: RightsPart | null;
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

/** The same part, however its name was spaced or capitalised. */
const partKey = (part: RightsPart) => `${part.kind}|${part.name.trim().toLowerCase()}`;

/**
 * Why an item's rights don't allow publishing right now, or nothing if they do. Evaluated at the
 * moment of asking, so an expiry or withdrawal takes effect on the next request (ADR-0007).
 *
 * The item needs a current record granting Publish. `parts` are the parts the Revision itself
 * lists (an Episode's speakers, music and archive clips): each of those with records of its own
 * needs one of them current too. Records for parts the Revision doesn't list are set aside, so
 * cutting a clip from an Episode also lifts its rights.
 */
export function rightsProblems(input: {
  records: RightsFacts[];
  needsGuardianPermission: boolean;
  parts?: RightsPart[];
  now: Date;
}): string[] {
  const { now } = input;
  const present = new Map((input.parts ?? []).map((part) => [partKey(part), part]));
  const problems: string[] = [];

  const whole = input.records.filter((record) => !record.part);
  const lapse = lapseOf(whole, now);
  if (lapse === "withdrawn") problems.push("Its Rights Record granting Publish was withdrawn.");
  else if (lapse === "none") problems.push("No current Rights Record grants Publish.");
  else if (lapse) problems.push(`Its Rights Record granting Publish expired on ${formatDay(lapse)}.`);

  const byPart = new Map<string, RightsFacts[]>();
  for (const record of input.records) {
    const key = record.part && partKey(record.part);
    if (key && present.has(key)) byPart.set(key, [...(byPart.get(key) ?? []), record]);
  }
  for (const [key, records] of byPart) {
    const part = present.get(key) as RightsPart;
    const label = `${RIGHTS_PART_NAMES[part.kind]}: ${part.name.trim()}`;
    const partLapse = lapseOf(records, now);
    if (partLapse === "withdrawn") problems.push(`The Rights Record for ${label} was withdrawn.`);
    else if (partLapse === "none") problems.push(`No current Rights Record for ${label} grants Publish.`);
    else if (partLapse) problems.push(`The Rights Record for ${label} expired on ${formatDay(partLapse)}.`);
  }

  // Guardian permission comes with the item's own record or a listed speaker's, never with music.
  const guardianRecords = input.records.filter(
    (record) => !record.part || (record.part.kind === "speaker" && present.has(partKey(record.part))),
  );
  if (
    input.needsGuardianPermission &&
    !guardianRecords.some((record) => grantsPublish(record) && record.guardianPermission && isCurrent(record, now))
  ) {
    problems.push("Identifiable children need current, documented guardian permission granting Publish.");
  }
  return problems;
}

/**
 * Whether records lack a current Publish grant, and how the latest one lapsed: null when one is
 * current, then "withdrawn", the expiry date, or "none" when nothing ever granted Publish.
 */
function lapseOf(records: RightsFacts[], now: Date): null | "withdrawn" | "none" | Date {
  const granting = records.filter(grantsPublish);
  if (granting.some((record) => isCurrent(record, now))) return null;
  const latest = granting.at(-1);
  if (latest?.withdrawnAt) return "withdrawn";
  return latest?.expiresAt ?? "none";
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
