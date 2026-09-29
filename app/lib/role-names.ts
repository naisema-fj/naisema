import type { RoleAssignment, StaffRole } from "./permissions";

export const ROLE_NAMES: Record<StaffRole, string> = {
  administrator: "Administrator",
  editor: "Editor",
  educator: "Educator",
  reviewer: "Reviewer",
  safeguarding_lead: "Safeguarding lead",
  privacy_contact: "Privacy contact",
};

/** "Reviewer · language · standard-fijian", for showing a Role Assignment to staff. */
export function describeRoleAssignment(assignment: RoleAssignment): string {
  return [ROLE_NAMES[assignment.role], assignment.reviewType, assignment.languageVariety].filter(Boolean).join(" · ");
}
