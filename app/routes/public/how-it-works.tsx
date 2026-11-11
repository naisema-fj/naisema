import { Link } from "react-router";
import { AREA_INFO, AREA_NAMES, PRIMARY_AREAS } from "~/lib/areas";
import { publicHeaders } from "~/lib/http";
import { IMMERSION_STAGES, stageText } from "~/lib/immersion";

export const handle = { hydrate: false };
export const headers = publicHeaders;

export function meta() {
  return [
    { title: "How NAISEMA works · NAISEMA" },
    {
      name: "description",
      content:
        "A short, plain tour of NAISEMA: where to find things, how to learn Fijian from a video, and what the review labels mean.",
    },
  ];
}

/**
 * GET /how-it-works: the "start here" page. Plain words, no account and no client JavaScript.
 * The steps come from the player's own text (app/lib/immersion.ts), so this page can't drift from
 * what the player says. It promises only what is open (PUB-01).
 */
export default function HowItWorks() {
  return (
    <main id="main" className="area-page">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li aria-current="page">How NAISEMA works</li>
        </ol>
      </nav>
      <article className="pane area-pane guide" aria-labelledby="guide-heading">
        <header className="pane-intro">
          <div className="pane-head tile-learn">
            <h1 id="guide-heading">How NAISEMA works</h1>
          </div>
          <p className="lede">A two-minute tour. You don't need an account, and there is no wrong way to use it.</p>
          <nav aria-label="On this page" className="area-sections">
            <ul>
              <li>
                <a href="#find">Find your way</a>
              </li>
              <li>
                <a href="#learn">Learn from a video</a>
              </li>
              <li>
                <a href="#labels">What the labels mean</a>
              </li>
              <li>
                <a href="#help">Stuck?</a>
              </li>
            </ul>
          </nav>
        </header>

        <section id="find" aria-labelledby="find-heading" className="guide-section">
          <h2 id="find-heading">Find your way</h2>
          <p>
            NAISEMA has six areas. Pick the one that sounds like what you want today; you can always come back. Not
            sure? Use <Link to="/search">Search</Link>, or browse <Link to="/topics">Topics</Link>, which cut across
            every area.
          </p>
          <dl className="guide-areas">
            {PRIMARY_AREAS.map((area) => (
              <div key={area}>
                <dt>
                  <Link to={`/${area}`}>{AREA_NAMES[area]}</Link>
                </dt>
                <dd>{AREA_INFO[area].description}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="learn" aria-labelledby="learn-heading" className="guide-section">
          <h2 id="learn-heading">Learn from a video</h2>
          <p>
            Some videos in <Link to="/learn">Learn</Link> have a language layer. Open one and you're led through{" "}
            {IMMERSION_STAGES.length} short steps, from simply watching to using what you've heard with someone.
          </p>
          <ol className="guide-steps">
            {IMMERSION_STAGES.map(({ id }) => {
              const step = stageText(id, "Fijian");
              return (
                <li key={id}>
                  <strong>{step.name}.</strong> {step.guide}
                </li>
              );
            })}
          </ol>
          <ul className="guide-reassure">
            <li>
              <strong>Go at your own pace.</strong> Follow the steps in order, or jump to any of them. Skip what you
              don't need and come back whenever you like.
            </li>
            <li>
              <strong>Help is always there.</strong> Replay a line, slow it down, or ask for the English when you want
              it.
            </li>
            <li>
              <strong>Nothing is graded.</strong> You can try an answer again as often as you like.
            </li>
            <li>
              <strong>Your progress stays on your device.</strong> It is never sent to us, so there is nothing to sign
              up for. Clearing this browser's data clears it.
            </li>
          </ul>
          {AREA_INFO.learn.notYetOpen && (
            <p className="not-open">
              <span className="from-label">Not open yet</span> {AREA_INFO.learn.notYetOpen}
            </p>
          )}
        </section>

        <section id="labels" aria-labelledby="labels-heading" className="guide-section">
          <h2 id="labels-heading">What the labels mean</h2>
          <p>
            Under a story or video you may see a line such as <em>Language reviewed · Standard Fijian</em>, with the
            date. It says exactly what a person checked, and nothing more. Labels are written from the reviews that were
            really recorded for the version you're reading, never added by hand.
          </p>
          <ul className="guide-reassure">
            <li>
              <strong>Language reviewed</strong> means someone who knows that form of Fijian checked the language.
            </li>
            <li>
              <strong>Cultural context reviewed</strong> means a person with standing to speak for that knowledge
              approved how it is told.
            </li>
            <li>
              <strong>Opinion</strong> marks a personal view or experience rather than a settled account.
            </li>
          </ul>
          <p>If something hasn't been reviewed for a thing, we don't say it has.</p>
        </section>

        <section id="help" aria-labelledby="help-heading" className="guide-section">
          <h2 id="help-heading">Stuck, or something's wrong?</h2>
          <ul className="guide-links">
            <li>
              <Link to="/forms/enquiry">Send us a message</Link>, and a person will read it.
            </li>
            <li>
              <Link to="/accessibility">Accessibility</Link>: what we know doesn't work yet, and how to tell us.
            </li>
            <li>
              <Link to="/forms/report">Report a problem</Link> with something on NAISEMA.
            </li>
            <li>
              <Link to="/newsletter">Sign up for the newsletter</Link> to hear when new things open.
            </li>
          </ul>
        </section>
      </article>
    </main>
  );
}
