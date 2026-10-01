import { Link, redirect } from "react-router";
import { ArticleBodyView } from "~/components/article-body-view";
import { DateMark, Postmarks } from "~/components/public/postmarks";
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

const sameDay = (a: Date | string, b: Date | string) =>
  new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);

export default function Article({ loaderData: article }: Route.ComponentProps) {
  const published = article.firstPublishedAt;
  const updated = article.lastPublishedAt;
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
      <article className="letter">
        <header className="letter-head">
          <h1>{article.title}</h1>
          <p className="lede">{article.summary}</p>
          <p className="from">
            <span className="from-label">From</span> {article.credit}
          </p>
        </header>

        <Postmarks label="About this article">
          <li>{article.format}</li>
          {published && (
            <li>
              <DateMark label="Published" date={published} />
            </li>
          )}
          {published && updated && !sameDay(published, updated) && (
            <li>
              <DateMark label="Updated" date={updated} />
            </li>
          )}
        </Postmarks>

        <section className="review-labels" aria-labelledby="reviewed-heading">
          <h2 id="reviewed-heading" className="review-labels-heading">
            Review Labels
          </h2>
          {article.labels.length ? (
            <Postmarks label="Review Labels">
              {article.labels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </Postmarks>
          ) : (
            <p className="no-review">This article has none.</p>
          )}
        </section>

        <div className="letter-body">
          <ArticleBodyView body={article.body} embeds={article.embeds} />
        </div>

        <footer className="letter-foot">
          {article.topics.length > 0 && (
            <p>
              <span className="from-label">Topics</span> {article.topics.join(", ")}
            </p>
          )}
          {article.sources && (
            <section aria-labelledby="sources-heading">
              <h2 id="sources-heading">Sources</h2>
              <p className="sources">{article.sources}</p>
            </section>
          )}
          <p>
            <Link to={`/${article.area}`}>More from {article.areaName}</Link>
          </p>
        </footer>
      </article>
    </main>
  );
}
