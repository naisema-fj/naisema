import { data, Form, redirect } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import { TOPIC_NAME_LIMIT } from "~/lib/topics";
import { createTopic, listTopics } from "~/lib/topics.server";
import type { Route } from "./+types/topics";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Topics · Na iSema staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db } = await requireEditor(context.get(cloudflareContext).env, request);
  return { topics: await listTopics(db) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { db, actor } = await requireEditor(context.get(cloudflareContext).env, request);
  const form = await request.formData();
  const result = await createTopic(db, actor.userId, String(form.get("name") ?? ""));
  if (!result.ok) return data({ error: result.error }, { status: 400 });
  throw redirect("/admin/topics");
}

export default function Topics({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Topics</h1>
      <p>Topics tag Content Items by subject. Each topic gets its own page on the public site later.</p>
      {loaderData.topics.length ? (
        <ul>
          {loaderData.topics.map((topic) => (
            <li key={topic.id}>{topic.name}</li>
          ))}
        </ul>
      ) : (
        <p>No topics yet.</p>
      )}

      <h2>Add a topic</h2>
      <Form method="post">
        <label htmlFor="topic-name">Name</label>
        <input
          id="topic-name"
          name="name"
          required
          maxLength={TOPIC_NAME_LIMIT}
          aria-describedby={actionData?.error ? "topic-name-error" : undefined}
        />
        {actionData?.error && (
          <p id="topic-name-error" role="alert">
            {actionData.error}
          </p>
        )}
        <button type="submit">Add topic</button>
      </Form>
    </main>
  );
}
