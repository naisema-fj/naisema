import { ArrowRight, Calendar, CircleHelp, FileText, Smartphone } from "lucide-react";
import { Link } from "react-router";
import { AREA_ICONS, Icon } from "~/components/icons";
import { ContentLetter } from "~/components/public/content-letter";
import { BackLink, NotOpen, PageHead, PieceList } from "~/components/public/parts";
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
    return {
      kind: "area" as const,
      area: params.area,
      items: items.slice(0, AREA_LIMIT).map(itemCard),
      more: items.length > AREA_LIMIT,
    };
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
          <BackLink to="/">Home</BackLink>
          <PageHead tone="none" icon={FileText} title={loaderData.title} />
          <NotOpen label="Being written.">This page will say {loaderData.purpose}.</NotOpen>
          <p className="lede-small">
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
      <article className="pane pane-wide area-pane" aria-labelledby="area-heading">
        <BackLink to="/">Home</BackLink>
        <PageHead
          tone={area}
          icon={AREA_ICONS[area]}
          headingId="area-heading"
          title={AREA_NAMES[area]}
          plate={
            <>
              <p className="lede">{info.description}</p>
              {items[0]?.publishedAt && (
                <p className="dateline">
                  <Icon icon={Calendar} size={16} />
                  <DateMark label="Last published" date={items[0].publishedAt} />
                </p>
              )}
            </>
          }
        />
        {area === "learn" && (
          <nav aria-label="Learn sections" className="helper-links">
            <ul>
              <li>
                <Link to="/how-it-works" className="helper">
                  <span className="seat seat-small tone-learn-soft">
                    <Icon icon={CircleHelp} />
                  </span>
                  <span className="helper-text">
                    <strong>New here?</strong> How learning on NAISEMA works
                  </span>
                  <Icon icon={ArrowRight} className="helper-arrow" />
                </Link>
              </li>
              <li>
                <Link to="/apps" className="helper">
                  <span className="seat seat-small tone-learn-soft">
                    <Icon icon={Smartphone} />
                  </span>
                  <span className="helper-text">
                    <strong>Fijian apps:</strong> the dictionary, lessons and community translation
                  </span>
                  <Icon icon={ArrowRight} className="helper-arrow" />
                </Link>
              </li>
            </ul>
          </nav>
        )}
        {info.notYetOpen && !items.length && <NotOpen>{info.notYetOpen}</NotOpen>}
        <section aria-labelledby="pieces-heading" className="pieces">
          <h2 id="pieces-heading">Everything in {AREA_NAMES[area]}</h2>
          {items.length ? (
            <PieceList items={items} />
          ) : (
            <p className="shelf-empty">Nothing has been published in {AREA_NAMES[area]} yet.</p>
          )}
          {more && (
            <p className="see-all">
              <Link to={`/search?area=${area}`} className="button button-soft">
                See everything in {AREA_NAMES[area]}
                <Icon icon={ArrowRight} size={18} />
              </Link>
            </p>
          )}
        </section>
      </article>
    </main>
  );
}
