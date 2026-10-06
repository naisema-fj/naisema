import { Link } from "react-router";
import { ContentLetter } from "~/components/public/content-letter";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { INFO_PAGES } from "~/lib/info-pages";
import { findPublicPage } from "~/lib/public.server";
import { publicHeaders } from "~/lib/public-cache.server";
import type { Route } from "./+types/info";

export const handle = { hydrate: false };
export const headers = publicHeaders;

/** A footer page: its published Page if it has one, otherwise a plain note that it is being written (PUB-01). */
export async function loader({ request, context }: Route.LoaderArgs) {
  const path = new URL(request.url).pathname.replace(/^\/|\/$/g, "");
  const page = INFO_PAGES.find((candidate) => candidate.path === path);
  if (!page) throw new Response("Not found", { status: 404 });
  const published = await findPublicPage(getDb(context.get(cloudflareContext).env.DB), page.path);
  return { page, published };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "NAISEMA" }];
  const title = loaderData.published?.title ?? loaderData.page.title;
  return [
    { title: `${title} · NAISEMA` },
    ...(loaderData.published ? [{ name: "description", content: loaderData.published.summary }] : []),
  ];
}

/**
 * The routes a footer page must always offer, whatever its words say: the community standards'
 * reporting route (SAFE-01) and the privacy page's way to ask about your information (DATA-03).
 */
function FixedRoutes({ path }: { path: string }) {
  if (path === "community-standards") {
    return (
      <section className="pane pane-narrow fixed-routes" aria-labelledby="report-heading">
        <h2 id="report-heading">Reporting a problem</h2>
        <p>
          If something on NAISEMA could cause harm, is wrong, or uses someone's work without permission, tell us. Every
          page has a "Report a problem" link, or <Link to="/report">report it here</Link>. Only the people who handle
          reports see what you send, and you can appeal what we decide.
        </p>
      </section>
    );
  }
  if (path === "privacy") {
    return (
      <section className="pane pane-narrow fixed-routes" aria-labelledby="your-information-heading">
        <h2 id="your-information-heading">Your information</h2>
        <p>
          <Link to="/privacy/request">
            Ask for a copy of what we hold about you, or for it to be corrected or deleted
          </Link>
          . To stop the newsletter, <Link to="/newsletter/unsubscribe">unsubscribe here</Link>.
        </p>
      </section>
    );
  }
  return null;
}

export default function Info({ loaderData }: Route.ComponentProps) {
  const { page, published } = loaderData;
  return (
    <main id="main">
      {published ? (
        <ContentLetter item={published} />
      ) : (
        <article className="pane pane-narrow">
          <h1>{page.title}</h1>
          <p>This page is being written. It will set out {page.purpose}.</p>
          <p>
            <Link to="/">Go to the NAISEMA home page</Link>
          </p>
        </article>
      )}
      <FixedRoutes path={page.path} />
    </main>
  );
}
