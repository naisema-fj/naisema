import type { ReviewType } from "./permissions";
import type { ContentFlag, RecordedDecision, ReviewProgress } from "./review-rules";
import { formatDay } from "./rights-rules";

/** "standard-fijian" as readers see it: "Standard Fijian". */
export const languageVarietyName = (variety: string) =>
  variety
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/**
 * The public Review Labels for a published Revision (PUB-02, docs/phase-1a-defaults.md §3): one
 * line for each review that actually approved it, saying what was reviewed and when, plus the
 * opinion label its flags call for. Nothing is claimed for a review that is awaited or rejected,
 * and safeguarding review stays internal. There is no generic "verified" label.
 */
export function reviewLabels(input: { progress: ReviewProgress[]; flags: readonly ContentFlag[] }): string[] {
  const labels = input.progress.flatMap(({ requirement, status, decision }) => {
    if (status !== "approved" || !decision) return [];
    const label = LABELS[requirement.reviewType](requirement, decision, formatDay(decision.decidedAt), input.flags);
    return label ? [label] : [];
  });
  if (input.flags.includes("opinion")) labels.push("Opinion or personal experience");
  return labels;
}

/** One wording per Review Type, so a new type can't be added without deciding its label. */
const LABELS: Record<
  ReviewType,
  (
    requirement: ReviewProgress["requirement"],
    decision: RecordedDecision,
    date: string,
    flags: readonly ContentFlag[],
  ) => string | null
> = {
  language: (_, decision, date) =>
    decision.languageVariety
      ? `Language reviewed · ${languageVarietyName(decision.languageVariety)} · ${date}`
      : `Language reviewed · ${date}`,
  cultural: (requirement, _, date) =>
    requirement.knowledgeHolder
      ? `Cultural context reviewed with a Knowledge Holder · ${date}`
      : `Cultural context reviewed · ${date}`,
  editorial: (_, __, date) => `Sources and claims reviewed · ${date}`,
  accessibility: (requirement, _, date, flags) =>
    !requirement.transcript
      ? `Disability advice reviewed · ${date}`
      : flags.includes("disabilityAdvice")
        ? `Disability advice and transcript reviewed · ${date}`
        : `Transcript reviewed for accessibility · ${date}`,
  // Safeguarding review stays internal.
  safeguarding: () => null,
};
