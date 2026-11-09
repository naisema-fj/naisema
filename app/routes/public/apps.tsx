import { Link } from "react-router";
import { FIJIAN_APPS } from "~/lib/fijian-apps";
import { publicHeaders } from "~/lib/public-cache.server";
import { SUBMISSION_TYPES } from "~/lib/submission-fields";

export const handle = { hydrate: false };
export const headers = publicHeaders;

export function meta() {
  return [
    { title: "Fijian apps · NAISEMA" },
    {
      name: "description",
      content: "The Fijian dictionary, lessons and community translation, and how to help them grow.",
    },
  ];
}

/** The Fijian apps hub: what each app is, where it runs now, what isn't open yet, and how to contribute. */
export default function Apps() {
  return (
    <main id="main" className="area-page">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/learn">Learn</Link>
          </li>
          <li aria-current="page">Fijian apps</li>
        </ol>
      </nav>
      <article className="pane area-pane" aria-labelledby="apps-heading">
        <header className="pane-intro">
          <div className="pane-head tile-learn">
            <h1 id="apps-heading">Fijian apps</h1>
          </div>
          <p className="lede">
            A dictionary, lessons and a place to work out new Fijian words together. Mai vei keda, kivei keda.
          </p>
        </header>
        <ul className="piece-list">
          {FIJIAN_APPS.map((app) => (
            <li key={app.key}>
              <h2 id={`app-${app.key}`}>{app.name}</h2>
              <p>{app.summary}</p>
              <p className="not-open">
                <span className="from-label">Not open yet</span> {app.notYetOpen}
              </p>
              {app.onNaisema && (
                <p>
                  <Link to={app.onNaisema}>Reviewed entries on NAISEMA</Link>
                </p>
              )}
              <p>
                <a href={app.href} rel="noopener">
                  Try the preview on apps.naisema.com
                </a>
              </p>
              {app.forms.length > 0 && (
                <ul aria-label={`Help ${app.name} grow`}>
                  {app.forms.map((type) => (
                    <li key={type}>
                      <Link to={`/forms/${SUBMISSION_TYPES[type].path}`}>{SUBMISSION_TYPES[type].title}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <p>Everything sent through these forms is read by our team and checked before anything is shown.</p>
      </article>
    </main>
  );
}
