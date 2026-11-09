import { Link } from "react-router";
import { TableScroll } from "~/components/table-scroll";
import { cloudflareContext } from "~/lib/cloudflare";
import { listDictionarySources } from "~/lib/dictionary.server";
import { requireLayerStaff } from "~/lib/learning-layers.server";
import type { Route } from "./+types/sources";

export function meta() {
  return [{ title: "Sources the Vosa dictionary cites · NAISEMA staff" }];
}

/** GET /admin/dictionary/sources — every source the drafts cite, most-cited first: each needs a Rights Record before publication. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { db } = await requireLayerStaff(context.get(cloudflareContext).env, request);
  const sources = await listDictionarySources(db);
  return {
    sources: sources
      .sort((a, b) => b.citedBy - a.citedBy || a.name.localeCompare(b.name))
      .map((source) => ({
        id: source.id,
        name: source.name,
        role: source.role,
        kind: source.kind,
        webUrl: source.webUrl,
        citedBy: source.citedBy,
      })),
  };
}

export default function DictionarySources({ loaderData }: Route.ComponentProps) {
  const { sources } = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <Link to="/admin/dictionary">Back to the dictionary drafts</Link>
      </p>
      <h1>Sources the Vosa dictionary cites</h1>
      <p>
        Words taken from a source can be published only once NAISEMA has a Rights Record for it. The most-cited sources
        are first.
      </p>
      {sources.length ? (
        <TableScroll label="Sources the Vosa dictionary cites">
          <table>
            <caption>Sources, most-cited first</caption>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Kind</th>
                <th scope="col">Cited by</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id}>
                  <td>
                    {source.webUrl ? (
                      <a href={source.webUrl} rel="noopener">
                        {source.name}
                      </a>
                    ) : (
                      source.name
                    )}
                  </td>
                  <td>{[source.kind, source.role].filter(Boolean).join(", ")}</td>
                  <td>{source.citedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      ) : (
        <p>Nothing has been imported yet.</p>
      )}
    </main>
  );
}
