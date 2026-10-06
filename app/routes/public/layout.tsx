import { isRouteErrorResponse, Link, Outlet, useLocation } from "react-router";
import { WovenMark } from "~/components/public/woven-mark";
import { AREA_NAMES, PRIMARY_AREAS } from "~/lib/areas";
import { INFO_PAGES } from "~/lib/info-pages";
import type { Route } from "./+types/layout";
import "~/styles/public.css";
import { SUBMISSION_TYPES } from "~/lib/submission-fields";

export const handle = { hydrate: false };

function AreaLinks() {
  const { pathname } = useLocation();
  const current = pathname.split("/")[1];
  return (
    <ul className="area-links">
      {PRIMARY_AREAS.map((area) => (
        <li key={area}>
          <Link reloadDocument to={`/${area}`} aria-current={current === area ? "page" : undefined}>
            {AREA_NAMES[area]}
          </Link>
        </li>
      ))}
      <li className="search-item">
        <Link reloadDocument to="/search" aria-current={current === "search" ? "page" : undefined}>
          Search
        </Link>
      </li>
    </ul>
  );
}

function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link reloadDocument to="/" className="wordmark">
          <WovenMark />
          NAISEMA
        </Link>
        <nav aria-label="Main" className="site-nav">
          <AreaLinks />
        </nav>
        {/* A native disclosure, so the menu works on phones without any JavaScript. */}
        <details className="site-menu">
          <summary>Menu</summary>
          <nav aria-label="Main menu">
            <AreaLinks />
          </nav>
        </details>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="weave-strip" />
      <div className="site-footer-inner">
        <p className="wordmark footer-wordmark">
          <WovenMark />
          NAISEMA
        </p>
        <nav aria-label="About NAISEMA">
          <ul className="footer-links">
            {INFO_PAGES.map((page) => (
              <li key={page.path}>
                <Link reloadDocument to={`/${page.path}`}>
                  {page.title}
                </Link>
              </li>
            ))}
            <li>
              <Link reloadDocument to={`/forms/${SUBMISSION_TYPES.enquiry.path}`}>
                {SUBMISSION_TYPES.enquiry.title}
              </Link>
            </li>
            <li>
              <Link reloadDocument to="/newsletter">
                Newsletter
              </Link>
            </li>
            <li>
              <Link reloadDocument to="/report">
                Report a problem
              </Link>
            </li>
          </ul>
        </nav>
        <p className="footer-note">
          NAISEMA connects Fijians abroad, and everyone else, with Fijian language and culture.
        </p>
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  return (
    <div className="public">
      <SiteHeader />
      <Outlet />
      <SiteFooter />
    </div>
  );
}

/** What a public error page says, by status. */
function errorPage(error: unknown) {
  const status = isRouteErrorResponse(error) ? error.status : 500;
  return status === 410
    ? { title: "This has been withdrawn", text: "It is no longer published on NAISEMA." }
    : status === 404
      ? { title: "We couldn't find that page", text: "It may have moved, or it may not be published yet." }
      : { title: "Something went wrong", text: "Something went wrong on our side. Please try again in a moment." };
}

/** Pages below an error boundary don't contribute meta, so an error page gets its title here. */
export function meta({ error }: Route.MetaArgs) {
  return [{ title: error ? `${errorPage(error).title} · NAISEMA` : "NAISEMA" }];
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { title, text } = errorPage(error);
  return (
    <div className="public">
      <SiteHeader />
      <main id="main">
        <article className="pane pane-narrow">
          <h1>{title}</h1>
          <p>{text}</p>
          <p>
            <Link reloadDocument to="/">
              Go to the NAISEMA home page
            </Link>
          </p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
