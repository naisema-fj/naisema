import { data, Form, redirect } from "react-router";
import type { ArticleSnapshot } from "~/lib/article-fields";
import { articleFingerprints, getArticle } from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import { listRevisions, restoreRevision } from "~/lib/revisions.server";
import type { Route } from "./+types/history";

export const handle = { hydrate: false };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `History of ${loaderData?.article.currentRevision.snapshot.title ?? "article"} · Na iSema staff` }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db } = await requireEditor(context.get(cloudflareContext).env, request);
  const article = await getArticle(db, params.id);
  if (!article) throw new Response("Not found", { status: 404 });
  return { article, revisions: await listRevisions<ArticleSnapshot>(db, article.id) };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { db, actor } = await requireEditor(context.get(cloudflareContext).env, request);
  const form = await request.formData();
  const item = await getArticle(db, params.id);
  if (!item) throw new Response("Not found", { status: 404 });
  const restored = await restoreRevision(db, {
    contentItemId: params.id,
    type: item.type,
    baseRevisionId: String(form.get("baseRevisionId") ?? ""),
    revisionId: String(form.get("revisionId") ?? ""),
    savedBy: actor.userId,
    fingerprintsOf: (snapshot) => articleFingerprints(snapshot as ArticleSnapshot),
  });
  if (!restored.ok) return data({ error: restored.error }, { status: 409 });
  throw redirect(`/admin/articles/${params.id}?saved=${restored.number}`);
}

const formatTime = (date: Date | string) =>
  new Date(date).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default function History({ loaderData, actionData }: Route.ComponentProps) {
  const { article, revisions } = loaderData;
  const newest = revisions[0]?.number;
  const previous = revisions[1]?.number;

  return (
    <main id="main" className="page">
      <p>
        <a href={`/admin/articles/${article.id}`}>Back to editing</a>
      </p>
      <h1>Revision history: {article.currentRevision.snapshot.title}</h1>
      {actionData?.error && <p role="alert">{actionData.error}</p>}
      <p>Revisions are never changed. Restoring an earlier one saves its content again as a new revision.</p>

      <h2>Compare two revisions</h2>
      <Form method="get" action={`/admin/articles/${article.id}/compare`} className="compare-form">
        <label htmlFor="compare-from">From revision</label>
        <select id="compare-from" name="from" defaultValue={previous ?? newest}>
          {revisions.map((revision) => (
            <option key={revision.id} value={revision.number}>
              {revision.number}
            </option>
          ))}
        </select>
        <label htmlFor="compare-to">To revision</label>
        <select id="compare-to" name="to" defaultValue={newest}>
          {revisions.map((revision) => (
            <option key={revision.id} value={revision.number}>
              {revision.number}
            </option>
          ))}
        </select>
        <button type="submit">Compare</button>
      </Form>

      <h2>All revisions</h2>
      <table>
        <caption className="visually-hidden">Revisions, newest first</caption>
        <thead>
          <tr>
            <th scope="col">Revision</th>
            <th scope="col">Saved (UTC)</th>
            <th scope="col">By</th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {revisions.map((revision) => (
            <tr key={revision.id}>
              <td>
                <a href={`/admin/articles/${article.id}/revisions/${revision.number}`}>{revision.number}</a>
                {revision.id === article.currentRevision.id && " (current)"}
                {revision.restoredFromNumber && ` — restored from ${revision.restoredFromNumber}`}
              </td>
              <td>{formatTime(revision.createdAt)}</td>
              <td>{revision.savedBy}</td>
              <td>
                {revision.id !== article.currentRevision.id && (
                  <Form method="post">
                    <input type="hidden" name="baseRevisionId" value={article.currentRevision.id} />
                    <input type="hidden" name="revisionId" value={revision.id} />
                    <button type="submit" aria-label={`Restore revision ${revision.number}`}>
                      Restore
                    </button>
                  </Form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
