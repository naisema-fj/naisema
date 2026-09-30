import { ArticleBodyView } from "~/components/article-body-view";
import { embedsFor, getArticle, getRevision } from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import { listTopics } from "~/lib/topics.server";
import type { Route } from "./+types/revision";

export const handle = { hydrate: false };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Revision ${loaderData?.revision.number ?? ""} · Na iSema staff` }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db } = await requireEditor(context.get(cloudflareContext).env, request);
  const article = await getArticle(db, params.id);
  const revision = article && (await getRevision(db, article.id, Number(params.number)));
  if (!article || !revision) throw new Response("Not found", { status: 404 });
  const topicNames = new Map((await listTopics(db)).map((topic) => [topic.id, topic.name]));
  return {
    article,
    revision,
    topics: revision.snapshot.topicIds.map((id) => topicNames.get(id) ?? "A removed topic"),
    embeds: await embedsFor(db, revision.snapshot.body),
  };
}

export default function Revision({ loaderData }: Route.ComponentProps) {
  const { article, revision, topics, embeds } = loaderData;
  const { snapshot } = revision;
  return (
    <main id="main" className="page">
      <p>
        <a href={`/admin/articles/${article.id}/history`}>Back to revision history</a>
      </p>
      <p>
        Revision {revision.number} of {article.draft.snapshot.title}
      </p>
      <article className="article-preview">
        <h1>{snapshot.title}</h1>
        <p className="summary">{snapshot.summary}</p>
        <dl>
          <dt>Topics</dt>
          <dd>{topics.join(", ")}</dd>
          <dt>Credit</dt>
          <dd>{snapshot.credit}</dd>
        </dl>
        <ArticleBodyView body={snapshot.body} embeds={embeds} />
      </article>
    </main>
  );
}
