import { Link } from "react-router";
import { DateMark } from "~/components/public/postmarks";
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
  return (
    <main id="main">
      <article className="pane search-pane" aria-labelledby="search-heading">
        <h1 id="search-heading">Search</h1>
        <search>
          <form method="get" action="/search" className="search-form">
            <p className="search-words">
              <label htmlFor="search-q">Search for</label>
              <input id="search-q" name="q" type="search" defaultValue={q} autoComplete="off" />
              <button type="submit">Search</button>
            </p>
            <fieldset className="search-filters">
              <legend>Narrow it down</legend>
              <p>
                <label htmlFor="search-area">Area</label>
                <select id="search-area" name="area" defaultValue={area ?? ""}>
                  <option value="">All areas</option>
                  {PRIMARY_AREAS.map((option) => (
                    <option key={option} value={option}>
                      {AREA_NAMES[option]}
                    </option>
                  ))}
                </select>
              </p>
            </fieldset>
            {results && (
              <p className="search-reset">
                <Link to="/search">Clear the search</Link>
              </p>
            )}
          </form>
        </search>
        {results && (
          <section className="search-results" aria-labelledby="results-heading">
            <h2 id="results-heading">{results.length === 1 ? "1 result" : `${results.length} results`}</h2>
            {results.length ? (
              <ul className="piece-list">
                {results.map((result) => (
                  <li key={result.id}>
                    <Link to={result.path}>{result.title}</Link>
                    <p>{result.summary}</p>
                    <p className="list-mark">
                      {result.kindName}
                      {result.publishedAt && (
                        <>
                          {" · "}
                          <DateMark label="Published" date={result.publishedAt} />
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nothing published matches. Try fewer or different words.</p>
            )}
          </section>
        )}
      </article>
    </main>
  );
}
