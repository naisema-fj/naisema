import { data, Form, redirect } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireRightsManager } from "~/lib/content.server";
import { createContributor, listContributors } from "~/lib/contributors.server";
import type { Route } from "./+types/contributors";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Contributors · NAISEMA staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db } = await requireRightsManager(context.get(cloudflareContext).env, request);
  return { contributors: await listContributors(db) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { db, actor } = await requireRightsManager(context.get(cloudflareContext).env, request);
  const form = await request.formData();
  const result = await createContributor(
    db,
    actor.userId,
    String(form.get("name") ?? "").trim(),
    String(form.get("notes") ?? "").trim(),
  );
  if (!result.ok) return data({ error: result.error }, { status: 400 });
  throw redirect("/admin/contributors");
}

export default function Contributors({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Contributors</h1>
      <p>
        Anyone whose story, recording or knowledge appears in NAISEMA content. Rights Records say which contributors
        they cover. Don't record contact details here.
      </p>
      {loaderData.contributors.length ? (
        <ul>
          {loaderData.contributors.map((person) => (
            <li key={person.id}>
              {person.name}
              {person.notes && `: ${person.notes}`}
            </li>
          ))}
        </ul>
      ) : (
        <p>No contributors yet.</p>
      )}
      <h2>Add a contributor</h2>
      <Form method="post">
        <label htmlFor="contributor-name">Name</label>
        <input
          id="contributor-name"
          name="name"
          required
          maxLength={200}
          aria-describedby={actionData?.error ? "contributor-error" : undefined}
        />
        {actionData?.error && (
          <p id="contributor-error" className="field-error" role="alert">
            {actionData.error}
          </p>
        )}
        <label htmlFor="contributor-notes">Notes</label>
        <input id="contributor-notes" name="notes" maxLength={500} />
        <button type="submit">Add contributor</button>
      </Form>
    </main>
  );
}
