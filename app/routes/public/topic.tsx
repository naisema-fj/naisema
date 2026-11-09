import { eq, isNull } from "drizzle-orm";
import { Link } from "react-router";
import { topic } from "~db/schema";
import { cloudflareContext } from "~/lib/cloudflare";
import { publicItems } from "~/lib/content.server";
import { getDb } from "~/lib/db.server";
import { publicHeaders } from "~/lib/http";
import { itemCard } from "~/lib/public-view.server";
import type { Route } from "./+types/topic";

export const handle = { hydrate: false };
export const headers = publicHeaders;

/** GET /topics lists the Topics; GET /topics/:slug the eligible items under one, and its subtopics. */
export async function loader({ params, context }: Route.LoaderArgs) {
  const db = getDb(context.get(cloudflareContext).env.DB);
  if (!params.slug) {
    const topics = await db.select().from(topic).where(isNull(topic.parent)).orderBy(topic.name);
    return { kind: "all" as const, topics };
  }
  const chosen = await db.query.topic.findFirst({ where: eq(topic.slug, params.slug) });
  if (!chosen) throw new Response("Not found", { status: 404 });
  const [subtopics, items] = await Promise.all([
    db.select().from(topic).where(eq(topic.parent, chosen.slug)).orderBy(topic.name),
    publicItems(db, { topic: chosen.slug, limit: 50 }),
  ]);
  return { kind: "one" as const, topic: chosen, subtopics, items: items.map(itemCard) };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.kind === "one" ? loaderData.topic.name : "Topics"} · NAISEMA` }];
}

export default function Topics({ loaderData }: Route.ComponentProps) {
  if (loaderData.kind === "all") {
    return (
      <main id="main" className="area-page">
        <article className="pane area-pane">
          <h1>Topics</h1>
          {loaderData.topics.length ? (
            <ul className="piece-list">
              {loaderData.topics.map((row) => (
                <li key={row.slug}>
                  <Link to={`/topics/${row.slug}`}>{row.name}</Link>
                  {row.description && <p>{row.description}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No Topics yet.</p>
          )}
        </article>
      </main>
    );
  }
  const { topic: chosen, subtopics, items } = loaderData;
  return (
    <main id="main" className="area-page">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/topics">Topics</Link>
          </li>
          <li aria-current="page">{chosen.name}</li>
        </ol>
      </nav>
      <article className="pane area-pane">
        <h1>{chosen.name}</h1>
        {chosen.description && <p className="lede">{chosen.description}</p>}
        {subtopics.length > 0 && (
          <nav aria-label="Subtopics" className="area-sections">
            <ul>
              {subtopics.map((row) => (
                <li key={row.slug}>
                  <Link to={`/topics/${row.slug}`}>{row.name}</Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {items.length ? (
          <ul className="piece-list">
            {items.map((item) => (
              <li key={item.path}>
                <Link to={item.path}>{item.title}</Link>
                <p>{item.summary}</p>
                <p className="list-mark">{item.kindName}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Nothing has been published under {chosen.name} yet.</p>
        )}
      </article>
    </main>
  );
}
