import { ArrowRight, ListFilter, Search as SearchIcon, Tags, X } from "lucide-react";
import { Link } from "react-router";
import { Icon } from "~/components/icons";
import { PieceList } from "~/components/public/parts";
import { AREA_NAMES, isPrimaryArea, PRIMARY_AREAS } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import { publicItems } from "~/lib/content.server";
import { getDb } from "~/lib/db.server";
import { publicHeaders } from "~/lib/http";
import { itemCard } from "~/lib/public-view.server";
import type { Route } from "./+types/search";

export const handle = { hydrate: false };
export const headers = publicHeaders;

/**
 * GET /search?q=&area=: eligible items whose published words contain every word searched for.
 * Search words never reach logs or analytics (the request log drops query strings).
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
  const areaParam = url.searchParams.get("area") ?? "";
  const area = isPrimaryArea(areaParam) ? areaParam : null;
  if (!q && !area) return { q, area, results: null };
  const db = getDb(context.get(cloudflareContext).env.DB);
  const found = await publicItems(db, { query: q, area: area ?? undefined, limit: 50 });
  return { q, area, results: found.filter((row) => row.item.area !== "pages").map(itemCard) };
}

export function meta() {
  return [{ title: "Search · NAISEMA" }];
}

export default function Search({ loaderData }: Route.ComponentProps) {
  const { q, area, results } = loaderData;
  const where = area ? ` in ${AREA_NAMES[area]}` : "";
  const count = results ? (results.length === 1 ? "1 result" : `${results.length} results`) : "";
  return (
    <main id="main">
      <article className="pane search-pane" aria-labelledby="search-heading">
        <search>
          <form method="get" action="/search" className="search-form">
            <h1 id="search-heading">What are you looking for?</h1>
            <p className="search-words">
              <label htmlFor="search-q" className="visually-hidden">
                Search for
              </label>
              <span className="search-box">
                <Icon icon={SearchIcon} size={24} />
                <input id="search-q" name="q" type="search" defaultValue={q} autoComplete="off" />
              </span>
              <button type="submit" className="button">
                Search
              </button>
            </p>
            <fieldset className="search-filters">
              <legend>
                <Icon icon={ListFilter} size={18} />
                Only in
              </legend>
              <span className="chip-choice">
                <input type="radio" id="search-area-all" name="area" value="" defaultChecked={!area} />
                <label htmlFor="search-area-all">All areas</label>
              </span>
              {PRIMARY_AREAS.map((option) => (
                <span key={option} className="chip-choice">
                  <input
                    type="radio"
                    id={`search-area-${option}`}
                    name="area"
                    value={option}
                    defaultChecked={area === option}
                  />
                  <label htmlFor={`search-area-${option}`}>{AREA_NAMES[option]}</label>
                </span>
              ))}
            </fieldset>
            {results && (
              <p className="search-reset">
                <Link to="/search">
                  <Icon icon={X} size={18} />
                  Clear the search
                </Link>
              </p>
            )}
          </form>
        </search>
        {results && (
          <section className="search-results" aria-labelledby="results-heading">
            <h2 id="results-heading">{q ? `${count} for \u201c${q}\u201d${where}` : `${count}${where}`}</h2>
            {results.length ? (
              <PieceList items={results} showArea />
            ) : (
              <p className="shelf-empty">Nothing published matches. Try fewer or different words.</p>
            )}
          </section>
        )}
        <aside className="helper browse-topics" aria-label="Browse by topic">
          <span className="seat seat-small tone-voices-soft">
            <Icon icon={Tags} />
          </span>
          <p className="helper-text">Not sure what to type? Browse by topic: they cut across every area.</p>
          <Link to="/topics" className="button button-soft">
            Browse Topics
            <Icon icon={ArrowRight} size={18} />
          </Link>
        </aside>
      </article>
    </main>
  );
}
