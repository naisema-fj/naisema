import { Link } from "react-router";
import { Postmarks } from "~/components/public/postmarks";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { getPublicEntry } from "~/lib/dictionary.server";
import { LAYER_LANGUAGE_VARIETY } from "~/lib/learning-layer-fields";
import { publicHeaders } from "~/lib/public-cache.server";
import { languageVarietyName } from "~/lib/review-labels";
import { formatDay } from "~/lib/rights-rules";
import { SUBMISSION_TYPES } from "~/lib/submission-fields";
import type { Route } from "./+types/dictionary-entry";

export const handle = { hydrate: false };
export const headers = publicHeaders;

/** One public dictionary entry, with the review it actually had (PUB-02) and the sources it cites. */
export async function loader({ params, context }: Route.LoaderArgs) {
  const found = await getPublicEntry(getDb(context.get(cloudflareContext).env.DB), params.id);
  if (!found) throw new Response("Not found", { status: 404 });
  const { entry, sources } = found;
  return {
    entry: {
      headword: entry.headword,
      kind: entry.kind,
      meaning: entry.meaning,
      literalMeaning: entry.literalMeaning,
      partOfSpeech: entry.partOfSpeech,
    },
    reviewLabel: `Reviewed for language (${languageVarietyName(LAYER_LANGUAGE_VARIETY)}) on ${formatDay(entry.approvedAt ?? entry.importedAt)}`,
    sources: sources.map((source) => ({ id: source.id, name: source.name, webUrl: source.webUrl })),
  };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Vosa dictionary · NAISEMA" }];
  return [
    { title: `${loaderData.entry.headword} · Vosa dictionary · NAISEMA` },
    { name: "description", content: loaderData.entry.meaning },
  ];
}

export default function DictionaryEntry({ loaderData }: Route.ComponentProps) {
  const { entry, reviewLabel, sources } = loaderData;
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
          <li>
            <Link to="/learn/dictionary">Vosa dictionary</Link>
          </li>
          <li aria-current="page" lang="fj">
            {entry.headword}
          </li>
        </ol>
      </nav>
      <article className="pane pane-narrow" aria-labelledby="entry-heading">
        <h1 id="entry-heading" lang="fj">
          {entry.headword}
        </h1>
        <p className="list-mark">{entry.kind === "saying" ? "Saying" : entry.partOfSpeech || "Word"}</p>
        <p className="standfirst">{entry.meaning}</p>
        {entry.literalMeaning && (
          <p>
            <span className="from-label">Word for word</span> {entry.literalMeaning}
          </p>
        )}
        <section className="review-labels" aria-labelledby="reviewed-heading">
          <h2 id="reviewed-heading" className="review-labels-heading">
            Review Labels
          </h2>
          <Postmarks label="Review Labels">
            <li>{reviewLabel}</li>
          </Postmarks>
        </section>
        {sources.length > 0 && (
          <section aria-labelledby="sources-heading">
            <h2 id="sources-heading">Sources</h2>
            <ul>
              {sources.map((source) => (
                <li key={source.id}>
                  {source.webUrl ? (
                    <a href={source.webUrl} rel="noopener">
                      {source.name}
                    </a>
                  ) : (
                    source.name
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <p>
          Vosa is a learning guide, not an official dictionary. Something wrong here?{" "}
          <Link to={`/forms/${SUBMISSION_TYPES.entry_correction.path}`}>{SUBMISSION_TYPES.entry_correction.title}</Link>
          .
        </p>
      </article>
    </main>
  );
}
