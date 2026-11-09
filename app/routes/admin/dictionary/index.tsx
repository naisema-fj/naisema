import { data, Form, Link } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { canImportDictionary, DICTIONARY_PAGE, importVosaBundle, listDictionary } from "~/lib/dictionary.server";
import { requireLayerStaff } from "~/lib/learning-layers.server";
import { readVosaBundle, VOSA_MAX_BYTES } from "~/lib/vosa-bundle";
import type { Route } from "./+types/index";

export function meta() {
  return [{ title: "Vosa dictionary drafts · NAISEMA staff" }];
}

/**
 * GET /admin/dictionary — the Vosa dictionary's words and sayings, imported from apps.naisema.com
 * as drafts. None is public and none is an Expression; each waits for review. Editors and Educators
 * can read them; editors import a newer data file.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { db, actor } = await requireLayerStaff(context.get(cloudflareContext).env, request);
  const params = new URL(request.url).searchParams;
  const search = params.get("q") ?? "";
  const kind = params.get("kind") ?? "";
  const list = await listDictionary(db, { search, kind, page: Number(params.get("page")) || 1 });
  return {
    search,
    kind,
    canImport: canImportDictionary(actor),
    total: list.total,
    page: list.page,
    pages: Math.max(1, Math.ceil(list.total / DICTIONARY_PAGE)),
    entries: list.rows.map((row) => ({
      id: row.id,
      headword: row.headword,
      meaning: row.meaning,
      kind: row.kind,
      partOfSpeech: row.partOfSpeech,
    })),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { db, actor } = await requireLayerStaff(context.get(cloudflareContext).env, request);
  if (!canImportDictionary(actor)) throw new Response("Only editors import the dictionary.", { status: 403 });
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || file.size === 0) {
    return data({ error: "Choose the Vosa data.js file to import.", imported: null }, { status: 400 });
  }
  if (file.size > VOSA_MAX_BYTES) {
    return data({ error: "That file is larger than any Vosa data file.", imported: null }, { status: 400 });
  }
  const read = readVosaBundle(await file.text());
  if (!read.ok) return data({ error: read.error, imported: null }, { status: 400 });
  const imported = await importVosaBundle(db, actor, read.bundle);
  return { error: null, imported: { ...imported, skipped: read.skipped } };
}

const counted = (number: number, one: string, many: string) => `${number} ${number === 1 ? one : many}`;

function importedText(imported: { words: number; sayings: number; sources: number; skipped: number }) {
  const skipped = imported.skipped
    ? `; ${counted(imported.skipped, "record was", "records were")} skipped as incomplete`
    : "";
  return `Imported ${counted(imported.words, "word", "words")}, ${counted(imported.sayings, "saying", "sayings")} and ${counted(imported.sources, "source", "sources")} as drafts${skipped}.`;
}

const KINDS = { "": "Words and sayings", word: "Words", saying: "Sayings" } as const;

export default function Dictionary({ loaderData, actionData }: Route.ComponentProps) {
  const { search, kind, total, page, pages, entries, canImport } = loaderData;
  const query = (to: number) => `?${new URLSearchParams({ q: search, kind, page: String(to) })}`;
  return (
    <main id="main" className="page">
      <h1>Vosa dictionary drafts</h1>
      <p>
        Words, terms and sayings from the Vosa dictionary on apps.naisema.com. Every one here is a draft that needs
        review: none is public, and none is an Expression that Annotations can use. The sources each one cites need a
        Rights Record before anything taken from them is published.
      </p>
      <p>
        <Link to="/admin/dictionary/sources">Sources the dictionary cites</Link>
      </p>
      {actionData?.imported && <p role="status">{importedText(actionData.imported)}</p>}
      {actionData?.error && (
        <p role="alert" className="error">
          {actionData.error}
        </p>
      )}
      <Form method="get" role="search" className="inline-form">
        <label htmlFor="q">Search</label>
        <input id="q" name="q" type="search" defaultValue={search} />
        <label htmlFor="kind">Show</label>
        <select id="kind" name="kind" defaultValue={kind}>
          {Object.entries(KINDS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit">Search</button>
      </Form>
      <p>
        {total.toLocaleString("en")} {total === 1 ? "draft" : "drafts"}
        {pages > 1 ? `, page ${page} of ${pages}` : ""}
      </p>
      {entries.length ? (
        <ul className="item-list">
          {entries.map((row) => (
            <li key={row.id}>
              <a href={`/admin/dictionary/${row.id}`} lang="fj">
                {row.headword}
              </a>
              <span className="meta">
                {row.kind === "saying" ? "saying" : row.partOfSpeech || "word"} · {row.meaning}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>{search || kind ? "Nothing matches that." : "Nothing has been imported yet."}</p>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="inline-form">
          {page > 1 && <Link to={query(page - 1)}>Previous page</Link>}
          {page < pages && <Link to={query(page + 1)}>Next page</Link>}
        </nav>
      )}
      {canImport && (
        <section aria-labelledby="import-heading">
          <h2 id="import-heading">Import a newer data file</h2>
          <p>
            Download data.js from apps.naisema.com/dictionary/ and choose it here. Drafts already here are refreshed
            from it and new ones are added; nothing is published.
          </p>
          <Form method="post" encType="multipart/form-data" className="article-form">
            <label htmlFor="file">Vosa data file (data.js)</label>
            <input id="file" name="file" type="file" accept=".js,.json,application/javascript,application/json" />
            <button type="submit">Import as drafts</button>
          </Form>
        </section>
      )}
    </main>
  );
}
