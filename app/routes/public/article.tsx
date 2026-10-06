import { data, Link, redirect } from "react-router";
import { ContentLetter } from "~/components/public/content-letter";
import { isPrimaryArea } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { findPublicArticle } from "~/lib/public.server";
import { PRIVATE_NO_STORE, PUBLIC_CACHE_CONTROL } from "~/lib/public-cache.server";
import { playbackFor } from "~/lib/public-video.server";
import type { RouteHandle } from "~/lib/route-handle";
import type { Route } from "./+types/article";

/**
 * A page with footage (a Video, or a video Episode) plays it, so it hydrates; every other item's
 * page ships no JavaScript.
 */
const playsVideo = (loaderData: unknown) => Boolean((loaderData as { video?: unknown } | undefined)?.video);

export const handle: RouteHandle = { hydrate: playsVideo, video: playsVideo };

/**
 * Edge-cached, except a page with footage: it carries a signed playback address and a nonce for
 * its scripts, so it is never kept (ADR-0007, ADR-0008).
 */
export function headers({ loaderHeaders, errorHeaders }: Route.HeadersArgs) {
  if (errorHeaders) return { "Cache-Control": "no-store" };
  return { "Cache-Control": loaderHeaders.get("Cache-Control") ?? PUBLIC_CACHE_CONTROL };
}

export async function loader({ params, context }: Route.LoaderArgs) {
  if (!isPrimaryArea(params.area)) throw new Response("Not found", { status: 404 });
  const { env } = context.get(cloudflareContext);
  const db = getDb(env.DB);
  const found = await findPublicArticle(db, params.area, params.slug);
  if (found.kind === "moved") throw redirect(found.to, 301);
  if (found.kind === "withdrawn") throw new Response("Withdrawn", { status: 410 });
  if (found.kind === "missing") throw new Response("Not found", { status: 404 });
  const { article, footage } = found;
  if (!footage) return data({ ...article, playback: null });
  return data(
    { ...article, playback: await playbackFor(env, footage) },
    { headers: { "Cache-Control": PRIVATE_NO_STORE } },
  );
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "NAISEMA" }];
  return [{ title: `${loaderData.title} · NAISEMA` }, { name: "description", content: loaderData.summary }];
}

export default function Article({ loaderData: article }: Route.ComponentProps) {
  return (
    <main id="main" className="article-page">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol>
          <li>
            <Link reloadDocument to="/">
              Home
            </Link>
          </li>
          <li>
            <Link reloadDocument to={`/${article.area}`}>
              {article.areaName}
            </Link>
          </li>
          <li aria-current="page">{article.title}</li>
        </ol>
      </nav>
      <ContentLetter item={article} playback={article.playback} />
    </main>
  );
}
