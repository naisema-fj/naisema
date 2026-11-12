import {
  Accessibility,
  Bell,
  CircleHelp,
  Compass,
  Flag,
  Languages,
  Lock,
  Mail,
  Play,
  Repeat,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router";
import { AREA_ICONS, Icon, labelIcon, STAGE_ICONS } from "~/components/icons";
import { BackLink, NotOpen, PageHead } from "~/components/public/parts";
import { AREA_INFO, AREA_NAMES, PRIMARY_AREAS } from "~/lib/areas";
import { publicHeaders } from "~/lib/http";
import { IMMERSION_STAGES, stageText } from "~/lib/immersion";
import { ALL_LABEL_MEANINGS } from "~/lib/review-label-help";

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

const REASSURE = [
  {
    icon: Repeat,
    title: "Go at your own pace.",
    text: "Follow the steps in order, or jump to any of them. Skip what you don't need and come back whenever you like.",
  },
  {
    icon: CircleHelp,
    title: "Help is always there.",
    text: "Replay a line, slow it down, or ask for the English when you want it.",
  },
  { icon: Sparkles, title: "Nothing is graded.", text: "You can try an answer again as often as you like." },
  {
    icon: Lock,
    title: "Your progress stays on your device.",
    text: "It is never sent to us, so there is nothing to sign up for. Clearing this browser's data clears it.",
  },
];

const HELP_LINKS = [
  { to: "/forms/enquiry", icon: Mail, label: "Send us a message", after: ", and a person will read it." },
  {
    to: "/accessibility",
    icon: Accessibility,
    label: "Accessibility",
    after: ": what we know doesn't work yet, and how to tell us.",
  },
  { to: "/forms/report", icon: Flag, label: "Report a problem", after: " with something on NAISEMA." },
  { to: "/newsletter", icon: Bell, label: "Sign up for the newsletter", after: " to hear when new things open." },
];

/**
 * GET /how-it-works: the "start here" page. Plain words, no account and no client JavaScript.
 * The steps come from the player's own text (app/lib/immersion.ts), so this page can't drift from
 * what the player says. It promises only what is open (PUB-01).
 */
export default function HowItWorks() {
  return (
    <main id="main" className="area-page">
      <article className="pane pane-wide guide" aria-labelledby="guide-heading">
        <BackLink to="/">Home</BackLink>
        <PageHead
          tone="none"
          icon={CircleHelp}
          headingId="guide-heading"
          title="How NAISEMA works"
          plate={
            <p className="lede">A two-minute tour. You don't need an account, and there is no wrong way to use it.</p>
          }
        />
        <div className="guide-layout">
          <nav aria-label="On this page" className="guide-toc">
            <h2 className="guide-toc-heading">On this page</h2>
            <ul>
              <li>
                <a href="#find">
                  <Icon icon={Compass} />
                  Find your way
                </a>
              </li>
              <li>
                <a href="#learn">
                  <Icon icon={Play} />
                  Learn from a video
                </a>
              </li>
              <li>
                <a href="#labels">
                  <Icon icon={Languages} />
                  What the labels mean
                </a>
              </li>
              <li>
                <a href="#help">
                  <Icon icon={Mail} />
                  Stuck?
                </a>
              </li>
            </ul>
          </nav>

          <div className="guide-body">
            <section id="find" aria-labelledby="find-heading" className="guide-section">
              <h2 id="find-heading">Find your way</h2>
              <p>
                NAISEMA has six areas. Pick the one that sounds like what you want today; you can always come back. Not
                sure? Use <Link to="/search">Search</Link>, or browse <Link to="/topics">Topics</Link>, which cut across
                every area.
              </p>
              <ul className="guide-areas">
                {PRIMARY_AREAS.map((area) => (
                  <li key={area}>
                    <Link to={`/${area}`} className="guide-area">
                      <span className={`seat seat-small tone-${area}`}>
                        <Icon icon={AREA_ICONS[area]} />
                      </span>
                      <span>
                        <strong>{AREA_NAMES[area]}</strong>
                        <span className="guide-area-text">{AREA_INFO[area].description}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section id="learn" aria-labelledby="learn-heading" className="guide-section">
              <h2 id="learn-heading">Learn from a video</h2>
              <p>
                Some videos in <Link to="/learn">Learn</Link> have a language layer. Open one and you're led through{" "}
                {IMMERSION_STAGES.length} short steps, from simply watching to using what you've heard with someone.
              </p>
              <ol className="guide-steps">
                {IMMERSION_STAGES.map(({ id }, index) => {
                  const step = stageText(id, "Fijian");
                  return (
                    <li key={id}>
                      <span className="step-count" aria-hidden="true">
                        {index + 1}
                      </span>
                      <span className="step-icon">
                        <Icon icon={STAGE_ICONS[id]} />
                      </span>
                      <span>
                        <strong>{step.name}.</strong> {step.guide}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <ul className="guide-reassure">
                {REASSURE.map((line) => (
                  <li key={line.title}>
                    <Icon icon={line.icon} />
                    <span>
                      <strong>{line.title}</strong> {line.text}
                    </span>
                  </li>
                ))}
              </ul>
              {AREA_INFO.learn.notYetOpen && <NotOpen>{AREA_INFO.learn.notYetOpen}</NotOpen>}
            </section>

            <section id="labels" aria-labelledby="labels-heading" className="guide-section">
              <h2 id="labels-heading">What the labels mean</h2>
              <p>
                Under a story or video you may see a line such as <em>Language reviewed · Standard Fijian</em>, with the
                date. It says exactly what a person checked, and nothing more. Labels are written from the reviews that
                were really recorded for the version you're reading, never added by hand.
              </p>
              <ul className="label-lines label-meanings">
                {ALL_LABEL_MEANINGS.map((label) => (
                  <li key={label.name}>
                    <span className="seat seat-small">
                      <Icon icon={labelIcon(label.name)} />
                    </span>
                    <span>
                      <strong>{label.name}</strong> means {label.meaning}
                    </span>
                  </li>
                ))}
              </ul>
              <p>If something hasn't been reviewed for a thing, we don't say it has.</p>
            </section>

            <section id="help" aria-labelledby="help-heading" className="guide-section guide-help">
              <h2 id="help-heading">Stuck, or something's wrong?</h2>
              <ul className="guide-links">
                {HELP_LINKS.map((link) => (
                  <li key={link.to}>
                    <Icon icon={link.icon} />
                    <span>
                      <Link to={link.to}>{link.label}</Link>
                      {link.after}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </article>
    </main>
  );
}
