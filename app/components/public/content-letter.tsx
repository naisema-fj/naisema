import { Link } from "react-router";
import { ArticleBodyView } from "~/components/article-body-view";
import { DateMark, Postmarks } from "~/components/public/postmarks";
import { TranscriptParagraphs } from "~/components/transcript-paragraphs";
import type { PublicArticle } from "~/lib/public.server";

const sameDay = (a: Date | string, b: Date | string) =>
  new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);

/**
 * A published Article, Resource or Page as a letter: who it is from, when, what it was reviewed
 * for, a Resource's details before its download, the body, and the related items chosen for it.
 */
export function ContentLetter({ item }: { item: PublicArticle }) {
  const published = item.firstPublishedAt;
  const updated = item.lastPublishedAt;
  const name = item.format.toLowerCase();
  return (
    <article className="letter">
      <header className="letter-head">
        <h1>{item.title}</h1>
        <p className="lede">{item.summary}</p>
        <p className="from">
          <span className="from-label">From</span> {item.credit}
        </p>
      </header>

      <Postmarks label={`About this ${name}`}>
        <li>{item.format}</li>
        {published && (
          <li>
            <DateMark label="Published" date={published} />
          </li>
        )}
        {published && updated && !sameDay(published, updated) && (
          <li>
            <DateMark label="Updated" date={updated} />
          </li>
        )}
      </Postmarks>

      <section className="review-labels" aria-labelledby="reviewed-heading">
        <h2 id="reviewed-heading" className="review-labels-heading">
          Review Labels
        </h2>
        {item.labels.length ? (
          <Postmarks label="Review Labels">
            {item.labels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </Postmarks>
        ) : (
          <p className="no-review">{`This ${name} has none.`}</p>
        )}
      </section>

      {item.resource && <ResourceDetails id={item.id} resource={item.resource} />}
      {item.episode && <EpisodePlayer title={item.title} episode={item.episode} />}
      {item.creator && <CreatorDetails creator={item.creator} />}

      <div className="letter-body">
        <ArticleBodyView body={item.body} embeds={item.embeds} />
      </div>

      {item.episode && <Transcript paragraphs={item.episode.transcript} />}

      <footer className="letter-foot">
        {item.topics.length > 0 && (
          <p>
            <span className="from-label">Topics</span>{" "}
            {item.topics.map((topic, index) => (
              <span key={topic.slug}>
                {index > 0 && ", "}
                <Link to={`/topics/${topic.slug}`}>{topic.name}</Link>
              </span>
            ))}
          </p>
        )}
        {item.sources && (
          <section aria-labelledby="sources-heading">
            <h2 id="sources-heading">Sources</h2>
            <p className="sources">{item.sources}</p>
          </section>
        )}
        {item.related.length > 0 && (
          <section aria-labelledby="related-heading" className="related">
            <h2 id="related-heading">Related</h2>
            <ul className="letter-list">
              {item.related.map((related) => (
                <li key={related.path}>
                  <Link to={related.path}>{related.title}</Link>
                  <p>{related.summary}</p>
                  <p className="list-mark">{related.typeName}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
        {item.area && (
          <p>
            <Link to={`/${item.area}`}>More from {item.areaName}</Link>
          </p>
        )}
      </footer>
      {/* Counts the view (content_opened, IDs only) even when the page came from the edge cache; no script needed. */}
      <img src={`/e/opened/${item.id}`} alt="" width={1} height={1} className="beacon" />
    </article>
  );
}

/**
 * An Episode's native audio player and who is speaking. Nothing plays until the visitor presses
 * play (`preload="none"`), the page has one player, and the transcript below doesn't depend on it.
 */
function EpisodePlayer({ title, episode }: { title: string; episode: NonNullable<PublicArticle["episode"]> }) {
  return (
    <section className="episode" aria-labelledby="listen-heading">
      <h2 id="listen-heading">Listen</h2>
      {/* biome-ignore lint/a11y/useMediaCaption: audio-only; its alternative is the full transcript on this page (WCAG 1.2.1). */}
      <audio controls preload="none" className="episode-player" aria-label={`Audio of ${title}`}>
        <source src={episode.audioPath} type={episode.audioType} />
        <a href={episode.audioPath}>Open the audio</a>
      </audio>
      <p>
        <a href="#transcript">Read the transcript</a>
      </p>
      <dl>
        <dt>Host</dt>
        <dd>{episode.host}</dd>
        {episode.guests.length > 0 && (
          <>
            <dt>{episode.guests.length === 1 ? "Guest" : "Guests"}</dt>
            <dd>{episode.guests.join(", ")}</dd>
          </>
        )}
        {episode.music.length > 0 && (
          <>
            <dt>Music</dt>
            <dd>{episode.music.join("; ")}</dd>
          </>
        )}
        {episode.archiveClips.length > 0 && (
          <>
            <dt>Archive</dt>
            <dd>{episode.archiveClips.join("; ")}</dd>
          </>
        )}
        <dt>Recorded</dt>
        <dd>
          <DateMark date={episode.recordedOn} />
        </dd>
        <dt>Length</dt>
        <dd>
          <time dateTime={episode.isoDuration}>{episode.duration}</time>
        </dd>
      </dl>
      {episode.distribution.length > 0 && (
        <>
          <h3>Also available on</h3>
          <ul className="distribution">
            {episode.distribution.map((link, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the links are in the order the editor saved them.
              <li key={index}>
                <a href={link.url} rel="external noopener noreferrer">
                  {link.label}
                </a>
                {` (${link.host}, another website)`}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * A Creator Profile's portrait (consented, with its own Rights Record), where they are at a level
 * that can't find their door, what they make, and their free sample (CRE-01).
 */
function CreatorDetails({ creator }: { creator: NonNullable<PublicArticle["creator"]> }) {
  return (
    <section className="creator" aria-labelledby="creator-heading">
      <h2 id="creator-heading" className="visually-hidden">
        About the creator
      </h2>
      <img
        className="portrait"
        src={creator.portrait.src}
        srcSet={creator.portrait.srcSet}
        sizes="(min-width: 40rem) 16rem, 60vw"
        alt={creator.portrait.alt}
      />
      <dl>
        <dt>Based in</dt>
        <dd>{creator.location}</dd>
        {creator.languages.length > 0 && (
          <>
            <dt>Languages</dt>
            <dd>{creator.languages.join(", ")}</dd>
          </>
        )}
        <dt>Works in</dt>
        <dd>{creator.mediaTypes.join(", ")}</dd>
      </dl>
      {creator.sample && (
        <div className="sample">
          <h3>A free sample of their work</h3>
          <p>
            <Link to={creator.sample.path}>{creator.sample.title}</Link>
            {` · ${creator.sample.typeName}`}
          </p>
          <p>{creator.sample.summary}</p>
        </div>
      )}
    </section>
  );
}

/** The full transcript, always on the page: the Episode can be read without the player (A11Y-03). */
function Transcript({ paragraphs }: { paragraphs: NonNullable<PublicArticle["episode"]>["transcript"] }) {
  return (
    <section id="transcript" className="transcript" aria-labelledby="transcript-heading">
      <h2 id="transcript-heading">Transcript</h2>
      <TranscriptParagraphs paragraphs={paragraphs} />
    </section>
  );
}

/** What a visitor reads before downloading a Resource or following its link (resource behaviour). */
function ResourceDetails({ id, resource }: { id: string; resource: NonNullable<PublicArticle["resource"]> }) {
  return (
    <section className="resource-details" aria-labelledby="resource-heading">
      <h2 id="resource-heading">{resource.kind === "file" ? "Before you download" : "Before you go"}</h2>
      <dl>
        {resource.kind === "file" ? (
          <>
            <dt>File</dt>
            <dd>{`${resource.fileType}, ${resource.size}`}</dd>
          </>
        ) : (
          <>
            <dt>Goes to</dt>
            <dd>{`${resource.host}, another website`}</dd>
            <dt>Link last checked</dt>
            <dd>
              <DateMark date={resource.checkedOn} />
            </dd>
          </>
        )}
        <dt>Language</dt>
        <dd>{resource.language}</dd>
        <dt>Suitable for</dt>
        <dd>{resource.ageGuidance}</dd>
        <dt>Accessibility</dt>
        <dd>{resource.accessibility || "Not described yet."}</dd>
        <dt>You may</dt>
        <dd>{resource.usageTerms}</dd>
      </dl>
      {resource.kind === "file" ? (
        <p>
          <a className="primary-link" href={resource.downloadPath}>
            {`Download (${resource.fileType}, ${resource.size})`}
          </a>
        </p>
      ) : (
        <>
          <p>
            <a className="primary-link" href={resource.url} rel="external noopener noreferrer">
              {`Go to ${resource.host}`}
            </a>
          </p>
          <form method="post" action={`/resources/${id}/report-link`} className="report-link">
            <button type="submit">Report a broken link</button>
          </form>
        </>
      )}
    </section>
  );
}
