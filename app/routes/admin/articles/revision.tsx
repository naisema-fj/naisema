import { ArticleBodyView } from "~/components/article-body-view";
import type { ArticleSnapshot } from "~/lib/article-fields";
import { embedsFor, getArticle } from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import { getRevision } from "~/lib/revisions.server";
import { topicNamer } from "~/lib/topics.server";
import type { Route } from "./+types/revision";

export const handle = { hydrate: false };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `Revision ${loaderData.revision.number} · Na iSema staff` : "Na iSema staff" }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db } = await requireEditor(context.get(cloudflareContext).env, request);
  const article = await getArticle(db, params.id);
  const revision = article && (await getRevision<ArticleSnapshot>(db, article.id, Number(params.number)));
  if (!article || !revision) throw new Response("Not found", { status: 404 });
  const topicNames = await topicNamer(db);
  return {
    article,
    revision,
    topics: topicNames(revision.snapshot.topicIds),
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
        Revision {revision.number} of {article.currentRevision.snapshot.title}
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
