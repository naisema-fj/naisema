import { Form, Link } from "react-router";
import { OfferingCard } from "~/components/public/offering-card";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { ACCESS_MODES, FORMATS, offeringFilters, providerPath } from "~/lib/listing-fields";
import { offeringView, publicOfferings } from "~/lib/providers.server";
import type { Route } from "./+types/offerings";

export const handle = { hydrate: false };
// Filters live in the query string, which the edge cache ignores, so this page is never cached.
export const headers = () => ({ "Cache-Control": "no-store" });

/** GET /connect/offerings — every listed Offering, narrowed by language, format, cost and access. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const db = getDb(context.get(cloudflareContext).env.DB);
  const filters = offeringFilters(new URL(request.url).searchParams);
  const rows = await publicOfferings(db, filters);
  return {
    filters,
    filtered: Boolean(filters.format || filters.cost || filters.access || filters.language),
    offerings: await Promise.all(
      rows.map(async (row) => ({
        view: await offeringView(db, row, {
          name: row.providerName,
          contactRoute: row.providerContactRoute,
          sponsoredBy: row.providerSponsoredBy,
        }),
        provider: { name: row.providerName, path: providerPath(row.providerSlug) },
      })),
    ),
  };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: "Classes and courses · Connect · NAISEMA" },
    // A filtered list is a view of this page, not a page of its own.
    ...(loaderData?.filtered ? [{ name: "robots", content: "noindex" }] : []),
  ];
}

export default function Offerings({ loaderData }: Route.ComponentProps) {
  const { filters, offerings, filtered } = loaderData;
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
          <li aria-current="page">Classes and courses</li>
        </ol>
      </nav>
      <article className="letter" aria-labelledby="offerings-heading">
        <header className="letter-head">
          <h1 id="offerings-heading">Classes and courses</h1>
          <p className="lede">What listed Providers offer, and how to get to it.</p>
          <p>Being listed doesn't mean a partnership or that NAISEMA endorses them.</p>
        </header>
        <Form method="get" className="search-form filters" aria-label="Narrow the list">
          <label htmlFor="language">Language</label>
          <input id="language" name="language" defaultValue={filters.language} placeholder="Standard Fijian" />
          <label htmlFor="format">Format</label>
          <select id="format" name="format" defaultValue={filters.format ?? ""}>
            <option value="">Any format</option>
            {Object.entries(FORMATS)
              .filter(([format]) => format !== "unknown")
              .map(([format, name]) => (
                <option key={format} value={format}>
                  {name}
                </option>
              ))}
          </select>
          <label htmlFor="cost">Cost</label>
          <select id="cost" name="cost" defaultValue={filters.cost ?? ""}>
            <option value="">Any cost</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
          </select>
          <label htmlFor="access">How to get it</label>
          <select id="access" name="access" defaultValue={filters.access ?? ""}>
            <option value="">Any way</option>
            {Object.entries(ACCESS_MODES).map(([mode, name]) => (
              <option key={mode} value={mode}>
                {name}
              </option>
            ))}
          </select>
          <button type="submit">Show</button>
        </Form>
        {offerings.length ? (
          offerings.map(({ view, provider }) => (
            <OfferingCard key={view.id} offering={view} provider={provider} headingLevel={2} />
          ))
        ) : (
          <p className="empty">{filtered ? "Nothing matches those choices." : "Nothing is listed yet."}</p>
        )}
        {filtered && (
          <p>
            <Link to="/connect/offerings">Show everything</Link>
          </p>
        )}
      </article>
    </main>
  );
}
