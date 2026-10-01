import { listArticles } from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import { PUBLICATION_NAMES, type PublicationState } from "~/lib/review-names";
import type { Route } from "./+types/index";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Content · Na iSema staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db } = await requireEditor(context.get(cloudflareContext).env, request);
  return { articles: await listArticles(db) };
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
          <a href="/admin/articles/new?type=page">Write a site page</a>
        </li>
      </ul>
      {loaderData.articles.length ? (
        <table>
          <caption className="visually-hidden">Content, most recently saved first</caption>
          <thead>
            <tr>
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
      ) : (
        <p>No content yet.</p>
      )}
    </main>
  );
}
