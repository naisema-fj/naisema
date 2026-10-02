import { Form, Link } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { ORGANISATION_TYPES, type OrganisationType, providerPath, sponsorsText } from "~/lib/listing-fields";
import { publicProviders } from "~/lib/providers.server";
import type { Route } from "./+types/providers";

export const handle = { hydrate: false };
// The kind filter lives in the query string, which the edge cache ignores, so this page is never cached.
export const headers = () => ({ "Cache-Control": "no-store" });

/** GET /connect/providers — every listed Provider, A to Z, of one kind if chosen (PART-01, PART-03). */
export async function loader({ request, context }: Route.LoaderArgs) {
  const chosen = new URL(request.url).searchParams.get("kind") ?? "";
  const kind = chosen !== "unknown" && Object.hasOwn(ORGANISATION_TYPES, chosen) ? (chosen as OrganisationType) : null;
  const providers = await publicProviders(getDb(context.get(cloudflareContext).env.DB), new Date(), kind);
  return {
    kind,
    providers: providers.map((row) => ({
      name: row.name,
      path: providerPath(row.slug),
      kind: ORGANISATION_TYPES[row.organisationType],
      location: row.location || "Location not known",
      partner: row.partner,
      sponsors: sponsorsText(row.sponsoredBy),
    })),
  };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: "Providers · Connect · Na iSema" },
    { name: "description", content: "Organisations and people who teach Fijian language and culture." },
    ...(loaderData?.kind ? [{ name: "robots", content: "noindex" }] : []),
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
        <Form method="get" className="search-form filters" aria-label="Narrow the list">
          <label htmlFor="kind">Kind of organisation</label>
          <select id="kind" name="kind" defaultValue={loaderData.kind ?? ""}>
            <option value="">Any kind</option>
            {Object.entries(ORGANISATION_TYPES)
              .filter(([kind]) => kind !== "unknown")
              .map(([kind, name]) => (
                <option key={kind} value={kind}>
                  {name}
                </option>
              ))}
          </select>
          <button type="submit">Show</button>
        </Form>
        {loaderData.providers.length ? (
          <ul className="letter-list">
            {loaderData.providers.map((row) => (
              <li key={row.path}>
                <Link to={row.path}>{row.name}</Link>
                <p className="list-mark">
                  {`${row.kind} · ${row.location}`}
                  {row.partner && " · Partner"}
                </p>
                {row.sponsors && <p className="disclosure">{row.sponsors}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">
            {loaderData.kind ? "No providers of that kind are listed yet." : "No providers are listed yet."}
          </p>
        )}
      </article>
    </main>
  );
}
