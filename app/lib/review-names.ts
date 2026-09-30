import type { ReviewType } from "./permissions";
import type { RevisionState } from "./review-rules";

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
