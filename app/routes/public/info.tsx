import { Link } from "react-router";
import { ContentLetter } from "~/components/public/content-letter";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { INFO_PAGES } from "~/lib/info-pages";
import { findPublicPage } from "~/lib/public.server";
import { publicHeaders } from "~/lib/public-cache.server";
import type { Route } from "./+types/info";

export const handle = { hydrate: false };
export const headers = publicHeaders;

/** A footer page: its published Page if it has one, otherwise a plain note that it is being written (PUB-01). */
export async function loader({ request, context }: Route.LoaderArgs) {
  const path = new URL(request.url).pathname.replace(/^\/|\/$/g, "");
  const page = INFO_PAGES.find((candidate) => candidate.path === path);
  if (!page) throw new Response("Not found", { status: 404 });
  const published = await findPublicPage(getDb(context.get(cloudflareContext).env.DB), page.path);
  return { page, published };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Na iSema" }];
  const title = loaderData.published?.title ?? loaderData.page.title;
  return [
    { title: `${title} · Na iSema` },
    ...(loaderData.published ? [{ name: "description", content: loaderData.published.summary }] : []),
  ];
}

export default function Info({ loaderData }: Route.ComponentProps) {
  const { page, published } = loaderData;
  return (
    <main id="main">
      {published ? (
        <ContentLetter item={published} />
      ) : (
        <article className="letter letter-narrow">
          <h1>{page.title}</h1>
          <p>This page is being written. It will set out {page.purpose}.</p>
          <p>
            <Link to="/">Go to the Na iSema home page</Link>
          </p>
        </article>
      )}
    </main>
  );
}
