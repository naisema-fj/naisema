import { CASE_KINDS } from "./case-rules";
import { type Actor, type CaseKind, can, EXPORT_KINDS } from "./permissions";
import { scheduleKinds } from "./staff-schedule";

/**
 * The staff site's navigation: which pages each person is offered, from the same `can()` rules the
 * pages themselves enforce, so the navigation never offers a page that would refuse them.
 */

export type NavItem = { label: string; href: string };
export type NavGroup = { name: string; items: NavItem[] };

/** The pages an actor is offered, in groups; a group with nothing in it for them is left out. */
export function staffNav(actor: Actor): NavGroup[] {
  const allowed = (check: Parameters<typeof can>[1]) => can(actor, check);
  const editsContent = allowed({ action: "content.edit" });
  const isEducator = actor.roles.some((role) => role.role === "educator");
  const handlesCases = (Object.keys(CASE_KINDS) as CaseKind[]).some((kind) =>
    allowed({ action: "case.read", case: { kind } }),
  );

  const groups: { name: string; items: (NavItem | false)[] }[] = [
    {
      name: "Overview",
      items: [scheduleKinds(actor).length > 0 && { label: "What's coming up", href: "/admin/schedule" }],
    },
    {
      name: "Content",
      items: [
        editsContent && { label: "Content", href: "/admin/articles" },
        editsContent && { label: "Topics", href: "/admin/topics" },
        editsContent && { label: "Contributors", href: "/admin/contributors" },
        editsContent && { label: "Providers and offerings", href: "/admin/providers" },
        allowed({ action: "media.upload" }) && { label: "Media library", href: "/admin/media" },
        (editsContent || isEducator) && { label: "Learning Layers", href: "/admin/learning-layers" },
        allowed({ action: "reviewQueue.view" }) && { label: "Your reviews", href: "/admin/reviews" },
      ],
    },
    {
      name: "People and privacy",
      items: [
        handlesCases && { label: "Cases", href: "/admin/cases" },
        allowed({ action: "submission.manage" }) && { label: "Submissions", href: "/admin/submissions" },
        allowed({ action: "notice.publish" }) && { label: "Consent notices", href: "/admin/notices" },
        allowed({ action: "consent.manage" }) && { label: "Consent Records", href: "/admin/consents" },
      ],
    },
    {
      name: "Administration",
      items: [
        allowed({ action: "role.assign" }) && { label: "Staff and roles", href: "/admin/staff" },
        EXPORT_KINDS.some((kind) => allowed({ action: "export.run", kind })) && {
          label: "Exports",
          href: "/admin/exports",
        },
        allowed({ action: "audit.read" }) && { label: "Audit log", href: "/admin/audit" },
        allowed({ action: "usage.read" }) && { label: "Usage and costs", href: "/admin/usage" },
        allowed({ action: "restore.run" }) && { label: "Backups and restoring", href: "/admin/restore" },
      ],
    },
  ];
  return groups
    .map(({ name, items }) => ({ name, items: items.filter((item): item is NavItem => item !== false) }))
    .filter((group) => group.items.length > 0);
}

/** Whether a navigation item is the page being shown, or a page under it. The staff home is only itself. */
export function isCurrentNavItem(pathname: string, href: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === href || (href !== "/admin" && path.startsWith(`${href}/`));
}
