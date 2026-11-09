import { isRouteErrorResponse, Outlet, useLocation, useRouteError, useRouteLoaderData } from "react-router";
import { WovenMark } from "~/components/public/woven-mark";
import { cloudflareContext } from "~/lib/cloudflare";
import { can, ROLE_NAMES, type Staff } from "~/lib/roles";
import { getStaff } from "~/lib/staff.server";
import type { Route } from "./+types/layout";
import "~/styles/staff.css";

/**
 * The staff site's shell: one header and navigation around every staff page. The navigation shows
 * only what the person's roles allow; each page keeps its own gate (requireStaff). Signing in and
 * out is Cloudflare Access's (ADR-0015).
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const person = await getStaff(context.get(cloudflareContext).env, request);
  return person
    ? { email: person.email, groups: staffNav(person), roles: person.roles.map((role) => ROLE_NAMES[role]) }
    : null;
}

type NavGroup = { name: string; items: { label: string; href: string }[] };

function staffNav(person: Staff): NavGroup[] {
  const groups: { name: string; items: ({ label: string; href: string } | false)[] }[] = [
    {
      name: "Content",
      items: [
        (can(person, "content.edit") || can(person, "video.edit")) && { label: "Content", href: "/admin/items" },
        can(person, "media.upload") && { label: "Media library", href: "/admin/media" },
        can(person, "content.edit") && { label: "Topics", href: "/admin/topics" },
      ],
    },
    {
      name: "People",
      items: [
        (can(person, "submissions.read") || can(person, "reports.read")) && {
          label: "Messages and reports",
          href: "/admin/submissions",
        },
        can(person, "staff.manage") && { label: "Staff", href: "/admin/staff" },
        can(person, "audit.read") && { label: "Audit log", href: "/admin/audit" },
      ],
    },
  ];
  return groups
    .map((group) => ({ name: group.name, items: group.items.filter((item) => item !== false) }))
    .filter((group) => group.items.length > 0);
}

type Shell = Route.ComponentProps["loaderData"];

function StaffNav({ groups, label }: { groups: NavGroup[]; label: string }) {
  const { pathname } = useLocation();
  const current = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));
  return (
    <nav aria-label={label} className="staff-nav">
      <ul className="staff-nav-groups">
        <li>
          <a href="/admin" aria-current={current("/admin") ? "page" : undefined}>
            Staff home
          </a>
        </li>
        {groups.map((group) => (
          <li key={group.name}>
            <p className="staff-nav-group">{group.name}</p>
            <ul>
              {group.items.map((item) => (
                <li key={item.href}>
                  <a href={item.href} aria-current={current(item.href) ? "page" : undefined}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function StaffFrame({ shell, children }: { shell: Shell; children: React.ReactNode }) {
  return (
    <div className="staff">
      <header className="staff-header">
        <div className="staff-header-inner">
          <a href="/admin" className="staff-wordmark">
            <WovenMark />
            NAISEMA <span>staff</span>
          </a>
          {shell && (
            <>
              {/* A native disclosure, so the menu works on phones without any JavaScript. */}
              <details className="staff-menu">
                <summary>Menu</summary>
                <StaffNav groups={shell.groups} label="Staff menu" />
              </details>
              <p className="staff-signout">
                <span className="staff-user">{shell.email}</span> <a href="/cdn-cgi/access/logout">Sign out</a>
              </p>
            </>
          )}
        </div>
      </header>
      <div className={shell ? "staff-body staff-body-nav" : "staff-body"}>
        {shell && <StaffNav groups={shell.groups} label="Staff" />}
        {children}
      </div>
      <footer className="staff-footer">
        <p>NAISEMA staff site. What you do here is recorded in the audit log.</p>
      </footer>
    </div>
  );
}

export default function StaffLayout({ loaderData }: Route.ComponentProps) {
  return (
    <StaffFrame shell={loaderData}>
      <Outlet />
    </StaffFrame>
  );
}

/** A refused or missing staff page keeps the shell, so the person can carry on from where they are. */
export function ErrorBoundary() {
  const error = useRouteError();
  const shell = useRouteLoaderData<typeof loader>("routes/admin/layout");
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const heading = status === 403 ? "Not for your roles" : status === 404 ? "Page not found" : "Something went wrong";
  const message =
    isRouteErrorResponse(error) && typeof error.data === "string" && error.data
      ? error.data
      : status === 404
        ? "We couldn't find that page."
        : "Something went wrong on our side.";
  return (
    <StaffFrame shell={shell ?? null}>
      <title>{`${heading} · NAISEMA staff`}</title>
      <main id="main" className="page">
        <h1>{heading}</h1>
        <p>{message}</p>
        <p>
          <a href="/admin">Back to staff home</a>
        </p>
      </main>
    </StaffFrame>
  );
}
