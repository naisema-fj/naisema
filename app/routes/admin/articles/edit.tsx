import { data, redirect } from "react-router";
import { ArticleForm } from "~/components/article-form";
import { getArticle, listArticles, readArticleForm, saveArticle } from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import { listTopics } from "~/lib/topics.server";
import type { Route } from "./+types/edit";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.article.draft.snapshot.title ?? "Article"} · Na iSema staff` }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db } = await requireEditor(context.get(cloudflareContext).env, request);
  const article = await getArticle(db, params.id);
  if (!article) throw new Response("Not found", { status: 404 });
  const articles = await listArticles(db);
  const saved = new URL(request.url).searchParams.get("saved");
  return {
    article,
    saved: saved === String(article.draft.number) ? article.draft.number : null,
    topics: await listTopics(db),
    embeddable: articles.filter(({ id }) => id !== article.id).map(({ id, title }) => ({ id, title })),
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { db, actor } = await requireEditor(context.get(cloudflareContext).env, request);
  const form = await request.formData();
  const result = await readArticleForm(db, form, false);
  if (!result.ok) return data({ errors: result.errors, values: result.values, error: null }, { status: 400 });

  const saved = await saveArticle(
    db,
    actor.userId,
    params.id,
    String(form.get("baseRevisionId") ?? ""),
    result.snapshot,
  );
  if (!saved.ok) return data({ errors: {}, values: result.snapshot, error: saved.error }, { status: 409 });
  throw redirect(`/admin/articles/${params.id}?saved=${saved.number}`);
}

export default function EditArticle({ loaderData, actionData }: Route.ComponentProps) {
  const { article } = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin/articles">Back to articles</a>
      </p>
      <h1>{article.draft.snapshot.title}</h1>
      {loaderData.saved && !actionData && <p role="status">{`Saved as revision ${loaderData.saved}.`}</p>}
      {actionData?.error && <p role="alert">{actionData.error}</p>}
      <p>
        Editing revision {article.draft.number}. Every save adds a new revision.{" "}
        <a href={`/admin/articles/${article.id}/history`}>Revision history</a>
      </p>
      <ArticleForm
        key={actionData ? "resubmitted" : article.draft.id}
        values={actionData?.values ?? article.draft.snapshot}
        errors={actionData?.errors}
        topics={loaderData.topics}
        embeddable={loaderData.embeddable}
        area={{ choose: false, current: article.primaryArea }}
        baseRevisionId={article.draft.id}
        submitLabel="Save new revision"
      />
    </main>
  );
}
