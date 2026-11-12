import { BookOpen, ExternalLink, Eye, GraduationCap, MessagesSquare, Smartphone } from "lucide-react";
import { Link } from "react-router";
import { FORM_ICONS, Icon } from "~/components/icons";
import { BackLink, NotOpen, PageHead } from "~/components/public/parts";
import { FIJIAN_APPS } from "~/lib/fijian-apps";
import { FORMS } from "~/lib/forms";
import { publicHeaders } from "~/lib/http";

export const handle = { hydrate: false };
export const headers = publicHeaders;

export function meta() {
  return [{ title: "Fijian apps · NAISEMA" }];
}

const APP_ICONS = [BookOpen, GraduationCap, MessagesSquare];
const APP_TONES = ["learn", "voices", "connect"] as const;

/** GET /apps: the Fijian apps on apps.naisema.com, each saying plainly what isn't open yet (PUB-01). */
export default function Apps() {
  return (
    <main id="main" className="area-page">
      <article className="pane pane-wide area-pane" aria-labelledby="apps-heading">
        <BackLink to="/learn">Learn</BackLink>
        <PageHead
          tone="learn"
          icon={Smartphone}
          headingId="apps-heading"
          title="Fijian apps"
          plate={
            <p className="lede">
              A dictionary, lessons and a place to work out new Fijian words together. Mai vei keda, kivei keda.
            </p>
          }
        />
        <ul className="app-grid">
          {FIJIAN_APPS.map((app, index) => (
            <li key={app.key} className="app-card">
              <span className={`seat seat-medium tone-${APP_TONES[index % 3]}-soft`}>
                <Icon icon={APP_ICONS[index % 3]} size={26} />
              </span>
              <h2 id={`app-${app.key}`}>{app.name}</h2>
              <p>{app.summary}</p>
              <NotOpen>{app.notYetOpen}</NotOpen>
              <div className="app-actions">
                <a href={app.href} rel="noopener" className="button">
                  Try the preview on apps.naisema.com
                  <Icon icon={ExternalLink} size={18} />
                </a>
                {app.forms.length > 0 && (
                  <ul className="app-forms" aria-label={`Help ${app.name} grow`}>
                    {app.forms.map((key) => (
                      <li key={key}>
                        <Link to={`/forms/${key}`} className="button button-soft">
                          <Icon icon={FORM_ICONS[key]} size={18} />
                          {FORMS[key].title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="quiet-line">
          <Icon icon={Eye} />
          Everything sent through these forms is read by our team and checked before anything is shown.
        </p>
      </article>
    </main>
  );
}
