import { data, Form, redirect } from "react-router";
import { ArticleForm } from "~/components/article-form";
import { isPrimaryArea } from "~/lib/areas";
import { articleFingerprints, embeddableArticles, getArticle, readArticleForm } from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import { CONTENT_TYPE_NAMES } from "~/lib/content-types";
import { itemPath } from "~/lib/item-paths";
import { reportsSince } from "~/lib/link-reports.server";
import { downloadChoices, episodeAudioChoices, imageChoices } from "~/lib/media-delivery.server";
import { publicItemChanged } from "~/lib/public-change.server";
import { appendRevision } from "~/lib/revisions.server";
import { changeSlug } from "~/lib/slugs.server";
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
    slugChanged: new URL(request.url).searchParams.get("slug") === "changed",
    // Visitors' broken-link reports since the editor last checked the link.
    linkReports:
      article.currentRevision.snapshot.resource?.source.kind === "link"
        ? await reportsSince(db, article.id, article.currentRevision.snapshot.resource.source.checkedOn)
        : 0,
    topics: await listTopics(db),
    embeddable: await embeddableArticles(db, article.id),
    files: article.type === "resource" ? await downloadChoices(db) : [],
    audio: article.type === "episode" ? await episodeAudioChoices(db) : [],
    images: article.type === "creator" ? await imageChoices(db) : [],
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireEditor(env, request);
  const form = await request.formData();

  if (form.get("intent") === "slug") {
    const changed = await changeSlug(db, actor.userId, params.id, String(form.get("slug") ?? ""));
    if (!changed.ok)
      return data(
        { errors: {}, values: null, error: null, baseRevisionId: null, slugError: changed.error },
        { status: 400 },
      );
    // The old address, as this type is addressed (a Creator Profile's is under /connect/creators).
    const oldPath = itemPath({ type: changed.type, primaryArea: changed.area, slug: changed.oldSlug });
    await publicItemChanged(env, db, params.id, [oldPath]);
    throw redirect(`/admin/articles/${params.id}?slug=changed`);
  }

  // A refused form keeps the revision it was opened from, so sending it again is refused again
  // instead of quietly landing on top of someone else's newer revision.
  const baseRevisionId = String(form.get("baseRevisionId") ?? "");
  const item = await getArticle(db, params.id);
  if (!item) throw new Response("Not found", { status: 404 });
  const result = await readArticleForm(db, form, { type: item.type, itemId: item.id });
  if (!result.ok) {
    return data(
      { errors: result.errors, values: result.values, error: null, baseRevisionId, slugError: null },
      { status: 400 },
    );
  }

  const saved = await appendRevision(db, {
    contentItemId: params.id,
    type: item.type,
    baseRevisionId,
    snapshot: result.snapshot,
    fingerprints: await articleFingerprints(result.snapshot),
    savedBy: actor.userId,
  });
  if (!saved.ok) {
    return data(
      { errors: {}, values: result.snapshot, error: saved.error, baseRevisionId, slugError: null },
      { status: 409 },
    );
  }
  throw redirect(`/admin/articles/${params.id}?saved=${saved.number}`);
}

export default function EditArticle({ loaderData, actionData }: Route.ComponentProps) {
  const { article } = loaderData;
  const current = article.currentRevision;
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin/articles">Back to content</a>
      </p>
      <h1>{current.snapshot.title}</h1>
      <p>{CONTENT_TYPE_NAMES[article.type]}</p>
      {loaderData.saved && !actionData && <p role="status">{`Saved as revision ${loaderData.saved}.`}</p>}
      {loaderData.slugChanged && !actionData && (
        <p role="status">The address changed. The old address now redirects to the new one.</p>
      )}
      {actionData?.error && <p role="alert">{actionData.error}</p>}
      {loaderData.linkReports > 0 && (
        <p role="status">
          {`Visitors have reported this link broken ${loaderData.linkReports} ${loaderData.linkReports === 1 ? "time" : "times"} since you last checked it. Check it, then save with the new date.`}
        </p>
      )}
      <p>
        Editing revision {current.number}. Every save adds a new revision.{" "}
        <a href={`/admin/articles/${article.id}/revisions/${current.number}`}>
          Review and publish revision {current.number}
        </a>
        {" · "}
        <a href={`/admin/articles/${article.id}/history`}>Revision history</a>
        {" · "}
        <a href={`/admin/articles/${article.id}/rights`}>Rights Records</a>
      </p>
      <ArticleForm
        key={current.id}
        type={article.type}
        files={loaderData.files}
        audio={loaderData.audio}
        images={loaderData.images}
        values={actionData?.values ?? current.snapshot}
        errors={actionData?.errors}
        topics={loaderData.topics}
        embeddable={loaderData.embeddable}
        area={{ choose: false, current: isPrimaryArea(article.primaryArea) ? article.primaryArea : null }}
        baseRevisionId={actionData?.baseRevisionId ?? current.id}
        submitLabel="Save new revision"
      />

      {article.type === "page" ? (
        <p>
          This Page is at <a href={`/${article.slug}`}>/{article.slug}</a>, a fixed address linked from the site's
          footer.
        </p>
      ) : (
        <>
          <h2>Web address</h2>
          <Form method="post" className="article-form">
            <input type="hidden" name="intent" value="slug" />
            <label htmlFor="slug">
              Address after /{article.primaryArea}/ (the old address keeps working and redirects here)
            </label>
            <input
              id="slug"
              name="slug"
              defaultValue={article.slug}
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              aria-describedby={actionData?.slugError ? "slug-error" : undefined}
            />
            {actionData?.slugError && (
              <p id="slug-error" className="field-error" role="alert">
                {actionData.slugError}
              </p>
            )}
            <button type="submit">Change address</button>
          </Form>
        </>
      )}
    </main>
  );
}
