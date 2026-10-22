import { Form, isRouteErrorResponse, Outlet, useLocation, useRouteError, useRouteLoaderData } from "react-router";
import { WovenMark } from "~/components/public/woven-mark";
import { cloudflareContext } from "~/lib/cloudflare";
import { isCurrentNavItem, type NavGroup } from "~/lib/staff-nav";
import { staffShellFor } from "~/lib/staff-nav.server";
import { MAX_QUERY } from "~/lib/staff-search";
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

type Shell = Route.ComponentProps["loaderData"];

/** One search box on every staff page; on the search page it keeps what was asked. */
function StaffSearch() {
  const { pathname, search } = useLocation();
  const asked = pathname === "/admin/search" ? (new URLSearchParams(search).get("q") ?? "") : "";
  return (
    <search className="staff-search">
      <form method="get" action="/admin/search">
        <label htmlFor="staff-search-q" className="visually-hidden">
          Search content, media and directories
        </label>
        <input
          id="staff-search-q"
          type="search"
          name="q"
          defaultValue={asked}
          placeholder="Search"
          maxLength={MAX_QUERY}
          autoComplete="off"
        />
        <button type="submit">Search</button>
      </form>
    </search>
  );
}

function StaffFrame({ shell, children }: { shell: Shell; children: React.ReactNode }) {
  return (
    <div className="staff">
      <header className="staff-header">
        <div className="staff-header-inner">
          <a href={shell ? "/admin" : "/admin/sign-in"} className="staff-wordmark">
            <WovenMark />
            NAISEMA <span>staff</span>
          </a>
          {shell?.search && <StaffSearch />}
          {shell && (
            <>
              {/* A native disclosure, so the menu works on phones without any JavaScript. */}
              <details className="staff-menu">
                <summary>Menu</summary>
                <StaffNav groups={shell.groups} label="Staff menu" />
              </details>
              <Form method="post" action="/admin/sign-out" className="staff-signout">
                <span className="staff-user">{shell.email}</span>
                <button type="submit">Sign out</button>
              </Form>
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
      <meta name="robots" content="noindex" />
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
