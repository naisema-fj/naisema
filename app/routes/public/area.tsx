import { Link } from "react-router";
import { ContentLetter } from "~/components/public/content-letter";
import { DateMark } from "~/components/public/postmarks";
import { AREA_INFO, AREA_NAMES, isPrimaryArea, type PrimaryArea } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import { findPublicItem, publicItems } from "~/lib/content.server";
import { getDb } from "~/lib/db.server";
import { publicHeaders } from "~/lib/http";
import { INFO_PAGES } from "~/lib/info-pages";
import { itemCard, publicView } from "~/lib/public-view.server";
import type { Route } from "./+types/area";

export const handle = { hydrate: false };
export const headers = publicHeaders;

const AREA_LIMIT = 20;

/**
 * GET /:area lists an area's newest eligible items; any other single segment is a footer Page,
 * at `/{slug}`. A footer Page not published yet says plainly that it is being written (PUB-01).
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const db = getDb(context.get(cloudflareContext).env.DB);
  if (isPrimaryArea(params.area)) {
    const items = await publicItems(db, { area: params.area, limit: AREA_LIMIT + 1 });
    return { kind: "area" as const, area: params.area, items: items.slice(0, AREA_LIMIT).map(itemCard), more: items.length > AREA_LIMIT };
  }
  const found = await findPublicItem(db, "pages", params.area);
  if (found.kind === "shown") return { kind: "page" as const, page: await publicView(db, found) };
  const info = INFO_PAGES.find((page) => page.path === params.area);
  if (info) return { kind: "placeholder" as const, title: info.title, purpose: info.purpose };
  if (found.kind === "gone") throw new Response("Withdrawn", { status: 410 });
  throw new Response("Not found", { status: 404 });
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "NAISEMA" }];
  if (loaderData.kind === "area")
    return [
      { title: `${AREA_NAMES[loaderData.area]} · NAISEMA` },
      { name: "description", content: AREA_INFO[loaderData.area].description },
    ];
  const title = loaderData.kind === "page" ? loaderData.page.title : loaderData.title;
  return [{ title: `${title} · NAISEMA` }];
}

export default function AreaOrPage({ loaderData }: Route.ComponentProps) {
  if (loaderData.kind === "page") {
    return (
      <main id="main" className="article-page">
        <ContentLetter item={loaderData.page} />
      </main>
    );
  }
  if (loaderData.kind === "placeholder") {
    return (
      <main id="main">
        <article className="pane pane-narrow">
          <h1>{loaderData.title}</h1>
          <p className="not-open">
            <span className="from-label">Being written</span> This page will say {loaderData.purpose}.
          </p>
          <p>
            Until then, <Link to="/forms/enquiry">send us a message</Link> with any question.
          </p>
        </article>
      </main>
    );
  }
  return <Area area={loaderData.area} items={loaderData.items} more={loaderData.more} />;
}

function Area({ area, items, more }: { area: PrimaryArea; items: ReturnType<typeof itemCard>[]; more: boolean }) {
  const info = AREA_INFO[area];
  return (
    <main id="main" className="area-page">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li aria-current="page">{AREA_NAMES[area]}</li>
        </ol>
      </nav>
      <article className="pane area-pane" aria-labelledby="area-heading">
        <header className="pane-intro">
          <div className={`pane-head tile-${area}`}>
            <h1 id="area-heading">{AREA_NAMES[area]}</h1>
          </div>
          <p className="lede">{info.description}</p>
          {items[0]?.publishedAt && (
            <p className="dateline">
              <DateMark label="Last published" date={items[0].publishedAt} />
            </p>
          )}
        </header>
        {info.notYetOpen && !items.length && (
          <p className="not-open">
            <span className="from-label">Not open yet</span> {info.notYetOpen}
          </p>
        )}
        {area === "learn" && (
          <nav aria-label="Learn sections" className="area-sections">
            <ul>
              <li>
                <Link to="/apps">Fijian apps: the dictionary, lessons and community translation</Link>
              </li>
            </ul>
          </nav>
        )}
        {items.length ? (
          <ul className="piece-list">
            {items.map((item) => (
              <li key={item.path}>
                <Link to={item.path}>{item.title}</Link>
                <p>{item.summary}</p>
                <p className="list-mark">
                  {item.kindName}
                  {item.publishedAt && (
                    <>
                      {" · "}
                      <DateMark label="Published" date={item.publishedAt} />
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Nothing has been published in {AREA_NAMES[area]} yet.</p>
        )}
        {more && (
          <p className="see-all">
            <Link to={`/search?area=${area}`}>See everything in {AREA_NAMES[area]}</Link>
          </p>
        )}
      </article>
    </main>
  );
}
