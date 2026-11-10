import { Link } from "react-router";
import { FIJIAN_APPS } from "~/lib/fijian-apps";
import { FORMS } from "~/lib/forms";
import { publicHeaders } from "~/lib/http";

export const handle = { hydrate: false };
export const headers = publicHeaders;

export function meta() {
  return [{ title: "Fijian apps · NAISEMA" }];
}

/** GET /apps: the Fijian apps on apps.naisema.com, each saying plainly what isn't open yet (PUB-01). */
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
              <p className="app-preview">
                <a href={app.href} rel="noopener">
                  Try the preview on apps.naisema.com
                </a>
              </p>
              {app.forms.length > 0 && (
                <ul className="app-forms" aria-label={`Help ${app.name} grow`}>
                  {app.forms.map((key) => (
                    <li key={key}>
                      <Link to={`/forms/${key}`}>{FORMS[key].title}</Link>
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
