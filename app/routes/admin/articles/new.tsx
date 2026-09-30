import { data, redirect } from "react-router";
import { ArticleForm } from "~/components/article-form";
import { EMPTY_ARTICLE_BODY } from "~/lib/article-body";
import { createArticle, listArticles, readArticleForm } from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import { listTopics } from "~/lib/topics.server";
import type { Route } from "./+types/new";

export function meta() {
  return [{ title: "New article · Na iSema staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db } = await requireEditor(context.get(cloudflareContext).env, request);
  const articles = await listArticles(db);
  return { topics: await listTopics(db), embeddable: articles.map(({ id, title }) => ({ id, title })) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { db, actor } = await requireEditor(context.get(cloudflareContext).env, request);
  const result = await readArticleForm(db, await request.formData(), true);
  if (!result.ok || !result.primaryArea) {
    return data({ errors: result.ok ? {} : result.errors, values: result.ok ? null : result.values }, { status: 400 });
  }
  const id = await createArticle(db, actor.userId, result.primaryArea, result.snapshot);
  throw redirect(`/admin/articles/${id}`);
}

export default function NewArticle({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin/articles">Back to articles</a>
      </p>
      <h1>New article</h1>
      <ArticleForm
        key={actionData ? "resubmitted" : "new"}
        values={actionData?.values ?? { title: "", summary: "", credit: "", topicIds: [], body: EMPTY_ARTICLE_BODY }}
        errors={actionData?.errors}
        topics={loaderData.topics}
        embeddable={loaderData.embeddable}
        area={{ choose: true }}
        submitLabel="Save first revision"
      />
    </main>
  );
}
