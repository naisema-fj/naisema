import { isRouteErrorResponse, Link, Outlet, useLocation } from "react-router";
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
          <Link to={`/${area}`} aria-current={current === area ? "page" : undefined}>
            {AREA_NAMES[area]}
          </Link>
        </li>
      ))}
      <li className="search-item">
        <Link to="/search" aria-current={current === "search" ? "page" : undefined}>
          Search
        </Link>
      </li>
    </ul>
  );
}

function SiteHeader() {
  return (
    <header className="site-header">
      <div className="airmail-band" />
      <div className="site-header-inner">
        <Link to="/" className="wordmark">
          Na iSema
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
      <div className="masi-strip" />
      <div className="site-footer-inner">
        <nav aria-label="About Na iSema">
          <ul className="footer-links">
            {INFO_PAGES.map((page) => (
              <li key={page.path}>
                <Link to={`/${page.path}`}>{page.title}</Link>
              </li>
            ))}
            <li>
              <Link to={`/forms/${SUBMISSION_TYPES.enquiry.path}`}>{SUBMISSION_TYPES.enquiry.title}</Link>
            </li>
            <li>
              <Link to="/newsletter">Newsletter</Link>
            </li>
          </ul>
        </nav>
        <p className="footer-note">
          Na iSema connects Fijians abroad, and everyone else, with Fijian language and culture. The pattern above is a
          placeholder in the spirit of masi, until commissioned and culturally reviewed artwork arrives.
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
    ? { title: "This has been withdrawn", text: "It is no longer published on Na iSema." }
    : status === 404
      ? { title: "We couldn't find that page", text: "It may have moved, or it may not be published yet." }
      : { title: "Something went wrong", text: "Something went wrong on our side. Please try again in a moment." };
}

/** Pages below an error boundary don't contribute meta, so an error page gets its title here. */
export function meta({ error }: Route.MetaArgs) {
  return [{ title: error ? `${errorPage(error).title} · Na iSema` : "Na iSema" }];
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { title, text } = errorPage(error);
  return (
    <div className="public">
      <SiteHeader />
      <main id="main">
        <article className="letter letter-narrow">
          <h1>{title}</h1>
          <p>{text}</p>
          <p>
            <Link to="/">Go to the Na iSema home page</Link>
          </p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
