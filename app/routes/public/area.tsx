import { Link } from "react-router";
import { DateMark } from "~/components/public/postmarks";
import { AREA_INFO, AREA_NAMES, isPrimaryArea } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { providerPath, sponsorsText } from "~/lib/listing-fields";
import { featuredListings } from "~/lib/providers.server";
import { publicHeaders } from "~/lib/public-cache.server";
import { listPublic } from "~/lib/search.server";
import type { Route } from "./+types/area";

export const handle = { hydrate: false };

/** An area page lists its newest items; search pages through the rest (it isn't edge-cached). */
const AREA_PAGE_LIMIT = 20;
export const headers = publicHeaders;

export async function loader({ params, context }: Route.LoaderArgs) {
  if (!isPrimaryArea(params.area)) throw new Response("Not found", { status: 404 });
  const db = getDb(context.get(cloudflareContext).env.DB);
  const [{ listings, total }, featured] = await Promise.all([
    listPublic(db, { area: params.area, limit: AREA_PAGE_LIMIT }),
    // Connect also lists Providers, their Offerings and Creators, with what editors feature.
    params.area === "connect" ? featuredListings(db) : null,
  ]);
  return {
    area: params.area,
    items: listings,
    total,
    featured: featured && {
      providers: featured.providers.map((row) => ({
        name: row.name,
        path: providerPath(row.slug),
        rationale: row.featureRationale,
        sponsors: sponsorsText(row.sponsoredBy),
      })),
      offerings: featured.offerings.map((row) => ({
        name: `${row.title}, from ${row.providerName}`,
        path: providerPath(row.providerSlug),
        rationale: row.featureRationale,
        sponsors: sponsorsText(row.sponsoredBy, row.providerSponsoredBy),
      })),
    },
  };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Na iSema" }];
  return [
    { title: `${AREA_NAMES[loaderData.area]} · Na iSema` },
    { name: "description", content: AREA_INFO[loaderData.area].description },
  ];
}

export default function Area({ loaderData }: Route.ComponentProps) {
  const { area, items, total, featured } = loaderData;
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
          {items[0]?.publishedAt && (
            <p className="dateline">
              <DateMark label="Last published" date={items[0].publishedAt} />
            </p>
          )}
        </header>
        {info.notYetOpen && (
          <p className="not-open">
            <span className="from-label">Not open yet</span> {info.notYetOpen}
          </p>
        )}
        {featured && <ConnectListings featured={featured} />}
        {featured && items.length > 0 && <h2>Newest in {AREA_NAMES[area]}</h2>}
        {items.length ? (
          <ul className="letter-list">
            {items.map((item) => (
              <li key={item.path}>
                <Link to={item.path}>{item.title}</Link>
                <p>{item.summary}</p>
                <p className="list-mark">
                  {item.formatName}
                  {item.publishedAt && (
                    <>
                      {" · "}
                      <DateMark label="Published" date={item.publishedAt} />
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Nothing has been published in {AREA_NAMES[area]} yet.</p>
        )}
        {total > items.length && (
          <p className="see-all">
            <Link to={`/search?area=${area}`}>
              See all {total} in {AREA_NAMES[area]}
            </Link>
          </p>
        )}
      </article>
    </main>
  );
}

type Featured = NonNullable<Route.ComponentProps["loaderData"]["featured"]>;

/** Connect's own listings, and the ones editors feature, each with why (PUB-04). */
function ConnectListings({ featured }: { featured: Featured }) {
  const chosen = [...featured.providers, ...featured.offerings];
  return (
    <>
      <nav aria-label="Connect listings" className="area-sections">
        <ul>
          <li>
            <Link to="/connect/offerings">Classes and courses</Link>
          </li>
          <li>
            <Link to="/connect/providers">Providers</Link>
          </li>
          <li>
            <Link to="/connect/creators">Creators</Link>
          </li>
        </ul>
      </nav>
      {chosen.length > 0 && (
        <section aria-labelledby="featured-heading">
          <h2 id="featured-heading">Featured by our editors</h2>
          <ul className="letter-list">
            {chosen.map((row) => (
              <li key={`${row.path}|${row.name}`}>
                <Link to={row.path}>{row.name}</Link>
                <p>{`Why: ${row.rationale}`}</p>
                {row.sponsors && <p className="disclosure">{row.sponsors}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
