import { Link } from "react-router";
import { OfferingCard } from "~/components/public/offering-card";
import { DateMark } from "~/components/public/postmarks";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { ORGANISATION_TYPES, sponsorsText } from "~/lib/listing-fields";
import { offeringView, publicProvider } from "~/lib/providers.server";
import { publicHeaders } from "~/lib/public-cache.server";
import { linkHost } from "~/lib/resource-fields";
import type { Route } from "./+types/provider";

export const handle = { hydrate: false };
export const headers = publicHeaders;

/** GET /connect/providers/:slug — a listed Provider, what it offers and how to reach it. */
export async function loader({ params, context }: Route.LoaderArgs) {
  const db = getDb(context.get(cloudflareContext).env.DB);
  const found = await publicProvider(db, params.slug);
  if (!found) throw new Response("Not found", { status: 404 });
  return {
    provider: {
      name: found.name,
      description: found.description,
      kind: ORGANISATION_TYPES[found.organisationType],
      location: found.location || "Not known",
      website: found.website ? { url: found.website, host: linkHost(found.website) } : null,
      contactRoute: found.contactRoute || "Not known",
      lastCheckedOn: found.lastCheckedOn,
      partner: found.partner,
      sponsors: sponsorsText(found.sponsoredBy),
      featureRationale: found.featureRationale,
    },
    offerings: await Promise.all(found.offerings.map((row) => offeringView(db, row, found))),
  };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "NAISEMA" }];
  return [
    { title: `${loaderData.provider.name} · Providers · NAISEMA` },
    {
      name: "description",
      content: loaderData.provider.description || `${loaderData.provider.name}, listed on NAISEMA.`,
    },
  ];
}

export default function Provider({ loaderData }: Route.ComponentProps) {
  const { provider, offerings } = loaderData;
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
          <li>
            <Link to="/connect/providers">Providers</Link>
          </li>
          <li aria-current="page">{provider.name}</li>
        </ol>
      </nav>
      <article className="letter" aria-labelledby="provider-heading">
        <header className="letter-head">
          <h1 id="provider-heading">{provider.name}</h1>
          {provider.description && <p className="lede">{provider.description}</p>}
          <p>
            {provider.partner
              ? "A NAISEMA Partner, under a recorded Partnership Agreement."
              : "Listed on NAISEMA. Being listed doesn't mean a partnership or that NAISEMA endorses them."}
          </p>
          {provider.sponsors && <p className="disclosure">{provider.sponsors}</p>}
          {provider.featureRationale && (
            <p className="disclosure">{`Featured by NAISEMA editors: ${provider.featureRationale}`}</p>
          )}
        </header>
        <section className="resource-details" aria-labelledby="about-heading">
          <h2 id="about-heading">About them</h2>
          <dl>
            <dt>Kind</dt>
            <dd>{provider.kind}</dd>
            <dt>Location</dt>
            <dd>{provider.location}</dd>
            <dt>Website</dt>
            <dd>
              {provider.website ? (
                <a href={provider.website.url} rel="external noopener noreferrer">
                  {`${provider.website.host} (another website)`}
                </a>
              ) : (
                "Not known"
              )}
            </dd>
            <dt>Contact</dt>
            <dd>{provider.contactRoute}</dd>
            <dt>Details checked</dt>
            <dd>
              <DateMark date={provider.lastCheckedOn} />
            </dd>
          </dl>
        </section>
        <section aria-labelledby="offerings-heading">
          <h2 id="offerings-heading">What they offer</h2>
          {offerings.length ? (
            offerings.map((offering) => <OfferingCard key={offering.id} offering={offering} />)
          ) : (
            <p className="empty">Nothing is listed yet.</p>
          )}
        </section>
      </article>
    </main>
  );
}
