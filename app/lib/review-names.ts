import type { ReviewType } from "./permissions";
import type { ContentFlag, ReviewRequirement, RevisionState } from "./review-rules";

/** How staff pages name each Review Type, Revision state and publication state. */
export const REVIEW_NAMES: Record<ReviewType, string> = {
  language: "Language review",
  cultural: "Cultural review",
  editorial: "Editorial review",
  accessibility: "Accessibility review",
  safeguarding: "Safeguarding review",
};

export const STATE_NAMES: Record<RevisionState, string> = {
  draft: "Draft",
  submitted: "Submitted for review",
  approved: "Approved",
  superseded: "Superseded by a newer revision",
};

export const PUBLICATION_STATES = ["unpublished", "published", "withdrawn", "archived"] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

export const PUBLICATION_NAMES: Record<PublicationState, string> = {
  unpublished: "Not published",
  published: "Published",
  withdrawn: "Withdrawn",
  archived: "Archived",
};

export const FLAG_NAMES: Record<ContentFlag, string> = {
  languageInstruction: "Language instruction",
  sensitiveCultural: "Sensitive cultural material",
  identifiableChildren: "Identifiable children",
  disabilityAdvice: "Disability-specific advice",
  historicalClaims: "Historical claims",
  opinion: "Opinion or personal experience",
};

/** A required review as staff see it: "Language review (standard-fijian)", "Knowledge Holder Approval". */
export function requirementName(requirement: ReviewRequirement): string {
  if (requirement.knowledgeHolder) return "Knowledge Holder Approval";
  if (requirement.transcript) return `${REVIEW_NAMES.accessibility} of the transcript`;
  const name = REVIEW_NAMES[requirement.reviewType];
  return requirement.languageVariety ? `${name} (${requirement.languageVariety})` : name;
}
