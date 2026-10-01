import { Link } from "react-router";
import type { OfferingView } from "~/lib/providers.server";

/**
 * One Offering: what it is, every fact (or "Not known"), sponsorship and feature disclosed, and how
 * to get to it, saying where a link goes before it is followed (PART-02, PUB-04).
 */
export function OfferingCard({
  offering,
  provider,
}: {
  offering: OfferingView;
  provider?: { name: string; path: string };
}) {
  const headingId = `offering-${offering.id}`;
  return (
    <section className="offering" aria-labelledby={headingId}>
      <h3 id={headingId}>{offering.title}</h3>
      {provider && (
        <p className="from">
          <span className="from-label">From</span> <Link to={provider.path}>{provider.name}</Link>
        </p>
      )}
      {offering.summary && <p>{offering.summary}</p>}
      {offering.sponsors && <p className="disclosure">{offering.sponsors}</p>}
      {offering.featureRationale && (
        <p className="disclosure">{`Featured by Na iSema editors: ${offering.featureRationale}`}</p>
      )}
      <dl className="facts">
        {offering.facts.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div>
          <dt>How to get it</dt>
          <dd>{offering.accessMode}</dd>
        </div>
      </dl>
      <p>
        {offering.action.kind === "external" ? (
          <>
            <a className="primary-link" href={offering.action.url} rel="external noopener noreferrer">
              {offering.action.label}
            </a>
            {` (${offering.action.host}, another website)`}
            {offering.action.note && <span className="note">{` ${offering.action.note}`}</span>}
          </>
        ) : offering.action.kind === "item" ? (
          <Link className="primary-link" to={offering.action.path}>
            {offering.action.label}
          </Link>
        ) : (
          offering.action.text
        )}
      </p>
    </section>
  );
}
