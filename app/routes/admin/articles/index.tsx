import { listArticles } from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import type { Route } from "./+types/index";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Articles · Na iSema staff" }];
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
      <h1>Articles</h1>
      <p>
        <a href="/admin/articles/new">Write a new article</a>
      </p>
      {loaderData.articles.length ? (
        <table>
          <caption className="visually-hidden">Articles, most recently saved first</caption>
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Area</th>
              <th scope="col">Latest revision</th>
            </tr>
          </thead>
          <tbody>
            {loaderData.articles.map((article) => (
              <tr key={article.id}>
                <td>
                  <a href={`/admin/articles/${article.id}`}>{article.title}</a>
                </td>
                <td>{article.areaName}</td>
                <td>{article.number}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No articles yet.</p>
      )}
    </main>
  );
}
