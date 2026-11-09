import { Link } from "react-router";
import { ContentLetter } from "~/components/public/content-letter";
import { AREA_NAMES, isPrimaryArea } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import { findPublicItem } from "~/lib/content.server";
import { getDb } from "~/lib/db.server";
import { publicHeaders } from "~/lib/http";
import { publicView } from "~/lib/public-view.server";
import type { Route } from "./+types/item";

export const handle = { hydrate: false };
export const headers = publicHeaders;

/** GET /:area/:slug: one published item, while it is eligible (ADR-0007). */
export async function loader({ params, context }: Route.LoaderArgs) {
  if (!isPrimaryArea(params.area)) throw new Response("Not found", { status: 404 });
  const db = getDb(context.get(cloudflareContext).env.DB);
  const found = await findPublicItem(db, params.area, params.slug);
  if (found.kind === "gone") throw new Response("Withdrawn", { status: 410 });
  if (found.kind === "missing") throw new Response("Not found", { status: 404 });
  return { item: await publicView(db, found) };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "NAISEMA" }];
  return [
    { title: `${loaderData.item.title} · NAISEMA` },
    { name: "description", content: loaderData.item.summary },
  ];
}

export default function Item({ loaderData }: Route.ComponentProps) {
  const { item } = loaderData;
  return (
    <main id="main" className="article-page">
      {item.area && (
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to={`/${item.area}`}>{AREA_NAMES[item.area]}</Link>
            </li>
            <li aria-current="page">{item.title}</li>
          </ol>
        </nav>
      )}
      <ContentLetter item={item} />
    </main>
  );
}
