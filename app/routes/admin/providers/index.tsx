import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import { listProviders } from "~/lib/providers.server";
import type { Route } from "./+types/index";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Providers · NAISEMA staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db } = await requireEditor(context.get(cloudflareContext).env, request);
  return { providers: await listProviders(db) };
}

export default function Providers({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Providers</h1>
      <p>
        Organisations and people whose learning Offerings are listed under Connect. A listing implies no partnership or
        endorsement; a Provider is shown as a Partner only while a Partnership Agreement is recorded.
      </p>
      <p>
        <a href="/admin/providers/new">Add a provider</a>
      </p>
      {loaderData.providers.length ? (
        <ul>
          {loaderData.providers.map((row) => (
            <li key={row.id}>
              <a href={`/admin/providers/${row.id}`}>{row.name}</a>
              {row.listed ? "" : " (not listed)"}
            </li>
          ))}
        </ul>
      ) : (
        <p>No providers yet.</p>
      )}
    </main>
  );
}
