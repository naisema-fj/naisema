import { cloudflareContext } from "~/lib/cloudflare";
import { EXPORT_NAMES } from "~/lib/exports.server";
import { layersFor } from "~/lib/learning-layers.server";
import { can, EXPORT_KINDS } from "~/lib/permissions";
import { requireStaff } from "~/lib/staff.server";
import type { Route } from "./+types/index";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Exports · NAISEMA staff" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db, actor } = await requireStaff(context.get(cloudflareContext).env, request);
  const kinds = EXPORT_KINDS.filter((kind) => can(actor, { action: "export.run", kind }));
  if (!kinds.length) throw new Response("Your roles don't include any exports.", { status: 403 });
  return {
    kinds: kinds.filter((kind) => kind !== "learningLayer").map((kind) => ({ kind, name: EXPORT_NAMES[kind] })),
    layerName: EXPORT_NAMES.learningLayer,
    layers: kinds.includes("learningLayer")
      ? (await layersFor(db, actor)).map((layer) => ({ id: layer.id, title: layer.title }))
      : null,
  };
}

export default function Exports({ loaderData }: Route.ComponentProps) {
  const { kinds, layerName, layers } = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Exports</h1>
      <p>
        Each export downloads as one JSON file, described in the handover folder (docs/handover/exports.md). Every
        export is recorded in the audit log with who ran it and what it held.
      </p>
      {kinds.map(({ kind, name }) => (
        <form key={kind} method="post" action="/admin/exports/download" className="article-form">
          <h2>{name}</h2>
          <input type="hidden" name="kind" value={kind} />
          {kind === "contacts" && (
            <>
              <label htmlFor="purpose">What the contacts are for</label>
              <input id="purpose" name="purpose" required minLength={10} aria-describedby="purpose-hint" />
              <p id="purpose-hint">Recorded in the audit log with the export.</p>
            </>
          )}
          <button type="submit">Download</button>
        </form>
      ))}
      {layers && (
        <form method="post" action="/admin/exports/download" className="article-form">
          <h2>{layerName}</h2>
          <p>
            Every Revision, its Segments with tokens, captions as WebVTT, Annotations, Expressions, Activities and
            approvals, with its Video and what that needs, so it can be imported into an empty database.
          </p>
          <input type="hidden" name="kind" value="learningLayer" />
          {layers.length ? (
            <>
              <label htmlFor="learningLayerId">Learning Layer</label>
              <select id="learningLayerId" name="learningLayerId">
                {layers.map((layer) => (
                  <option key={layer.id} value={layer.id}>
                    {layer.title}
                  </option>
                ))}
              </select>
              <button type="submit">Download</button>
            </>
          ) : (
            <p>There are no Learning Layers yet.</p>
          )}
        </form>
      )}
    </main>
  );
}
