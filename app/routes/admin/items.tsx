import { data, Form, redirect } from "react-router";
import { AREA_NAMES, isPrimaryArea } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import { CONTENT_KINDS, type ContentKind, isContentKind, KINDS, type Place } from "~/lib/content-rules";
import { createItem, listItems, mayEdit, Refused } from "~/lib/content.server";
import { getDb } from "~/lib/db.server";
import { requireStaff } from "~/lib/staff.server";
import type { Route } from "./+types/items";

const placeName = (place: string) => (isPrimaryArea(place) ? AREA_NAMES[place] : "Footer page");

const STATE_NAMES = { draft: "Not published", published: "Published", withdrawn: "Withdrawn", archived: "Archived" };

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireStaff(env, request);
  const kinds = CONTENT_KINDS.filter((kind) => mayEdit(actor, kind));
  if (!kinds.length) throw new Response("Your roles don't include editing content.", { status: 403 });
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "";
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const items = await listItems(getDb(env.DB), { kind: isContentKind(kind) ? kind : undefined, query });
  return {
    kinds: kinds.map((value) => ({ value, name: KINDS[value].name, places: KINDS[value].places })),
    items: items.filter((item) => mayEdit(actor, item.kind)),
    kind,
    query,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireStaff(env, request);
  const form = await request.formData();
  const [kind, place] = String(form.get("kindPlace") ?? "").split("|");
  if (!isContentKind(kind)) return data({ error: "Choose what you're adding." }, { status: 400 });
  try {
    const id = await createItem(getDb(env.DB), actor, {
      kind: kind as ContentKind,
      place: place as Place,
      title: String(form.get("title") ?? ""),
    });
    return redirect(`/admin/items/${id}`);
  } catch (error) {
    if (error instanceof Refused) return data({ error: error.message }, { status: error.status });
    throw error;
  }
}

export function meta() {
  return [{ title: "Content · NAISEMA staff" }];
}

export default function Items({ loaderData, actionData }: Route.ComponentProps) {
  const { kinds, items } = loaderData;
  return (
    <main id="main" className="page">
      <h1>Content</h1>
      <section aria-labelledby="add-heading">
        <h2 id="add-heading">Add something</h2>
        <Form method="post">
          {actionData?.error && (
            <p role="alert" className="error">
              {actionData.error}
            </p>
          )}
          <label htmlFor="add-kind">What it is, and where it goes</label>
          <select id="add-kind" name="kindPlace" required>
            {kinds.flatMap((kind) =>
              kind.places.map((place) => (
                <option key={`${kind.value}|${place}`} value={`${kind.value}|${place}`}>
                  {`${kind.name} in ${placeName(place)}`}
                </option>
              )),
            )}
          </select>
          <label htmlFor="add-title">Title</label>
          <input id="add-title" name="title" required maxLength={200} />
          <button type="submit">Add and start writing</button>
        </Form>
      </section>

      <section aria-labelledby="list-heading">
        <h2 id="list-heading">Everything</h2>
        <form method="get" className="filters">
          <label htmlFor="filter-kind">Kind</label>
          <select id="filter-kind" name="kind" defaultValue={loaderData.kind}>
            <option value="">All kinds</option>
            {kinds.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.name}
              </option>
            ))}
          </select>
          <label htmlFor="filter-q">Title contains</label>
          <input id="filter-q" name="q" defaultValue={loaderData.query} maxLength={100} />
          <button type="submit">Show</button>
        </form>
        {items.length ? (
          <div className="table-scroll" role="region" aria-labelledby="list-heading" tabIndex={0}>
            <table>
              <caption className="visually-hidden">Content, most recently changed first</caption>
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Where</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <a href={`/admin/items/${item.id}`}>{item.title}</a>
                    </td>
                    <td>{KINDS[item.kind].name}</td>
                    <td>{placeName(item.area)}</td>
                    <td>{STATE_NAMES[item.state]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Nothing here yet.</p>
        )}
      </section>
    </main>
  );
}
