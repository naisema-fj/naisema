import { Link } from "react-router";
import { DateMark } from "~/components/public/postmarks";
import { AREA_INFO, AREA_NAMES, isPrimaryArea } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { listPublic } from "~/lib/public.server";
import { publicHeaders } from "~/lib/public-cache.server";
import type { Route } from "./+types/area";

export const handle = { hydrate: false };
export const headers = publicHeaders;

export async function loader({ params, context }: Route.LoaderArgs) {
  if (!isPrimaryArea(params.area)) throw new Response("Not found", { status: 404 });
  const db = getDb(context.get(cloudflareContext).env.DB);
  return { area: params.area, items: await listPublic(db, { area: params.area }) };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Na iSema" }];
  return [
    { title: `${AREA_NAMES[loaderData.area]} · Na iSema` },
    { name: "description", content: AREA_INFO[loaderData.area].description },
  ];
}

export default function Area({ loaderData }: Route.ComponentProps) {
  const { area, items } = loaderData;
  const info = AREA_INFO[area];
  return (
    <main id="main" className="area-page">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li aria-current="page">{AREA_NAMES[area]}</li>
        </ol>
      </nav>
      <article className="letter area-letter" aria-labelledby="area-heading">
        <header className="letter-head">
          <h1 id="area-heading">{AREA_NAMES[area]}</h1>
          <p className="lede">{info.description}</p>
          {items[0]?.lastPublishedAt && (
            <p className="dateline">
              <DateMark label="Last published" date={items[0].lastPublishedAt} />
            </p>
          )}
        </header>
        {info.notYetOpen && (
          <p className="not-open">
            <span className="from-label">Not open yet</span> {info.notYetOpen}
          </p>
        )}
        {items.length ? (
          <ul className="letter-list">
            {items.map((item) => (
              <li key={item.path}>
                <Link to={item.path}>{item.title}</Link>
                <p>{item.summary}</p>
                {item.lastPublishedAt && (
                  <p className="list-mark">
                    <DateMark label="Published" date={item.lastPublishedAt} />
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Nothing has been published in {AREA_NAMES[area]} yet.</p>
        )}
      </article>
    </main>
  );
}
