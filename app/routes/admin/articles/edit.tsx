import { data, redirect } from "react-router";
import { ArticleForm } from "~/components/article-form";
import { articleFingerprints, embeddableArticles, getArticle, readArticleForm } from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import { appendRevision } from "~/lib/revisions.server";
import { listTopics } from "~/lib/topics.server";
import type { Route } from "./+types/edit";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.article.currentRevision.snapshot.title ?? "Article"} · Na iSema staff` }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db } = await requireEditor(context.get(cloudflareContext).env, request);
  const article = await getArticle(db, params.id);
  if (!article) throw new Response("Not found", { status: 404 });
  const saved = new URL(request.url).searchParams.get("saved");
  return {
    article,
    saved: saved === String(article.currentRevision.number) ? article.currentRevision.number : null,
    topics: await listTopics(db),
    embeddable: await embeddableArticles(db, article.id),
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { db, actor } = await requireEditor(context.get(cloudflareContext).env, request);
  const form = await request.formData();
  // A refused form keeps the revision it was opened from, so sending it again is refused again
  // instead of quietly landing on top of someone else's newer revision.
  const baseRevisionId = String(form.get("baseRevisionId") ?? "");
  const result = await readArticleForm(db, form);
  if (!result.ok) {
    return data({ errors: result.errors, values: result.values, error: null, baseRevisionId }, { status: 400 });
  }

  const saved = await appendRevision(db, {
    contentItemId: params.id,
    type: "article",
    baseRevisionId,
    snapshot: result.snapshot,
    fingerprints: await articleFingerprints(result.snapshot),
    savedBy: actor.userId,
  });
  if (!saved.ok) {
    return data({ errors: {}, values: result.snapshot, error: saved.error, baseRevisionId }, { status: 409 });
  }
  throw redirect(`/admin/articles/${params.id}?saved=${saved.number}`);
}

export default function EditArticle({ loaderData, actionData }: Route.ComponentProps) {
  const { article } = loaderData;
  const current = article.currentRevision;
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin/articles">Back to articles</a>
      </p>
      <h1>{current.snapshot.title}</h1>
      {loaderData.saved && !actionData && <p role="status">{`Saved as revision ${loaderData.saved}.`}</p>}
      {actionData?.error && <p role="alert">{actionData.error}</p>}
      <p>
        Editing revision {current.number}. Every save adds a new revision.{" "}
        <a href={`/admin/articles/${article.id}/revisions/${current.number}`}>
          Review and publish revision {current.number}
        </a>
        {" · "}
        <a href={`/admin/articles/${article.id}/history`}>Revision history</a>
      </p>
      <ArticleForm
        key={current.id}
        values={actionData?.values ?? current.snapshot}
        errors={actionData?.errors}
        topics={loaderData.topics}
        embeddable={loaderData.embeddable}
        area={{ choose: false, current: article.primaryArea }}
        baseRevisionId={actionData?.baseRevisionId ?? current.id}
        submitLabel="Save new revision"
      />
    </main>
  );
}
