import { ArrowRight, Bell, BookOpen, CircleHelp, Search, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { AREA_ICONS, FORM_ICONS, Icon } from "~/components/icons";
import { PieceList } from "~/components/public/parts";
import { WovenMark } from "~/components/public/woven-mark";
import { AREA_INFO, AREA_NAMES, PRIMARY_AREAS } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import { publicItems } from "~/lib/content.server";
import { getDb } from "~/lib/db.server";
import { FORMS, type FormKey } from "~/lib/forms";
import { publicHeaders } from "~/lib/http";
import { itemCard } from "~/lib/public-view.server";
import type { Route } from "./+types/home";

/** The public forms the homepage offers, in the order of the PRD's "ways to participate". */
const PARTICIPATE_FORMS: FormKey[] = ["contribute", "teach", "consultation", "enquiry"];

export const handle = { hydrate: false };
export const headers = publicHeaders;

export async function loader({ context }: Route.LoaderArgs) {
  const db = getDb(context.get(cloudflareContext).env.DB);
  const latest = await publicItems(db, { limit: 3 });
  return { latest: latest.filter((found) => found.item.area !== "pages").map(itemCard) };
}

export function meta() {
  return [
    { title: "NAISEMA" },
    { name: "description", content: "Fijian language, stories and culture for Fijians abroad, and everyone else." },
  ];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { latest } = loaderData;
  return (
    <main id="main" className="home">
      <section className="welcome" aria-labelledby="welcome-heading">
        <div className="welcome-inner">
          <div className="welcome-words">
            <h1 id="welcome-heading">Bula vinaka</h1>
            <p className="welcome-statement">
              Wherever you are, this is a place to hear Fijian spoken, read the stories, and find the people who teach.
              Everything here says who it is from and what it was reviewed for.
            </p>
            <p className="button-row">
              <Link to="/learn" className="button">
                <Icon icon={BookOpen} />
                Start learning
              </Link>
              <a href="#latest" className="button button-soft">
                <Icon icon={Sparkles} />
                See what's new
              </a>
            </p>
            <p className="welcome-guide">
              <Icon icon={CircleHelp} />
              <span>
                New here? <Link to="/how-it-works">See how NAISEMA works</Link>
              </span>
            </p>
          </div>
          <div className="welcome-mark">
            <WovenMark />
          </div>
        </div>
        <div className="weave-strip" />
      </section>

      <section id="areas" className="rooms" aria-labelledby="areas-heading">
        <h2 id="areas-heading">Where would you like to go?</h2>
        <ul className="room-grid">
          {PRIMARY_AREAS.map((area) => (
            <li key={area} className={`room-cell room-cell-${area}`}>
              <Link to={`/${area}`} className={`room tone-${area}`}>
                <span className="room-top">
                  <span className="seat">
                    <Icon icon={AREA_ICONS[area]} size={area === "learn" ? 36 : 26} />
                  </span>
                  <Icon icon={ArrowRight} className="room-arrow" />
                </span>
                <span className="room-name">{AREA_NAMES[area]}</span>
                <span className="room-text">
                  {AREA_INFO[area].description}
                  {area === "learn" && (
                    <span className="room-start">
                      Start here
                      <Icon icon={ArrowRight} size={18} />
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
          <li className="room-cell">
            <Link to="/search" className="room tone-none">
              <span className="room-top">
                <span className="seat">
                  <Icon icon={Search} size={26} />
                </span>
                <Icon icon={ArrowRight} className="room-arrow" />
              </span>
              <span className="room-name">Looking for something?</span>
              <span className="room-text">Search every story, recording and guide.</span>
            </Link>
          </li>
        </ul>
      </section>

      <div className="home-close">
        <section id="latest" className="latest" aria-labelledby="latest-heading">
          <h2 id="latest-heading">New on NAISEMA</h2>
          {latest.length ? (
            <PieceList items={latest} showArea />
          ) : (
            <p className="shelf-empty">
              Nothing has been published yet. The first pieces are being written and reviewed.
            </p>
          )}
        </section>

        <div className="home-side">
          <section className="join" aria-labelledby="participate-heading">
            <h2 id="participate-heading">Join in</h2>
            <ul className="join-links">
              {PARTICIPATE_FORMS.map((key) => (
                <li key={key}>
                  <Link to={`/forms/${key}`}>
                    <span className="seat seat-small">
                      <Icon icon={FORM_ICONS[key]} />
                    </span>
                    {FORMS[key].title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="updates" aria-labelledby="updates-heading">
            <h2 id="updates-heading">
              <span className="seat seat-small">
                <Icon icon={Bell} />
              </span>
              Updates
            </h2>
            <p>News of new stories, recordings, classes and consultations.</p>
            <p>
              <Link to="/newsletter" className="button">
                Sign up for the newsletter
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
