import { Link } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { publicHeaders } from "~/lib/public-cache.server";
import { listTopics } from "~/lib/topics.server";
import type { Route } from "./+types/topics";

export const handle = { hydrate: false };
export const headers = publicHeaders;

/** Every Topic, broader ones with their subtopics, linking to each Topic's page. */
export async function loader({ context }: Route.LoaderArgs) {
  const topics = await listTopics(getDb(context.get(cloudflareContext).env.DB));
  return {
    topics: topics
      .filter((topic) => !topic.parentTopicId)
      .map((topic) => ({
        name: topic.name,
        slug: topic.slug,
        subtopics: topics
          .filter((sub) => sub.parentTopicId === topic.id)
          .map((sub) => ({ name: sub.name, slug: sub.slug })),
      })),
  };
}

export function meta() {
  return [{ title: "Topics · Na iSema" }];
}

export default function Topics({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main">
      <article className="letter letter-narrow" aria-labelledby="topics-heading">
        <h1 id="topics-heading">Topics</h1>
        {loaderData.topics.length ? (
          <ul className="topic-index">
            {loaderData.topics.map((topic) => (
              <li key={topic.slug}>
                <Link to={`/topics/${topic.slug}`}>{topic.name}</Link>
                {topic.subtopics.length > 0 && (
                  <ul>
                    {topic.subtopics.map((sub) => (
                      <li key={sub.slug}>
                        <Link to={`/topics/${topic.slug}/${sub.slug}`}>{sub.name}</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>There are no topics yet.</p>
        )}
      </article>
    </main>
  );
}
