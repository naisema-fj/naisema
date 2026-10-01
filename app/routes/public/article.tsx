import { Link, redirect } from "react-router";
import { ContentLetter } from "~/components/public/content-letter";
import { isPrimaryArea } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { findPublicArticle } from "~/lib/public.server";
import { publicHeaders } from "~/lib/public-cache.server";
import type { Route } from "./+types/article";

export const handle = { hydrate: false };
export const headers = publicHeaders;

export async function loader({ params, context }: Route.LoaderArgs) {
  if (!isPrimaryArea(params.area)) throw new Response("Not found", { status: 404 });
  const db = getDb(context.get(cloudflareContext).env.DB);
  const found = await findPublicArticle(db, params.area, params.slug);
  if (found.kind === "moved") throw redirect(found.to, 301);
  if (found.kind === "withdrawn") throw new Response("Withdrawn", { status: 410 });
  if (found.kind === "missing") throw new Response("Not found", { status: 404 });
  return found.article;
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Na iSema" }];
  return [{ title: `${loaderData.title} · Na iSema` }, { name: "description", content: loaderData.summary }];
}

export default function Article({ loaderData: article }: Route.ComponentProps) {
  return (
    <main id="main" className="article-page">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to={`/${article.area}`}>{article.areaName}</Link>
          </li>
          <li aria-current="page">{article.title}</li>
        </ol>
      </nav>
      <ContentLetter item={article} />
    </main>
  );
}
