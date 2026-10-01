import type { ContentFlag, ReviewProgress } from "./review-rules";
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
    const date = formatDay(decision.decidedAt);
    switch (requirement.reviewType) {
      case "language":
        return [`Language reviewed · ${languageVarietyName(decision.languageVariety ?? "")} · ${date}`];
      case "cultural":
        return [
          requirement.knowledgeHolder
            ? `Cultural context reviewed with a Knowledge Holder · ${date}`
            : `Cultural context reviewed · ${date}`,
        ];
      case "editorial":
        return [`Sources and claims reviewed · ${date}`];
      case "accessibility":
        return [`Disability advice reviewed · ${date}`];
      default:
        // Safeguarding review stays internal.
        return [];
    }
  });
  if (input.flags.includes("opinion")) labels.push("Opinion or personal experience");
  return labels;
}
