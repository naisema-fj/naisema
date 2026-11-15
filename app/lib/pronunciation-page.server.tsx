import { renderToStaticMarkup } from "react-dom/server";
import type { PublicSound } from "./sounds.server";

/**
 * The pronunciation library's page body, built from the sound guide (change note 0003). It reads
 * and plays with no JavaScript: every letter is listed with its own audio control. The page's
 * script (public/apps/dictionary/pronunciation/app.js) then adds the featured letter, the speed
 * control and tap-to-listen, reading each letter's details from the `data-` attributes here.
 * Class names are the apps site's own, so its stylesheet still applies.
 */

const ipaOf = (sound: PublicSound) => (sound.ipa ? `/${sound.ipa}/` : "—");

function Tile({ sound }: { sound: PublicSound }) {
  return (
    <li
      className={`sound-tile${sound.reviewed ? " reviewed" : ""}`}
      id={sound.letter}
      data-letter={sound.letter}
      data-display={sound.display}
      data-group={sound.groupName}
      data-ipa={ipaOf(sound)}
      data-english={sound.englishComparison}
      data-note={sound.note}
      data-src={sound.src ?? ""}
      data-recording={sound.recording}
      data-review={sound.label}
    >
      <a className="tile-link" href={`#${sound.letter}`}>
        <span className="icon" aria-hidden="true">
          ▶
        </span>
        <span className="char">{sound.display}</span>
        <span className="tile-ipa">{ipaOf(sound)}</span>
        <span className="tile-English">{sound.englishComparison}</span>
        <span className="details">
          {sound.groupName}
          {sound.seconds ? ` · ${sound.seconds}` : ""}
        </span>
      </a>
      {sound.src ? (
        // biome-ignore lint/a11y/useMediaCaption: a single spoken letter has nothing to caption
        <audio className="native-audio" controls preload="none" src={sound.src}>
          <a href={sound.src}>Play the recording of {sound.display}</a>
        </audio>
      ) : (
        <span className="no-audio">
          {sound.recording === "withheld"
            ? "This recording isn't available right now."
            : "A recording is still needed."}
        </span>
      )}
      <span className="review-state">{sound.label}</span>
    </li>
  );
}

export function pronunciationBody(sounds: PublicSound[]) {
  const letters = sounds.filter((sound) => sound.groupName !== "Recording label");
  const labels = sounds.filter((sound) => sound.groupName === "Recording label");
  const first = letters[0] ?? sounds[0];
  const playable = sounds.filter((sound) => sound.src).length;
  const reviewed = sounds.filter((sound) => sound.reviewed).length;
  return renderToStaticMarkup(
    <main id="main" className="shell">
      <nav className="library-nav" aria-label="Dictionary navigation">
        <a href="../">← Back to Vosa dictionary</a>
        <span aria-current="page">Pronunciation</span>
      </nav>
      <p className="eyebrow">Listen · Notice · Repeat</p>
      <h1 id="page-title">Fijian pronunciation library</h1>
      <p className="review-note">
        Learning draft: IPA symbols and English comparisons describe expected sounds; they do not certify these
        particular recordings. {reviewed} of {sounds.length} sounds have been reviewed by a Language Reviewer, and each
        says so below. Dz is a recording label; its place in Fijian spelling is unconfirmed.
      </p>
      {first && (
        <section className="hero" id="featured" hidden aria-labelledby="selected-title">
          <div className="masi" />
          <div className="hero-top">
            <div>
              <div className="header-flex">
                <div className="big-letter" id="featured-letter">
                  {first.display}
                </div>
                <span id="group" className="little-tag">
                  {first.groupName}
                </span>
              </div>
              <h2 id="selected-title">Hear the Fijian sound</h2>
              <div className="phonetic-summary" aria-live="polite">
                <div className="ipa-box">
                  <span className="minor-label">Broad IPA guide</span>
                  <strong id="ipa">{ipaOf(first)}</strong>
                </div>
                <div className="english-box">
                  <span className="minor-label">Closest English sound</span>
                  <strong id="english-approx">{first.englishComparison}</strong>
                </div>
              </div>
              <p className="explain-note" id="phonetic-note">
                {first.note}
              </p>
              <p className="small-note">
                Listen to the recorded pronunciation, then repeat it. Select another sound below to compare.
              </p>
              <p className="small-note" id="review-state-note">
                {first.label}
              </p>
            </div>
          </div>
          <div className="player">
            <button className="play" id="play" type="button">
              <span className="play-icon" id="play-icon" aria-hidden="true">
                ▶
              </span>
              <span>
                <strong id="play-label">Hear {first.letter}</strong>
                <small id="play-hint">Tap to hear the recording</small>
              </span>
              <span className="wave" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
            </button>
            <div className="controls">
              <span id="elapsed">0:00</span>
              <input type="range" min="0" max="100" defaultValue="0" id="seek" aria-label="Audio playback position" />
              <span id="duration">0:00</span>
              <button className="speed" id="speed" type="button" aria-label="1× playback speed, change">
                1×
              </button>
            </div>
          </div>
        </section>
      )}
      <div className="section-top">
        <h2>Fijian letters</h2>
        <span>
          {letters.length} letters · {letters.filter((sound) => sound.src).length} recordings
        </span>
      </div>
      <ul className="sound-list" id="sound-list" aria-label="The Fijian letters and their recordings">
        {letters.map((sound) => (
          <Tile key={sound.id} sound={sound} />
        ))}
      </ul>
      {labels.length > 0 && (
        <section className="unclassified-sound" aria-labelledby="unclassified-title">
          <h2 id="unclassified-title">Recording under review</h2>
          <p>
            Dz is the label supplied with this recording. It is not presented as a confirmed Fijian letter or given an
            IPA value.
          </p>
          <ul className="sound-list">
            {labels.map((sound) => (
              <Tile key={sound.id} sound={sound} />
            ))}
          </ul>
        </section>
      )}
      <div className="info">
        <strong>About this sound guide:</strong> {playable} of {sounds.length} sounds have a recording that plays. The
        recordings were made by the NAISEMA team. IPA symbols and English comparisons describe expected pronunciation
        and still need to be checked against each recording by a Language Reviewer. Dz is a supplied recording label
        whose place in Fijian spelling and sound descriptions still needs review.{" "}
        <a href="https://fijiguide.com/culture/language/saying-it-in-fijian/">Schütz’s pronunciation guide</a> and{" "}
        <a href="https://manifold.uhpress.hawaii.edu/projects/the-fijian-language">The Fijian Language</a> inform the
        expected sound values.
      </div>
      <div className="footer">NAISEMA · Mai vei keda, kivei keda · From us, for us</div>
      {/* biome-ignore lint/a11y/useMediaCaption: a single spoken letter has nothing to caption */}
      <audio id="voice" preload="none" />
    </main>,
  );
}
