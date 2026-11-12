import { eq, isNull } from "drizzle-orm";
import { ArrowRight, Tag, Tags } from "lucide-react";
import { Link } from "react-router";
import { Icon } from "~/components/icons";
import { BackLink, PageHead, PieceList } from "~/components/public/parts";
import { cloudflareContext } from "~/lib/cloudflare";
import { publicItems } from "~/lib/content.server";
import { getDb } from "~/lib/db.server";
import { publicHeaders } from "~/lib/http";
import { itemCard } from "~/lib/public-view.server";
import { topic } from "~db/schema";
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
        <article className="pane pane-wide area-pane">
          <BackLink to="/">Home</BackLink>
          <PageHead
            tone="none"
            icon={Tags}
            title="Topics"
            plate={<p className="lede">Topics cut across every area.</p>}
          />
          {loaderData.topics.length ? (
            <ul className="topic-grid">
              {loaderData.topics.map((row) => (
                <li key={row.slug}>
                  <Link to={`/topics/${row.slug}`} className="helper">
                    <span className="seat seat-small tone-voices-soft">
                      <Icon icon={Tag} />
                    </span>
                    <span className="helper-text">
                      <strong>{row.name}</strong>
                      {row.description && <span className="helper-sub">{row.description}</span>}
                    </span>
                    <Icon icon={ArrowRight} className="helper-arrow" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="shelf-empty">No Topics yet.</p>
          )}
        </article>
      </main>
    );
  }
  const { topic: chosen, subtopics, items } = loaderData;
  return (
    <main id="main" className="area-page">
      <article className="pane pane-wide area-pane">
        <BackLink to="/topics">All Topics</BackLink>
        <PageHead
          tone="none"
          icon={Tag}
          title={chosen.name}
          plate={chosen.description ? <p className="lede">{chosen.description}</p> : undefined}
        />
        {subtopics.length > 0 && (
          <nav aria-label="Subtopics" className="chip-links">
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
          <PieceList items={items} showArea />
        ) : (
          <p className="shelf-empty">Nothing has been published under {chosen.name} yet.</p>
        )}
      </article>
    </main>
  );
}
