import { Form } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { listExpressions } from "~/lib/expressions.server";
import { LAYER_LANGUAGE_VARIETY } from "~/lib/learning-layer-fields";
import { requireLayerStaff } from "~/lib/learning-layers.server";
import type { Route } from "./+types/index";

export function meta() {
  return [{ title: "Expressions · NAISEMA staff" }];
}

/**
 * GET /admin/expressions — the Expression library for Standard Fijian, searchable by word, phrase
 * or meaning, for editors and Educators. Expressions are added while annotating a Learning Layer.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { db } = await requireLayerStaff(context.get(cloudflareContext).env, request);
  const search = new URL(request.url).searchParams.get("q") ?? "";
  const expressions = await listExpressions(db, LAYER_LANGUAGE_VARIETY, search);
  return {
    search,
    expressions: expressions.map((row) => ({
      id: row.id,
      headword: row.headword,
      generalMeaning: row.generalMeaning,
      idiom: row.literalMeaning !== null,
    })),
  };
}

export default function Expressions({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin/learning-layers">Back to Learning Layers</a>
      </p>
      <h1>Expressions</h1>
      <p>
        Words and phrases with their meanings, reused by Annotations across Learning Layers. They are added while
        annotating a Learning Layer.
      </p>
      <Form method="get" role="search" className="inline-form">
        <label htmlFor="q">Search</label>
        <input id="q" name="q" type="search" defaultValue={loaderData.search} />
        <button type="submit">Search</button>
      </Form>
      {loaderData.expressions.length ? (
        <ul className="item-list">
          {loaderData.expressions.map((row) => (
            <li key={row.id}>
              <a href={`/admin/expressions/${row.id}`} lang="fj">
                {row.headword}
              </a>
              <span className="meta">
                {row.generalMeaning}
                {row.idiom ? " · idiom" : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>{loaderData.search ? "Nothing matches that." : "No Expressions yet."}</p>
      )}
    </main>
  );
}
