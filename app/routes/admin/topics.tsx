import { data, Form, redirect } from "react-router";
import { listArticles } from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import { purgePublicPages } from "~/lib/public-cache.server";
import { TOPIC_DESCRIPTION_LIMIT, TOPIC_NAME_LIMIT } from "~/lib/topics";
import { createTopic, listTopics, updateTopic } from "~/lib/topics.server";
import type { Route } from "./+types/topics";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Topics · NAISEMA staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db } = await requireEditor(context.get(cloudflareContext).env, request);
  const [topics, items] = await Promise.all([listTopics(db), listArticles(db)]);
  return {
    topics: topics.map((topic) => ({
      ...topic,
      // A lead feature is chosen from the items tagged with the Topic.
      candidates: items
        .filter((item) => item.topicIds.includes(topic.id))
        .map(({ id, title, typeName }) => ({ id, title, typeName })),
    })),
    updated: new URL(request.url).searchParams.get("updated"),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireEditor(env, request);
  const form = await request.formData();
  if (form.get("intent") === "update") {
    const id = String(form.get("topicId") ?? "");
    const result = await updateTopic(db, actor.userId, id, {
      description: String(form.get("description") ?? ""),
      parentTopicId: String(form.get("parentTopicId") ?? "") || null,
      leadItemId: String(form.get("leadItemId") ?? "") || null,
    });
    if (!result.ok) return data({ error: null, updateError: { id, message: result.error } }, { status: 400 });
    await purgePublicPages(env, ["/topics", ...(result.paths ?? [])]);
    throw redirect(`/admin/topics?updated=${id}`);
  }
  const result = await createTopic(db, actor.userId, String(form.get("name") ?? ""));
  if (!result.ok) return data({ error: result.error, updateError: null }, { status: 400 });
  await purgePublicPages(env, ["/topics"]);
  throw redirect("/admin/topics");
}

export default function Topics({ loaderData, actionData }: Route.ComponentProps) {
  const { topics, updated } = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Topics</h1>
      <p>
        Topics tag Content Items by subject. Each has a page on the public site at /topics/ followed by its address,
        with its description, a lead feature and its items; a subtopic narrows its broader topic's page.
      </p>

      {topics.map((topic) => {
        const error = actionData?.updateError?.id === topic.id ? actionData.updateError.message : null;
        return (
          <section key={topic.id} aria-labelledby={`topic-${topic.id}`}>
            <h2 id={`topic-${topic.id}`}>{topic.name}</h2>
            <p>
              Public page: <a href={`/topics/${topic.slug}`}>/topics/{topic.slug}</a>
            </p>
            {updated === topic.id && !actionData && <p role="status">Saved.</p>}
            <Form method="post" className="article-form">
              <input type="hidden" name="intent" value="update" />
              <input type="hidden" name="topicId" value={topic.id} />
              <label htmlFor={`description-${topic.id}`}>Description</label>
              <textarea
                id={`description-${topic.id}`}
                name="description"
                rows={3}
                maxLength={TOPIC_DESCRIPTION_LIMIT}
                defaultValue={topic.description}
              />
              <label htmlFor={`parent-${topic.id}`}>Sits under (makes it a subtopic)</label>
              <select id={`parent-${topic.id}`} name="parentTopicId" defaultValue={topic.parentTopicId ?? ""}>
                <option value="">Nothing: it is a broader topic</option>
                {topics
                  .filter((other) => other.id !== topic.id && !other.parentTopicId)
                  .map((other) => (
                    <option key={other.id} value={other.id}>
                      {other.name}
                    </option>
                  ))}
              </select>
              <label htmlFor={`lead-${topic.id}`}>Lead feature</label>
              <select id={`lead-${topic.id}`} name="leadItemId" defaultValue={topic.leadItemId ?? ""}>
                <option value="">None</option>
                {topic.candidates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} ({item.typeName})
                  </option>
                ))}
              </select>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit">Save {topic.name}</button>
            </Form>
          </section>
        );
      })}
      {!topics.length && <p>No topics yet.</p>}

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
