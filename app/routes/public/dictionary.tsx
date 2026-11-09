import { Form, Link } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { DICTIONARY_PAGE, listPublicDictionary } from "~/lib/dictionary.server";
import { publicHeaders } from "~/lib/public-cache.server";
import { SUBMISSION_TYPES } from "~/lib/submission-fields";
import type { Route } from "./+types/dictionary";

export const handle = { hydrate: false };
export const headers = publicHeaders;

/** The public Vosa dictionary: only entries approved for language, as they stand, with every source cleared. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  const search = (params.get("q") ?? "").slice(0, 100);
  const list = await listPublicDictionary(getDb(context.get(cloudflareContext).env.DB), {
    search,
    page: Number(params.get("page")) || 1,
  });
  return {
    search,
    entries: list.rows,
    total: list.total,
    page: list.page,
    pages: Math.max(1, Math.ceil(list.total / DICTIONARY_PAGE)),
  };
}

export function meta() {
  return [
    { title: "Vosa, the Fijian dictionary · NAISEMA" },
    {
      name: "description",
      content: "Fijian words and sayings with their English meanings, each reviewed for language.",
    },
  ];
}

export default function Dictionary({ loaderData }: Route.ComponentProps) {
  const { search, entries, total, page, pages } = loaderData;
  const query = (to: number) => `?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(to) })}`;
  return (
    <main id="main" className="area-page">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/learn">Learn</Link>
          </li>
          <li aria-current="page">Vosa dictionary</li>
        </ol>
      </nav>
      <article className="pane area-pane" aria-labelledby="dictionary-heading">
        <header className="pane-intro">
          <div className="pane-head tile-learn">
            <h1 id="dictionary-heading">Vosa, the Fijian dictionary</h1>
          </div>
          <p className="lede">
            Fijian words and sayings with their English meanings. Vosa is a learning guide, not an official dictionary:
            each entry here was reviewed for Standard Fijian, and meanings can still change after review.
          </p>
        </header>
        <Form method="get" role="search" className="public-form">
          <label htmlFor="q">Search a Fijian word or English meaning</label>
          <input id="q" name="q" type="search" defaultValue={search} maxLength={100} />
          <button type="submit">Search</button>
        </Form>
        {entries.length ? (
          <>
            <p>
              {total.toLocaleString("en")} {total === 1 ? "entry" : "entries"}
              {pages > 1 ? `, page ${page} of ${pages}` : ""}
            </p>
            <ul className="piece-list">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <Link to={`/learn/dictionary/${entry.id}`} lang="fj">
                    {entry.headword}
                  </Link>
                  <p>{entry.meaning}</p>
                  <p className="list-mark">{entry.kind === "saying" ? "Saying" : entry.partOfSpeech || "Word"}</p>
                </li>
              ))}
            </ul>
          </>
        ) : search ? (
          <p className="empty">No reviewed entry matches that yet.</p>
        ) : (
          <p className="not-open">
            <span className="from-label">Not open yet</span> The first entries appear here once they have been reviewed.
            Until then you can <a href="https://apps.naisema.com/dictionary/">try the preview on apps.naisema.com</a>.
          </p>
        )}
        {pages > 1 && (
          <nav aria-label="Pages" className="see-all">
            {page > 1 && <Link to={query(page - 1)}>Previous page</Link>}{" "}
            {page < pages && <Link to={query(page + 1)}>Next page</Link>}
          </nav>
        )}
        <p>
          Know a word that is missing?{" "}
          <Link to={`/forms/${SUBMISSION_TYPES.word_suggestion.path}`}>{SUBMISSION_TYPES.word_suggestion.title}</Link>.
        </p>
      </article>
    </main>
  );
}
