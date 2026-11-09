import { Link } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { dictionarySources, getDictionaryEntry } from "~/lib/dictionary.server";
import { requireLayerStaff } from "~/lib/learning-layers.server";
import type { Route } from "./+types/entry";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.entry.headword ?? "Draft"} · Vosa dictionary drafts · NAISEMA staff` }];
}

/** GET /admin/dictionary/:id — one draft word or saying, with what the apps site said and the sources it cites. */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db } = await requireLayerStaff(context.get(cloudflareContext).env, request);
  const entry = await getDictionaryEntry(db, params.id);
  if (!entry) throw new Response("Not found", { status: 404 });
  return {
    entry: {
      headword: entry.headword,
      kind: entry.kind,
      meaning: entry.meaning,
      literalMeaning: entry.literalMeaning,
      partOfSpeech: entry.partOfSpeech,
      themes: entry.themes,
      appsStatus: entry.appsStatus,
      importBatch: entry.importBatch,
      details: JSON.stringify(entry.details, null, 2),
    },
    sources: (await dictionarySources(db, entry.sourceIds)).map((source) => ({
      id: source.id,
      name: source.name,
      webUrl: source.webUrl,
    })),
  };
}

export default function DictionaryEntry({ loaderData }: Route.ComponentProps) {
  const { entry, sources } = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <Link to="/admin/dictionary">Back to the dictionary drafts</Link>
      </p>
      <h1 lang="fj">{entry.headword}</h1>
      <p className="meta">Draft {entry.kind}: needs review. Not public.</p>
      <dl>
        <dt>Meaning in English</dt>
        <dd>{entry.meaning}</dd>
        {entry.literalMeaning && (
          <>
            <dt>Literal meaning</dt>
            <dd>{entry.literalMeaning}</dd>
          </>
        )}
        {entry.partOfSpeech && (
          <>
            <dt>Part of speech or term type</dt>
            <dd>{entry.partOfSpeech}</dd>
          </>
        )}
        {entry.themes.length > 0 && (
          <>
            <dt>Themes</dt>
            <dd>{entry.themes.join(", ")}</dd>
          </>
        )}
        <dt>What the apps site said</dt>
        <dd>{entry.appsStatus || "Nothing"} (not a NAISEMA review)</dd>
        <dt>Imported in</dt>
        <dd>{entry.importBatch}</dd>
      </dl>
      <h2>Sources it cites</h2>
      {sources.length ? (
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
      ) : (
        <p>None recorded.</p>
      )}
      <details>
        <summary>The rest of the record, as the apps site had it</summary>
        <pre>{entry.details}</pre>
      </details>
    </main>
  );
}
