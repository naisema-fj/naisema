import { Link } from "react-router";
import { DateMark } from "~/components/public/postmarks";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { publicHeaders } from "~/lib/public-cache.server";
import { listByTopics, publicCard, type SearchResult } from "~/lib/search.server";
import { topicBySlug } from "~/lib/topics.server";
import type { Route } from "./+types/topic";

export const handle = { hydrate: false };
export const headers = publicHeaders;

/** A Topic's page lists this many items; search pages through the rest. */
const TOPIC_PAGE_LIMIT = 30;

/**
 * /topics/{slug}, and /topics/{slug}/{subtopic} to filter by a subtopic (an address of its own, so
 * each filtered view is cached on its own). The lead feature comes first, then the newest items.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const db = getDb(context.get(cloudflareContext).env.DB);
  const topic = await topicBySlug(db, params.slug);
  if (!topic) throw new Response("Not found", { status: 404 });
  const subtopic = params.subtopic ? topic.subtopics.find((sub) => sub.slug === params.subtopic) : null;
  if (params.subtopic && !subtopic) throw new Response("Not found", { status: 404 });

  const topicIds = subtopic ? [subtopic.id] : [topic.id, ...topic.subtopics.map((sub) => sub.id)];
  const leadId = subtopic ? null : topic.leadItemId;
  const [lead, { listings, total }] = await Promise.all([
    leadId ? publicCard(db, leadId) : null,
    listByTopics(db, { topicIds, exceptId: leadId, limit: TOPIC_PAGE_LIMIT }),
  ]);
  return {
    topic: { name: topic.name, slug: topic.slug, description: topic.description },
    parent: topic.parent ? { name: topic.parent.name, slug: topic.parent.slug } : null,
    subtopics: topic.subtopics.map(({ name, slug }) => ({ name, slug })),
    subtopic: subtopic ? { name: subtopic.name, slug: subtopic.slug } : null,
    lead,
    items: listings,
    total,
  };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "NAISEMA" }];
  const name = loaderData.subtopic ? `${loaderData.subtopic.name} in ${loaderData.topic.name}` : loaderData.topic.name;
  return [
    { title: `${name} · NAISEMA` },
    { name: "description", content: loaderData.topic.description || `Everything on NAISEMA about ${name}.` },
  ];
}

function Card({ item }: { item: SearchResult }) {
  return (
    <li>
      <Link to={item.path}>{item.title}</Link>
      <p>{item.summary}</p>
      <p className="list-mark">
        {item.areaName} · {item.formatName}
        {item.publishedAt && (
          <>
            {" · "}
            <DateMark label="Published" date={item.publishedAt} />
          </>
        )}
      </p>
    </li>
  );
}

export default function Topic({ loaderData }: Route.ComponentProps) {
  const { topic, parent, subtopics, subtopic, lead, items, total } = loaderData;
  return (
    <main id="main">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/topics">Topics</Link>
          </li>
          {parent && (
            <li>
              <Link to={`/topics/${parent.slug}`}>{parent.name}</Link>
            </li>
          )}
          <li aria-current="page">{topic.name}</li>
        </ol>
      </nav>
      <article className="pane topic-pane" aria-labelledby="topic-heading">
        <header className="pane-head">
          <h1 id="topic-heading">{topic.name}</h1>
          {topic.description && <p className="lede">{topic.description}</p>}
        </header>

        {subtopics.length > 0 && (
          <nav aria-label={`Narrow ${topic.name} by subtopic`} className="subtopics">
            <ul>
              <li>
                <Link to={`/topics/${topic.slug}`} aria-current={subtopic ? undefined : "page"}>
                  All of {topic.name}
                </Link>
              </li>
              {subtopics.map((sub) => (
                <li key={sub.slug}>
                  <Link
                    to={`/topics/${topic.slug}/${sub.slug}`}
                    aria-current={subtopic?.slug === sub.slug ? "page" : undefined}
                  >
                    {sub.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {lead && (
          <section aria-labelledby="lead-heading" className="lead-feature">
            <h2 id="lead-heading">Featured</h2>
            <ul className="piece-list">
              <Card item={lead} />
            </ul>
          </section>
        )}

        <section aria-labelledby="items-heading">
          <h2 id="items-heading">{subtopic ? `In ${subtopic.name}` : `In ${topic.name}`}</h2>
          {items.length ? (
            <ul className="piece-list">
              {items.map((item) => (
                <Card key={item.id} item={item} />
              ))}
            </ul>
          ) : (
            !lead && <p className="empty">Nothing has been published in this topic yet.</p>
          )}
          {total > items.length && (
            <p className="see-all">
              <Link to="/search">Search for more</Link>
            </p>
          )}
        </section>
      </article>
    </main>
  );
}
