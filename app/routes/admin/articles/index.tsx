import { BulkActions, BulkChoice } from "~/components/bulk-actions";
import { listArticles } from "~/lib/articles.server";
import { bulkReviewerChoices } from "~/lib/bulk-actions.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import { PUBLICATION_NAMES, type PublicationState } from "~/lib/review-names";
import type { Route } from "./+types/index";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Content · NAISEMA staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db } = await requireEditor(context.get(cloudflareContext).env, request);
  const [articles, reviewers] = await Promise.all([listArticles(db), bulkReviewerChoices(db)]);
  return { articles, reviewers };
}

export default function Articles({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Content</h1>
      <ul>
        <li>
          <a href="/admin/articles/new">Write a new article</a>
        </li>
        <li>
          <a href="/admin/articles/new?type=resource">Add a new resource</a>
        </li>
        <li>
          <a href="/admin/articles/new?type=episode">Add a Voices episode</a>
        </li>
        <li>
          <a href="/admin/articles/new?type=creator">Add a Creator Profile</a>
        </li>
        <li>
          <a href="/admin/articles/new?type=page">Write a site page</a>
        </li>
      </ul>
      {loaderData.articles.length ? (
        <form method="post" action="/admin/bulk">
          <p className="hint">
            Choose items to assign a reviewer to, withdraw or archive several at once. The actions are under the list.
          </p>
          <table>
            <caption className="visually-hidden">Content, most recently saved first</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="visually-hidden">Choose</span>
                </th>
                <th scope="col">Title</th>
                <th scope="col">Type</th>
                <th scope="col">Area</th>
                <th scope="col">Latest revision</th>
                <th scope="col">Publication</th>
              </tr>
            </thead>
            <tbody>
              {loaderData.articles.map((article) => (
                <tr key={article.id}>
                  <td>
                    <BulkChoice prefix="pick" id={article.id} title={article.title} />
                  </td>
                  <td>
                    <a href={`/admin/articles/${article.id}`}>{article.title}</a>
                  </td>
                  <td>{article.typeName}</td>
                  <td>{article.areaName}</td>
                  <td>{article.number}</td>
                  <td>{PUBLICATION_NAMES[article.publicationState as PublicationState]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <BulkActions kind="content" prefix="bulk" reviewers={loaderData.reviewers} />
        </form>
      ) : (
        <p>No content yet.</p>
      )}
    </main>
  );
}
