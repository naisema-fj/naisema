import { data, redirect } from "react-router";
import { ArticleForm } from "~/components/article-form";
import { EMPTY_ARTICLE_BODY } from "~/lib/article-body";
import { articleFingerprints, embeddableArticles, readArticleForm, readPrimaryArea } from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import { createContentItem } from "~/lib/revisions.server";
import { listTopics } from "~/lib/topics.server";
import type { Route } from "./+types/new";

export function meta() {
  return [{ title: "New article · Na iSema staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db } = await requireEditor(context.get(cloudflareContext).env, request);
  return { topics: await listTopics(db), embeddable: await embeddableArticles(db) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { db, actor } = await requireEditor(context.get(cloudflareContext).env, request);
  const form = await request.formData();
  const result = await readArticleForm(db, form);
  const primaryArea = readPrimaryArea(form);
  if (!result.ok || !primaryArea) {
    return data(
      {
        errors: {
          ...(result.ok ? {} : result.errors),
          ...(primaryArea ? {} : { primaryArea: "Choose the primary area." }),
        },
        values: result.ok ? result.snapshot : result.values,
      },
      { status: 400 },
    );
  }
  const id = await createContentItem(db, {
    type: "article",
    primaryArea,
    title: result.snapshot.title,
    snapshot: result.snapshot,
    fingerprints: await articleFingerprints(result.snapshot),
    createdBy: actor.userId,
  });
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
        values={
          actionData?.values ?? {
            title: "",
            summary: "",
            credit: "",
            topicIds: [],
            body: EMPTY_ARTICLE_BODY,
            sources: "",
            flags: [],
            languageVariety: null,
          }
        }
        errors={actionData?.errors}
        topics={loaderData.topics}
        embeddable={loaderData.embeddable}
        area={{ choose: true }}
        submitLabel="Save first revision"
      />
    </main>
  );
}
