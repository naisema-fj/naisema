import { Link } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { ORGANISATION_TYPES, providerPath } from "~/lib/listing-fields";
import { publicProviders } from "~/lib/providers.server";
import { publicHeaders } from "~/lib/public-cache.server";
import type { Route } from "./+types/providers";

export const handle = { hydrate: false };
export const headers = publicHeaders;

/** GET /connect/providers — every listed Provider, A to Z (PART-01, PART-03). */
export async function loader({ context }: Route.LoaderArgs) {
  const providers = await publicProviders(getDb(context.get(cloudflareContext).env.DB));
  return {
    providers: providers.map((row) => ({
      name: row.name,
      path: providerPath(row.slug),
      kind: ORGANISATION_TYPES[row.organisationType],
      location: row.location || "Location not known",
      partner: row.partner,
      sponsoredBy: row.sponsoredBy,
    })),
  };
}

export function meta() {
  return [
    { title: "Providers · Connect · Na iSema" },
    { name: "description", content: "Organisations and people who teach Fijian language and culture." },
  ];
}

export default function Providers({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/connect">Connect</Link>
          </li>
          <li aria-current="page">Providers</li>
        </ol>
      </nav>
      <article className="letter" aria-labelledby="providers-heading">
        <header className="letter-head">
          <h1 id="providers-heading">Providers</h1>
          <p className="lede">Organisations and people who teach Fijian language and culture.</p>
          <p>
            Being listed doesn't mean a partnership or that Na iSema endorses them. A Partner is marked as one. You can
            also <Link to="/connect/offerings">browse everything they offer</Link>.
          </p>
        </header>
        {loaderData.providers.length ? (
          <ul className="letter-list">
            {loaderData.providers.map((row) => (
              <li key={row.path}>
                <Link to={row.path}>{row.name}</Link>
                <p className="list-mark">
                  {`${row.kind} · ${row.location}`}
                  {row.partner && " · Partner"}
                </p>
                {row.sponsoredBy && <p className="disclosure">{`Sponsored by ${row.sponsoredBy}.`}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">No providers are listed yet.</p>
        )}
      </article>
    </main>
  );
}
