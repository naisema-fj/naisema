import { CircleHelp, Compass, House, Menu, Search, X } from "lucide-react";
import { isRouteErrorResponse, Link, Outlet, useLocation } from "react-router";
import { AREA_ICONS, Icon } from "~/components/icons";
import { PageHead } from "~/components/public/parts";
import { WovenMark } from "~/components/public/woven-mark";
import { AREA_NAMES, PRIMARY_AREAS } from "~/lib/areas";
import { INFO_PAGES, type InfoPage } from "~/lib/info-pages";
import type { Route } from "./+types/layout";
import "~/styles/public.css";

export const handle = { hydrate: false };

function AreaLinks() {
  const { pathname } = useLocation();
  const current = pathname.split("/")[1];
  return (
    <ul className="area-links">
      {PRIMARY_AREAS.map((area) => (
        <li key={area}>
          <Link
            reloadDocument
            to={`/${area}`}
            className={`area-link tone-${area}`}
            aria-current={current === area ? "page" : undefined}
          >
            <span className="link-seat">
              <Icon icon={AREA_ICONS[area]} />
            </span>
            {AREA_NAMES[area]}
          </Link>
        </li>
      ))}
      <li className="search-item">
        <Link
          reloadDocument
          to="/search"
          className="search-link"
          aria-current={current === "search" ? "page" : undefined}
        >
          <span className="link-seat">
            <Icon icon={Search} />
          </span>
          Search
        </Link>
      </li>
      <li className="guide-item">
        <Link
          reloadDocument
          to="/how-it-works"
          className="area-link"
          aria-current={current === "how-it-works" ? "page" : undefined}
        >
          <span className="link-seat">
            <Icon icon={CircleHelp} />
          </span>
          How it works
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
          <summary>
            <span className="when-closed">
              <Icon icon={Menu} />
              Menu
            </span>
            <span className="when-open">
              <Icon icon={X} />
              Close
            </span>
          </summary>
          <nav aria-label="Main menu">
            <AreaLinks />
          </nav>
        </details>
      </div>
    </header>
  );
}

const infoPage = (path: InfoPage["path"]) => INFO_PAGES.find((page) => page.path === path) as InfoPage;

/** The footer's links in three short groups, so each is easy to find. */
const FOOTER_GROUPS: { name: string; links: { to: string; label: string }[] }[] = [
  {
    name: "About",
    links: [
      { to: "/how-it-works", label: "How it works" },
      { to: "/about", label: infoPage("about").title },
      { to: "/partners", label: infoPage("partners").title },
      { to: "/inclusion", label: infoPage("inclusion").title },
    ],
  },
  {
    name: "Help",
    links: [
      { to: "/contact", label: infoPage("contact").title },
      { to: "/forms/enquiry", label: "Send us a message" },
      { to: "/forms/report", label: "Report a problem" },
      { to: "/accessibility", label: infoPage("accessibility").title },
    ],
  },
  {
    name: "Your information",
    links: [
      { to: "/privacy", label: infoPage("privacy").title },
      { to: "/forms/privacy-request", label: "Your information" },
      { to: "/community-standards", label: infoPage("community-standards").title },
      { to: "/newsletter", label: "Newsletter" },
    ],
  },
];

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="weave-strip" />
      <div className="site-footer-inner">
        <div className="footer-about">
          <p className="wordmark footer-wordmark">
            <WovenMark />
            NAISEMA
          </p>
          <p className="footer-note">
            NAISEMA connects Fijians abroad, and everyone else, with Fijian language and culture.
          </p>
        </div>
        {FOOTER_GROUPS.map((group) => (
          <nav key={group.name} aria-labelledby={`footer-${group.name.toLowerCase().replaceAll(" ", "-")}`}>
            <h2 id={`footer-${group.name.toLowerCase().replaceAll(" ", "-")}`} className="footer-heading">
              {group.name}
            </h2>
            <ul className="footer-links">
              {group.links.map((link) => (
                <li key={link.to}>
                  <Link reloadDocument to={link.to}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
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
        <article className="pane pane-narrow error-pane">
          <PageHead tone="none" icon={Compass} title={title} />
          <p className="lede">{text}</p>
          <p className="button-row">
            <Link reloadDocument to="/" className="button">
              <Icon icon={House} />
              Go to the NAISEMA home page
            </Link>
            <Link reloadDocument to="/search" className="button button-soft">
              <Icon icon={Search} />
              Search for it
            </Link>
          </p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
