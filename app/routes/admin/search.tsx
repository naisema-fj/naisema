import { cloudflareContext } from "~/lib/cloudflare";
import { requireStaff } from "~/lib/staff.server";
import { cleanQuery } from "~/lib/staff-search";
import { staffSearch } from "~/lib/staff-search.server";
import type { Route } from "./+types/search";

export const handle = { hydrate: false };

// The title never holds what was typed: the query belongs to the person who typed it.
export function meta() {
  return [{ title: "Search · NAISEMA staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db, actor } = await requireStaff(context.get(cloudflareContext).env, request);
  const query = cleanQuery(new URL(request.url).searchParams.get("q"));
  const groups = await staffSearch(db, actor, query);
  return { query, groups };
}

export default function Search({ loaderData }: Route.ComponentProps) {
  const { query, groups } = loaderData;
  const total = groups.reduce((sum, group) => sum + group.results.length + group.more, 0);
  return (
    <main id="main" className="page">
      <h1>Search</h1>
      {!query ? (
        <p>
          Type a word from a title or name, a slug, or the start of an ID in the search box above. You will find Content
          Items, Learning Layers, media files, Contributors and Providers that your roles may open.
        </p>
      ) : groups.length === 0 ? (
        <div role="status">
          <p>Nothing found for “{query}”.</p>
          <p>Try fewer or shorter words, or check the spelling. Search only covers what your roles may open.</p>
        </div>
      ) : (
        <>
          <p role="status">
            {total === 1 ? "One result" : `${total} results`} for “{query}”.
          </p>
          {groups.map((group) => (
            <section key={group.kind} aria-labelledby={`search-${group.kind.replace(/\s+/g, "-")}`}>
              <h2 id={`search-${group.kind.replace(/\s+/g, "-")}`}>{group.kind}</h2>
              <ul className="search-results">
                {group.results.map((result) => (
                  <li key={result.id}>
                    <a href={result.href}>{result.title}</a>
                    <span className="search-detail">
                      {result.detail}.{result.state ? ` ${result.state}.` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              {group.more > 0 && (
                <p>
                  {group.more === 1 ? "One more match." : `${group.more} more matches.`} Use more of the name to narrow
                  the search.
                </p>
              )}
            </section>
          ))}
        </>
      )}
    </main>
  );
}
