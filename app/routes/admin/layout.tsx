import { Form, Outlet, useLocation } from "react-router";
import { WovenMark } from "~/components/public/woven-mark";
import { cloudflareContext } from "~/lib/cloudflare";
import { isCurrentNavItem, type NavGroup } from "~/lib/staff-nav";
import { staffShellFor } from "~/lib/staff-nav.server";
import type { Route } from "./+types/layout";
import "~/styles/staff.css";

/**
 * The staff site's shell: one header, navigation and footer around every staff page, so the pages
 * look and move alike. The navigation shows only what the signed-in person's roles allow
 * (app/lib/staff-nav.ts); before sign-in there is just the header. Pages keep their own
 * gate (requireStaff), so this shell only ever reads.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  return staffShellFor(context.get(cloudflareContext).env, request);
}

function StaffNav({ groups, label }: { groups: NavGroup[]; label: string }) {
  const { pathname } = useLocation();
  return (
    <nav aria-label={label} className="staff-nav">
      <ul className="staff-nav-groups">
        <li>
          <a href="/admin" aria-current={isCurrentNavItem(pathname, "/admin") ? "page" : undefined}>
            Staff home
          </a>
        </li>
        {groups.map((group) => (
          <li key={group.name}>
            <p className="staff-nav-group">{group.name}</p>
            <ul>
              {group.items.map((item) => (
                <li key={item.href}>
                  <a href={item.href} aria-current={isCurrentNavItem(pathname, item.href) ? "page" : undefined}>
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

export default function StaffLayout({ loaderData }: Route.ComponentProps) {
  return (
    <div className="staff">
      <header className="staff-header">
        <div className="staff-header-inner">
          <a href={loaderData ? "/admin" : "/admin/sign-in"} className="staff-wordmark">
            <WovenMark />
            NAISEMA <span>staff</span>
          </a>
          {loaderData && (
            <>
              {/* A native disclosure, so the menu works on phones without any JavaScript. */}
              <details className="staff-menu">
                <summary>Menu</summary>
                <StaffNav groups={loaderData.groups} label="Staff menu" />
              </details>
              <Form method="post" action="/admin/sign-out" className="staff-signout">
                <span className="staff-user">{loaderData.email}</span>
                <button type="submit">Sign out</button>
              </Form>
            </>
          )}
        </div>
      </header>
      <div className={loaderData ? "staff-body staff-body-nav" : "staff-body"}>
        {loaderData && <StaffNav groups={loaderData.groups} label="Staff" />}
        <Outlet />
      </div>
    </div>
  );
}
