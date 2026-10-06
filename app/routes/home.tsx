import { Link } from "react-router";
import { DateMark } from "~/components/public/postmarks";
import { WovenMark } from "~/components/public/woven-mark";
import { AREA_INFO, AREA_NAMES, PRIMARY_AREAS } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { publicHeaders } from "~/lib/public-cache.server";
import { listPublic } from "~/lib/search.server";
import { getSiteSettings } from "~/lib/site-settings.server";
import { SUBMISSION_TYPES, type SubmissionType } from "~/lib/submission-fields";
import type { Route } from "./+types/home";

/** The public forms the homepage offers, in the order of the PRD's "ways to participate". */
const PARTICIPATE_FORMS: SubmissionType[] = ["contribution", "educator_interest", "consultation_interest", "enquiry"];

export const handle = { hydrate: false };
export const headers = publicHeaders;

export async function loader({ context }: Route.LoaderArgs) {
  const db = getDb(context.get(cloudflareContext).env.DB);
  const [settings, latest] = await Promise.all([getSiteSettings(db), listPublic(db, { limit: 3 })]);
  return { ...settings, latest: latest.listings };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData.siteName },
    {
      name: "description",
      content: "Fijian language, stories and culture for Fijians abroad, and everyone else.",
    },
  ];
}

const DEFAULT_WELCOME =
  "Wherever you are, this is a place to hear Fijian spoken, read the stories, and find the people who teach. Everything here says who it is from and what it was reviewed for.";

export default function Home({ loaderData }: Route.ComponentProps) {
  const { latest, siteName } = loaderData;
  const first = latest[0];

  return (
    <main id="main" className="home">
      <div className="mat">
        <section className="tile tile-welcome" aria-labelledby="welcome-heading">
          <div className="welcome-head">
            <h1 id="welcome-heading">Bula vinaka</h1>
            <WovenMark />
          </div>
          <p className="welcome-statement">{loaderData.welcomeStatement ?? DEFAULT_WELCOME}</p>
          <p className="welcome-action">
            <Link to={first ? first.path : "#areas"} className="primary-link">
              {first ? "Read the latest" : "Explore the areas"}
            </Link>
          </p>
          <p className="sign-off">
            <span className="signature">{siteName}</span>
          </p>
          {first?.publishedAt && (
            <p className="dateline">
              <DateMark label="Last published" date={first.publishedAt} />
            </p>
          )}
        </section>

        <section id="areas" className="areas" aria-labelledby="areas-heading">
          <h2 id="areas-heading" className="visually-hidden">
            Where to go
          </h2>
          <ul className="area-tiles">
            {PRIMARY_AREAS.map((area, index) => (
              <li key={area}>
                {/* Alternately upright and sideways, as the strands of the mark are. */}
                <Link to={`/${area}`} className={`tile tile-${area} ${index % 2 ? "tile-across" : "tile-upright"}`}>
                  <span className="tile-name">{AREA_NAMES[area]}</span>
                  <span className="tile-text">
                    {AREA_INFO[area].description}
                    {AREA_INFO[area].notYetOpen && <span className="tile-note">Some parts not open yet</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="tile tile-latest" aria-labelledby="latest-heading">
          <h2 id="latest-heading">Recently published</h2>
          {latest.length ? (
            <ul className="piece-list">
              {latest.map((item) => (
                <li key={item.path}>
                  <Link to={item.path}>{item.title}</Link>
                  <p>{item.summary}</p>
                  <p className="list-mark">
                    {item.areaName}
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
            <p>Nothing has been published yet. The first pieces are being written and reviewed.</p>
          )}
        </section>

        <section className="tile tile-participate" aria-labelledby="participate-heading">
          <h2 id="participate-heading">Ways to take part</h2>
          <ul className="participate-links">
            {PARTICIPATE_FORMS.map((type) => (
              <li key={type}>
                <Link to={`/forms/${SUBMISSION_TYPES[type].path}`}>{SUBMISSION_TYPES[type].title}</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="tile tile-updates" aria-labelledby="updates-heading">
          <h2 id="updates-heading">Updates</h2>
          <p>
            News of new stories, recordings, classes and consultations. You'll be asked to confirm before anything is
            sent.
          </p>
          <p>
            <Link to="/newsletter">Sign up for the newsletter</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
