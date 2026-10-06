import { Link, redirect } from "react-router";
import { ContentLetter } from "~/components/public/content-letter";
import { cloudflareContext } from "~/lib/cloudflare";
import { CREATOR_AREA } from "~/lib/content-types";
import { getDb } from "~/lib/db.server";
import { findPublicArticle } from "~/lib/public.server";
import { publicHeaders } from "~/lib/public-cache.server";
import type { Route } from "./+types/creator";

export const handle = { hydrate: false };
export const headers = publicHeaders;

/** GET /connect/creators/:slug — a published Creator Profile (CRE-01). */
export async function loader({ params, context }: Route.LoaderArgs) {
  const db = getDb(context.get(cloudflareContext).env.DB);
  const found = await findPublicArticle(db, CREATOR_AREA, params.slug, new Date(), ["creator"]);
  if (found.kind === "moved") throw redirect(found.to, 301);
  if (found.kind === "withdrawn") throw new Response("Withdrawn", { status: 410 });
  if (found.kind === "missing") throw new Response("Not found", { status: 404 });
  return found.article;
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "NAISEMA" }];
  return [{ title: `${loaderData.title} · Creators · NAISEMA` }, { name: "description", content: loaderData.summary }];
}

export default function Creator({ loaderData: creator }: Route.ComponentProps) {
  return (
    <main id="main" className="article-page">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/connect">Connect</Link>
          </li>
          <li>
            <Link to="/connect/creators">Creators</Link>
          </li>
          <li aria-current="page">{creator.title}</li>
        </ol>
      </nav>
      <ContentLetter item={creator} />
    </main>
  );
}
