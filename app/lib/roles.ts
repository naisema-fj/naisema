/**
 * Staff roles and what each may do (docs/phase-1a-defaults.md §11, as simplified by ADR-0015). One
 * person may hold several. Nobody approves a Revision they wrote, whatever their roles
 * (`content-rules.ts`).
 */

export const ROLES = ["admin", "editor", "educator", "reviewer", "safeguarding"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_NAMES: Record<Role, string> = {
  admin: "Administrator",
  editor: "Editor",
  educator: "Educator",
  reviewer: "Language Reviewer",
  safeguarding: "Safeguarding Lead",
};

export const isRole = (value: string): value is Role => (ROLES as readonly string[]).includes(value);

export type Permission =
  | "content.edit"
  | "video.edit"
  | "content.publish"
  | "review.editorial"
  | "review.language"
  | "review.knowledge-holder"
  | "review.safeguarding"
  | "rights.manage"
  | "media.upload"
  | "submissions.read"
  | "reports.read"
  | "staff.manage"
  | "audit.read";

const GRANTS: Record<Role, readonly Permission[]> = {
  admin: ["staff.manage", "audit.read", "submissions.read"],
  editor: [
    "content.edit",
    "video.edit",
    "content.publish",
    "review.editorial",
    "review.knowledge-holder",
    "rights.manage",
    "media.upload",
    "submissions.read",
  ],
  // Educators author Videos and their Learning Layers, and submit them; they don't publish.
  educator: ["video.edit", "media.upload"],
  reviewer: ["review.language"],
  safeguarding: ["review.safeguarding", "reports.read"],
};

export type Staff = { email: string; name: string; roles: Role[]; languageVariety: string | null };

export const can = (staff: Pick<Staff, "roles">, permission: Permission) =>
  staff.roles.some((role) => GRANTS[role].includes(permission));
