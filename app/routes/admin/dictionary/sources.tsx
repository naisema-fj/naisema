import { Form, Link, redirect } from "react-router";
import { TableScroll } from "~/components/table-scroll";
import { cloudflareContext } from "~/lib/cloudflare";
import {
  canClearSource,
  entriesCiting,
  listDictionarySources,
  publicDictionaryPaths,
  requireDictionaryStaff,
  setSourceClearance,
} from "~/lib/dictionary.server";
import { purgePublicPages } from "~/lib/public-cache.server";
import type { Route } from "./+types/sources";

export function meta() {
  return [{ title: "Sources the Vosa dictionary cites · NAISEMA staff" }];
}

/** GET /admin/dictionary/sources — every source the drafts cite, most-cited first: each needs a Rights Record before publication. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { db, actor } = await requireDictionaryStaff(context.get(cloudflareContext).env, request);
  const sources = await listDictionarySources(db);
  return {
    canClear: canClearSource(actor),
    sources: sources
      .sort((a, b) => b.citedBy - a.citedBy || a.name.localeCompare(b.name))
      .map((source) => ({
        id: source.id,
        name: source.name,
        role: source.role,
        kind: source.kind,
        webUrl: source.webUrl,
        citedBy: source.citedBy,
        clearanceNote: source.clearedAt ? source.clearanceNote : null,
      })),
  };
}

const NOTE_LIMIT = 500;

/** POST: an editor clears a source (with why) or removes its clearance. */
export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireDictionaryStaff(env, request);
  const form = await request.formData();
  const sourceId = String(form.get("source") ?? "");
  const clearing = form.get("intent") === "clear";
  const note = String(form.get("note") ?? "")
    .trim()
    .slice(0, NOTE_LIMIT);
  if (clearing && !note) return { error: "Say why NAISEMA may publish what it takes from this source." };
  if (!(await setSourceClearance(db, actor, sourceId, clearing ? note : null))) {
    throw new Response("Only editors clear sources.", { status: 403 });
  }
  const ids = await entriesCiting(db, sourceId);
  await purgePublicPages(env, [...new Set(ids.flatMap((id) => publicDictionaryPaths(id)))]);
  return redirect("/admin/dictionary/sources");
}

export default function DictionarySources({ loaderData, actionData }: Route.ComponentProps) {
  const { sources, canClear } = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <Link to="/admin/dictionary">Back to the dictionary drafts</Link>
      </p>
      <h1>Sources the Vosa dictionary cites</h1>
      <p>
        An entry is public only once every source it cites is cleared: an editor records that NAISEMA may publish what
        the entry takes from it (the team's own work, or permission held as a Rights Record), and why. The most-cited
        sources are first.
      </p>
      {actionData?.error && (
        <p role="alert" className="error">
          {actionData.error}
        </p>
      )}
      {sources.length ? (
        <TableScroll label="Sources the Vosa dictionary cites">
          <table>
            <caption>Sources, most-cited first</caption>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Kind</th>
                <th scope="col">Cited by</th>
                <th scope="col">Cleared</th>
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
                  <td>
                    {source.clearanceNote ?? "Not yet"}
                    {canClear && (
                      <Form method="post" className="inline-form">
                        <input type="hidden" name="source" value={source.id} />
                        {source.clearanceNote === null ? (
                          <>
                            <input type="hidden" name="intent" value="clear" />
                            <label htmlFor={`note-${source.id}`}>Why it may be published</label>
                            <input id={`note-${source.id}`} name="note" maxLength={NOTE_LIMIT} />
                            <button type="submit">Clear</button>
                          </>
                        ) : (
                          <>
                            <input type="hidden" name="intent" value="unclear" />
                            <button type="submit">Remove clearance</button>
                          </>
                        )}
                      </Form>
                    )}
                  </td>
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
