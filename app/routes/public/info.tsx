import { Link } from "react-router";
import { INFO_PAGES } from "~/lib/info-pages";
import { publicHeaders } from "~/lib/public-cache.server";
import type { Route } from "./+types/info";

export const handle = { hydrate: false };
export const headers = publicHeaders;

export function loader({ request }: Route.LoaderArgs) {
  const path = new URL(request.url).pathname.slice(1);
  const page = INFO_PAGES.find((candidate) => candidate.path === path);
  if (!page) throw new Response("Not found", { status: 404 });
  return page;
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.title ?? "Na iSema"} · Na iSema` }];
}

/** A footer page that hasn't been written yet says so, and what it will hold (PUB-01). */
export default function Info({ loaderData: page }: Route.ComponentProps) {
  return (
    <main id="main">
      <article className="letter letter-narrow">
        <h1>{page.title}</h1>
        <p>This page is being written. It will set out {page.purpose}.</p>
        <p>
          <Link to="/">Go to the Na iSema home page</Link>
        </p>
      </article>
    </main>
  );
}
