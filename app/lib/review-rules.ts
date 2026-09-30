/**
 * The review rules for Revisions (ADR-0003, ADR-0006, docs/phase-1a-defaults.md §3): which
 * Review Types a Revision's Content Flags require, whether those reviews are done, the Revision's
 * state, and which approvals carry forward to a new Revision. Pure, so the same rules apply to
 * every content type.
 */
import { REVIEW_TYPES, type ReviewType } from "./permissions";

export const CONTENT_FLAGS = [
  "languageInstruction",
  "sensitiveCultural",
  "identifiableChildren",
  "disabilityAdvice",
  "historicalClaims",
  "opinion",
] as const;
export type ContentFlag = (typeof CONTENT_FLAGS)[number];

export const FLAG_NAMES: Record<ContentFlag, string> = {
  languageInstruction: "Language instruction",
  sensitiveCultural: "Sensitive cultural material",
  identifiableChildren: "Identifiable children",
  disabilityAdvice: "Disability-specific advice",
  historicalClaims: "Historical claims",
  opinion: "Opinion or personal experience",
};

export const isContentFlag = (value: string): value is ContentFlag =>
  (CONTENT_FLAGS as readonly string[]).includes(value);

/** One review a Revision needs before it can be approved. */
export type ReviewRequirement = {
  reviewType: ReviewType;
  /** Language reviews only: the Language Variety the approval must be for. */
  languageVariety?: string;
  /** Only a Knowledge Holder Approval satisfies this cultural review. */
  knowledgeHolder?: true;
};

/**
 * The reviews each Content Flag needs. Opinion is a visible label only. Disability-specific advice
 * is reviewed by an accessibility reviewer: a person with relevant lived or professional experience.
 */
const FLAG_REVIEWS: Record<ContentFlag, (languageVariety: string | null) => ReviewRequirement | null> = {
  languageInstruction: (languageVariety) => ({ reviewType: "language", languageVariety: languageVariety ?? "" }),
  sensitiveCultural: () => ({ reviewType: "cultural", knowledgeHolder: true }),
  identifiableChildren: () => ({ reviewType: "safeguarding" }),
  disabilityAdvice: () => ({ reviewType: "accessibility" }),
  historicalClaims: () => ({ reviewType: "editorial" }),
  opinion: () => null,
};

export function requiredReviews(flags: readonly ContentFlag[], languageVariety: string | null): ReviewRequirement[] {
  const requirements = CONTENT_FLAGS.filter((flag) => flags.includes(flag))
    .map((flag) => FLAG_REVIEWS[flag](languageVariety))
    .filter((requirement): requirement is ReviewRequirement => requirement !== null);
  return REVIEW_TYPES.flatMap((type) => requirements.filter((requirement) => requirement.reviewType === type));
}

/** A recorded decision on one Revision for one Review Type, as the rules need to see it. */
export type RecordedDecision = {
  id: string;
  reviewType: ReviewType;
  languageVariety: string | null;
  decision: "approved" | "rejected";
  knowledgeHolder: boolean;
  /** Who reviewed: the reviewer, or for a Knowledge Holder Approval the editor who recorded it. */
  reviewerId: string;
  decidedAt: Date;
};

export type ReviewProgress = {
  requirement: ReviewRequirement;
  status: "awaiting" | "approved" | "rejected";
  decision?: RecordedDecision;
};

const satisfies = (decision: RecordedDecision, requirement: ReviewRequirement) =>
  decision.reviewType === requirement.reviewType &&
  (requirement.languageVariety === undefined || decision.languageVariety === requirement.languageVariety) &&
  (!requirement.knowledgeHolder || decision.knowledgeHolder);

const latest = (decisions: RecordedDecision[]) =>
  decisions.reduce<RecordedDecision | undefined>(
    (newest, decision) => (!newest || decision.decidedAt >= newest.decidedAt ? decision : newest),
    undefined,
  );

/** Where each required review stands: the latest matching decision wins. */
export function reviewProgress(requirements: ReviewRequirement[], decisions: RecordedDecision[]): ReviewProgress[] {
  return requirements.map((requirement) => {
    const decision = latest(decisions.filter((candidate) => satisfies(candidate, requirement)));
    return decision ? { requirement, status: decision.decision, decision } : { requirement, status: "awaiting" };
  });
}

export type RevisionState = "draft" | "submitted" | "approved" | "superseded";

/** A Revision is approved once submitted with every required review approved, until a newer one exists. */
export function revisionState(facts: { submitted: boolean; allApproved: boolean; superseded: boolean }): RevisionState {
  if (facts.superseded) return "superseded";
  if (!facts.submitted) return "draft";
  return facts.allApproved ? "approved" : "submitted";
}

export type Fingerprints = Partial<Record<ReviewType, string>>;

/** A SHA-256 hash of a value, with object keys in a fixed order so equal content hashes equally. */
export async function fingerprint(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** One fingerprint per Review Type, over the fields that type covers. */
export async function fingerprintsOf(fields: Record<ReviewType, unknown>): Promise<Fingerprints> {
  const entries = await Promise.all(REVIEW_TYPES.map(async (type) => [type, await fingerprint(fields[type])] as const));
  return Object.fromEntries(entries);
}

/**
 * The approvals on a base Revision that carry forward to a new one (ADR-0003): for each Review
 * Type, its latest decision, if that was an approval, the type's fingerprint is unchanged, and the
 * reviewer didn't edit the new Revision themselves.
 */
export function approvalsToCarryForward(input: {
  approvals: RecordedDecision[];
  baseFingerprints: Fingerprints;
  newFingerprints: Fingerprints;
  newAuthorIds: string[];
}): RecordedDecision[] {
  const byRequirement = new Map<string, RecordedDecision[]>();
  for (const approval of input.approvals) {
    const key = [approval.reviewType, approval.languageVariety, approval.knowledgeHolder].join("|");
    byRequirement.set(key, [...(byRequirement.get(key) ?? []), approval]);
  }
  return [...byRequirement.values()]
    .map(latest)
    .filter((approval): approval is RecordedDecision => approval !== undefined)
    .filter((approval) => {
      const before = input.baseFingerprints[approval.reviewType];
      return (
        approval.decision === "approved" &&
        before !== undefined &&
        before === input.newFingerprints[approval.reviewType] &&
        !input.newAuthorIds.includes(approval.reviewerId)
      );
    });
}
