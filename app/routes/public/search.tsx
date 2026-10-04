import { Link, redirect } from "react-router";
import { DateMark } from "~/components/public/postmarks";
import { AREA_NAMES, PRIMARY_AREAS } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { FORMAT_NAMES } from "~/lib/formats";
import { searchPublic } from "~/lib/search.server";
import { type SearchFilters, searchEvent, searchFilters, searchHref } from "~/lib/search-query";
import type { Route } from "./+types/search";

export const handle = { hydrate: false };

/** Results depend on the query string and change the moment an item is withdrawn: never cached. */
export const headers = () => ({ "Cache-Control": "no-store" });

const isSearching = (filters: SearchFilters) => Boolean(filters.q || filters.area || filters.topic || filters.format);

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const filters = searchFilters(new URL(request.url));
  const outcome = await searchPublic(getDb(env.DB), filters);
  if (filters.page > outcome.pageCount) throw redirect(searchHref(filters, { page: outcome.pageCount }));
  if (isSearching(filters)) {
    // Only a Topic that exists is recorded: anything else in ?topic= is text a visitor typed.
    const topic = outcome.topics.some((known) => known.id === filters.topic) ? filters.topic : null;
    env.EVENTS.writeDataPoint(
      searchEvent({
        filters: { ...filters, topic },
        resultIds: outcome.results.map((result) => result.id),
        total: outcome.total,
      }),
    );
  }
  return { filters, ...outcome };
}

export function meta() {
  return [{ title: "Search · Na iSema" }, { name: "robots", content: "noindex" }];
}

export default function Search({ loaderData }: Route.ComponentProps) {
  const { filters, results, total, pageCount, topics } = loaderData;
  const searching = isSearching(filters);
  return (
    <main id="main">
      <article className="letter search-letter" aria-labelledby="search-heading">
        <h1 id="search-heading">Search</h1>
        <search>
          <form method="get" action="/search" className="search-form">
            <p className="search-words">
              <label htmlFor="search-q">Search for</label>
              <input id="search-q" name="q" type="search" defaultValue={filters.q} autoComplete="off" />
              <button type="submit">Search</button>
            </p>
            <fieldset className="search-filters">
              <legend>Narrow it down</legend>
              <p>
                <label htmlFor="search-area">Area</label>
                <select id="search-area" name="area" defaultValue={filters.area ?? ""}>
                  <option value="">All areas</option>
                  {PRIMARY_AREAS.map((area) => (
                    <option key={area} value={area}>
                      {AREA_NAMES[area]}
                    </option>
                  ))}
                </select>
              </p>
              <p>
                <label htmlFor="search-topic">Topic</label>
                <select id="search-topic" name="topic" defaultValue={filters.topic ?? ""}>
                  <option value="">All topics</option>
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </p>
              <p>
                <label htmlFor="search-format">Format</label>
                <select id="search-format" name="format" defaultValue={filters.format ?? ""}>
                  <option value="">All formats</option>
                  {Object.entries(FORMAT_NAMES).map(([format, name]) => (
                    <option key={format} value={format}>
                      {name}
                    </option>
                  ))}
                </select>
              </p>
            </fieldset>
            {searching && (
              <p className="search-reset">
                <Link to="/search">Clear the search and filters</Link>
              </p>
            )}
          </form>
        </search>

        {searching && (
          <section className="search-results" aria-labelledby="results-heading">
            <h2 id="results-heading">{total === 1 ? "1 result" : `${total} results`}</h2>
            {results.length ? (
              <ul className="letter-list">
                {results.map((result) => (
                  <li key={result.id}>
                    <Link to={result.path}>{result.title}</Link>
                    <p>{result.summary}</p>
                    <p className="list-mark">
                      {result.areaName} · {result.formatName}
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
            ) : total === 0 ? (
              <NoResults filters={filters} />
            ) : (
              <p>The results on this page have just changed. Search again to see them.</p>
            )}
            {pageCount > 1 && (
              <nav aria-label="Result pages" className="pager">
                {filters.page > 1 && (
                  <Link to={searchHref(filters, { page: filters.page - 1 })} rel="prev">
                    Previous page
                  </Link>
                )}
                <span>
                  Page {filters.page} of {pageCount}
                </span>
                {filters.page < pageCount && (
                  <Link to={searchHref(filters, { page: filters.page + 1 })} rel="next">
                    Next page
                  </Link>
                )}
              </nav>
            )}
          </section>
        )}
      </article>
    </main>
  );
}

/** What to try next when nothing matched (PUB-03): each way out is a link, not just advice. */
function NoResults({ filters }: { filters: SearchFilters }) {
  const narrowed = filters.area || filters.topic || filters.format;
  return (
    <div className="no-results">
      <p>Nothing matched your search.</p>
      <ul>
        {filters.q && <li>Check the spelling, or try fewer or different words.</li>}
        {narrowed && (
          <li>
            <Link to={searchHref(filters, { area: null, topic: null, format: null, page: 1 })}>
              Search all areas, topics and formats
            </Link>
          </li>
        )}
        <li>
          Or browse:{" "}
          {PRIMARY_AREAS.map((area, index) => (
            <span key={area}>
              {index > 0 && ", "}
              <Link to={`/${area}`}>{AREA_NAMES[area]}</Link>
            </span>
          ))}
          .
        </li>
      </ul>
    </div>
  );
}
