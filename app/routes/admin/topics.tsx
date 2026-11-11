import { eq } from "drizzle-orm";
import { data, Form, redirect } from "react-router";
import { WhatsThis } from "~/components/whats-this";
import { audit } from "~/lib/audit.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { slugify } from "~/lib/slug";
import { requireStaff } from "~/lib/staff.server";
import { topic } from "~db/schema";
import type { Route } from "./+types/topics";

/** /admin/topics: the Topics editors file items under, with at most one level of subtopics. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireStaff(env, request, "content.edit");
  return { topics: await getDb(env.DB).select().from(topic).orderBy(topic.name) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireStaff(env, request, "content.edit");
  const db = getDb(env.DB);
  const form = await request.formData();
  const name = String(form.get("name") ?? "")
    .trim()
    .slice(0, 100);
  const parent = String(form.get("parent") ?? "") || null;
  const slug = slugify(name);
  if (!slug) return data({ error: "Enter the Topic's name." }, { status: 400 });
  if (await db.query.topic.findFirst({ where: eq(topic.slug, slug) }))
    return data({ error: "That Topic already exists." }, { status: 400 });
  if (parent) {
    const above = await db.query.topic.findFirst({ where: eq(topic.slug, parent) });
    if (!above || above.parent) return data({ error: "A subtopic goes under a top-level Topic." }, { status: 400 });
  }
  await db.batch([
    db.insert(topic).values({
      slug,
      name,
      description: String(form.get("description") ?? "")
        .trim()
        .slice(0, 500),
      parent,
    }),
    audit(db, actor.email, "topic.added", { type: "topic", id: slug }),
  ]);
  return redirect("/admin/topics");
}

export function meta() {
  return [{ title: "Topics · NAISEMA staff" }];
}

export default function Topics({ loaderData, actionData }: Route.ComponentProps) {
  const top = loaderData.topics.filter((row) => !row.parent);
  return (
    <main id="main" className="page">
      <h1>Topics</h1>
      <WhatsThis summary="What are Topics?">
        <p>
          A Topic is a subject that items are tagged with. Each has its own page on the public site and gathers items
          from every area. A Topic can sit under one broader Topic, one level only. You tag an item with Topics on its
          own page.
        </p>
      </WhatsThis>
      <ul>
        {top.map((row) => (
          <li key={row.slug}>
            {row.name}
            <ul>
              {loaderData.topics
                .filter((child) => child.parent === row.slug)
                .map((child) => (
                  <li key={child.slug}>{child.name}</li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
      <Form method="post" aria-labelledby="add-heading">
        <h2 id="add-heading">Add a Topic</h2>
        {actionData?.error && (
          <p role="alert" className="error">
            {actionData.error}
          </p>
        )}
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required maxLength={100} />
        <label htmlFor="description">Description</label>
        <input id="description" name="description" maxLength={500} />
        <label htmlFor="parent">Under</label>
        <select id="parent" name="parent">
          <option value="">Nothing (a top-level Topic)</option>
          {top.map((row) => (
            <option key={row.slug} value={row.slug}>
              {row.name}
            </option>
          ))}
        </select>
        <button type="submit">Add</button>
      </Form>
    </main>
  );
}
