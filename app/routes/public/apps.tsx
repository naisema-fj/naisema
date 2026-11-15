import { ArrowRight, BookOpen, Eye, GraduationCap, MessagesSquare, Send, Smartphone } from "lucide-react";
import { Link } from "react-router";
import { FORM_ICONS, Icon } from "~/components/icons";
import { NoticeField, TextField, TurnstileField } from "~/components/public/form-fields";
import { BackLink, NotOpen, PageHead } from "~/components/public/parts";
import { cloudflareContext } from "~/lib/cloudflare";
import { FIJIAN_APPS, type FijianAppKey } from "~/lib/fijian-apps";
import { FIELD_LIMITS, FORMS } from "~/lib/forms";
import { publicHeaders } from "~/lib/http";
import type { RouteHandle } from "~/lib/route-handle";
import type { Route } from "./+types/apps";

/** Server-rendered with no script but Turnstile's, for the suggestion form at the foot. */
export const handle: RouteHandle = { hydrate: false, turnstile: true };
export const headers = publicHeaders;

export function meta() {
  return [
    { title: "Fijian apps · NAISEMA" },
    { name: "description", content: "NAISEMA is a space for Fijian connection and a growing home for Fijian apps." },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { siteKey: context.get(cloudflareContext).env.TURNSTILE_SITE_KEY };
}

const APP_ICONS: Record<FijianAppKey, typeof BookOpen> = {
  vosa: BookOpen,
  lessons: GraduationCap,
  translation: MessagesSquare,
};
const APP_TONES: Record<FijianAppKey, string> = { vosa: "learn", lessons: "voices", translation: "connect" };

/**
 * GET /apps: the Fijian apps, once the home page of apps.naisema.com. Each app is a preview and
 * says how far along it is (PUB-01); the suggestion form sends a word to the team as a Submission
 * (the "suggest-word" form), as the apps site's form did.
 */
export default function Apps({ loaderData }: Route.ComponentProps) {
  const suggest = FORMS["suggest-word"];
  return (
    <main id="main" className="area-page">
      <article className="pane pane-wide area-pane" aria-labelledby="apps-heading">
        <BackLink to="/learn">Learn</BackLink>
        <PageHead
          tone="learn"
          icon={Smartphone}
          headingId="apps-heading"
          title="Fijian apps"
          plate={<p className="lede">A space for Fijian connection. Mai vei keda, kivei keda. From us, for us.</p>}
        />
        <img
          className="apps-banner"
          src="/apps/assets/naisema-banner.png"
          width={1640}
          height={624}
          alt="NAISEMA. A space for Fijian connection. Mai vei keda, kivei keda. From us, for us."
        />

        <section id="apps" className="apps-section" aria-labelledby="apps-list-heading">
          <h2 id="apps-list-heading">Explore the Fijian apps</h2>
          <p className="standfirst">
            NAISEMA brings language tools together in one place. Vosa is the first app in this space; more apps will
            follow.
          </p>
          <ul className="app-grid">
            {FIJIAN_APPS.map((app, index) => (
              <li key={app.key} className="app-card">
                <span className={`seat seat-medium tone-${APP_TONES[app.key]}-soft`}>
                  <Icon icon={APP_ICONS[app.key]} size={26} />
                </span>
                <h3 id={`app-${app.key}`}>
                  {app.name}
                  <span className="app-kind">
                    App {String(index + 1).padStart(2, "0")} · {app.kind}
                  </span>
                </h3>
                <p>{app.summary}</p>
                <NotOpen label={`${app.state}.`}>{app.caution}</NotOpen>
                <div className="app-actions">
                  <a href={app.href} className="button" aria-describedby={`app-${app.key}`}>
                    {app.open}
                    <Icon icon={ArrowRight} size={18} />
                  </a>
                  {app.forms.length > 0 && (
                    <ul className="app-forms" aria-label={`Help ${app.name} grow`}>
                      {app.forms.map((key) => (
                        <li key={key}>
                          <Link to={`/forms/${key}`} reloadDocument className="button button-soft">
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
        </section>

        <section id="about" className="apps-about" aria-labelledby="about-heading">
          <img src="/apps/assets/naisema-logo.png" width={96} height={96} alt="" />
          <div>
            <h2 id="about-heading">Begin where your curiosity takes you</h2>
            <p>
              One place, many paths. The dictionary is one starting point. This space will hold different Fijian apps as
              they are developed, each with its own purpose.
            </p>
          </div>
        </section>

        <section id="suggest" className="apps-suggest" aria-labelledby="suggest-heading">
          <div className="apps-suggest-intro">
            <h2 id="suggest-heading">Suggest a word for Vosa</h2>
            <p>
              Suggest a Fijian word or phrase and its English meaning, without an account. The NAISEMA team checks
              suggestions before they appear publicly.
            </p>
            <p>Found an error? Send the word with the corrected English meaning for the team to review.</p>
            <ol className="apps-steps">
              <li>
                <strong>Suggest</strong> Share a word and its meaning.
              </li>
              <li>
                <strong>Review</strong> The team checks it privately.
              </li>
              <li>
                <strong>Publish</strong> Approved words join Vosa.
              </li>
            </ol>
          </div>
          <form method="post" action="/forms/suggest-word" className="public-form">
            {suggest.fields.map((field) => (
              <TextField
                key={field.name}
                name={field.name}
                label={field.label}
                long={"long" in field && field.long}
                values={{}}
                errors={{}}
                maxLength={"long" in field && field.long ? FIELD_LIMITS.long : FIELD_LIMITS.short}
              />
            ))}
            <NoticeField values={{}} errors={{}} />
            <TurnstileField siteKey={loaderData.siteKey} />
            <button type="submit">
              <Icon icon={Send} />
              Send for review
            </button>
          </form>
        </section>

        <p className="quiet-line">
          <Icon icon={Eye} />
          Everything sent through these forms is read by our team and checked before anything is shown.
        </p>
      </article>
    </main>
  );
}
