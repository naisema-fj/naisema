/**
 * The rules for Rights Records (ADR-0007): which Permitted Uses exist and whether the rights on a
 * Revision are current enough to publish it. Expiry is a day compared on every request, so a lapsed
 * right takes the item down on the next request with no scheduled job (ADR-0015).
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

export const PERMITTED_USE_NAMES: Record<PermittedUse, string> = {
  publish: "Publish",
  excerpt: "Excerpt",
  translate: "Translate",
  transcribe: "Transcribe",
  educationalAdaptation: "Educational adaptation",
  commercial: "Commercial use",
  aiTraining: "AI training",
};

export const isPermittedUse = (value: string): value is PermittedUse =>
  (PERMITTED_USES as readonly string[]).includes(value);

/** What the rules need to know about a Rights Record. */
export type RightsFacts = {
  permittedUses: PermittedUse[];
  guardianPermission: boolean;
  /** The last day it holds (YYYY-MM-DD), or null for no end. */
  expiresOn: string | null;
  withdrawnAt: Date | null;
};

/** Current on `today` (YYYY-MM-DD): not withdrawn, and today is on or before its last day. */
export const isCurrent = (record: RightsFacts, today: string) =>
  record.withdrawnAt === null && (record.expiresOn === null || record.expiresOn >= today);

/** The uses a Video's Learning Layer needs from the Video's own records (VID-01). */
export const LAYER_USES: readonly PermittedUse[] = ["publish", "translate", "transcribe", "educationalAdaptation"];

/** A day as staff and visitors read it: "30 Sept 2026". */
export const formatDay = (day: string | Date) =>
  new Date(typeof day === "string" ? `${day}T00:00:00Z` : day).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const why = (records: RightsFacts[], use: PermittedUse, what: string) => {
  const granting = records.filter((record) => record.permittedUses.includes(use));
  if (!granting.length) return `No Rights Record for ${what} grants ${PERMITTED_USE_NAMES[use]}.`;
  if (granting.every((record) => record.withdrawnAt)) return `The Rights Record for ${what} was withdrawn.`;
  return `The Rights Record for ${what} granting ${PERMITTED_USE_NAMES[use]} has expired.`;
};

/**
 * Why a Revision's rights don't allow it to be public on `today`, or nothing if they do. The item
 * needs a current record granting Publish (and the Learning Layer uses, for a Video with one); each
 * media file it shows needs one of its own; and an item flagged with identifiable children needs
 * documented guardian permission.
 */
export function rightsProblems(input: {
  itemRecords: RightsFacts[];
  media: { id: string; name: string; records: RightsFacts[] }[];
  needsGuardianPermission: boolean;
  hasLayer: boolean;
  today: string;
}): string[] {
  const { today } = input;
  const problems: string[] = [];
  const itemCurrent = input.itemRecords.filter((record) => isCurrent(record, today));
  for (const use of input.hasLayer ? LAYER_USES : (["publish"] as const)) {
    if (!itemCurrent.some((record) => record.permittedUses.includes(use)))
      problems.push(why(input.itemRecords, use, "the item"));
  }
  if (input.needsGuardianPermission && !itemCurrent.some((record) => record.guardianPermission)) {
    problems.push("It shows identifiable children, and no current Rights Record records guardian permission.");
  }
  for (const file of input.media) {
    if (!file.records.some((record) => isCurrent(record, today) && record.permittedUses.includes("publish")))
      problems.push(why(file.records, "publish", file.name));
  }
  return problems;
}
