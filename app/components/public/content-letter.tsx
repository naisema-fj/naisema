import {
  ArrowRight,
  Calendar,
  Download,
  ExternalLink,
  Flag,
  GraduationCap,
  Headphones,
  Languages,
  Tags,
  User,
} from "lucide-react";
import { Link } from "react-router";
import { ArticleBodyView } from "~/components/article-body-view";
import { AREA_ICONS, Icon, KIND_ICONS, labelIcon } from "~/components/icons";
import { BackLink, PageHead } from "~/components/public/parts";
import { DateMark, Postmarks } from "~/components/public/postmarks";
import { TranscriptParagraphs } from "~/components/transcript-paragraphs";
import { WhatsThis } from "~/components/whats-this";
import type { PublicView } from "~/lib/public-view.server";
import { meaningsOfLabels } from "~/lib/review-label-help";

/**
 * A published item as a letter: who it is from, when, what it was reviewed for (only the Review
 * Labels its approvals generate), what its kind adds, the body, and its Topics. Server-rendered,
 * with no client JavaScript: audio and video use the browser's own players.
 */
export function ContentLetter({ item }: { item: PublicView }) {
  const name = item.kindName.toLowerCase();
  const KindIcon = KIND_ICONS[item.kind];
  return (
    <article className="pane">
      {item.area && <BackLink to={`/${item.area}`}>{`Back to ${item.areaName}`}</BackLink>}
      <header className="pane-intro">
        <PageHead tone={item.area ?? "none"} icon={item.area ? AREA_ICONS[item.area] : KindIcon} title={item.title} />
        {item.summary && <p className="lede">{item.summary}</p>}
        <Postmarks label={`About this ${name}`}>
          {item.credit && (
            <li>
              <span className="fact-seat">
                <Icon icon={User} size={18} />
              </span>
              <span>
                <span className="fact-name">From</span> {item.credit}
              </span>
            </li>
          )}
          <li>
            <span className="fact-seat">
              <Icon icon={KindIcon} size={18} />
            </span>
            {item.kindName}
          </li>
          {item.publishedAt && (
            <li>
              <span className="fact-seat">
                <Icon icon={Calendar} size={18} />
              </span>
              <DateMark label="Published" date={item.publishedAt} />
            </li>
          )}
        </Postmarks>
      </header>

      {item.kind !== "page" && (
        <section className="review-labels" aria-labelledby="reviewed-heading">
          <h2 id="reviewed-heading">What this was reviewed for</h2>
          {item.labels.length ? (
            <ul className="label-lines" aria-label="Review Labels">
              {item.labels.map((label) => (
                <li key={label}>
                  <span className="seat seat-small">
                    <Icon icon={labelIcon(label)} />
                  </span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-review">{`This ${name} has no Review Labels.`}</p>
          )}
          <WhatsThis summary="What do these labels mean?">
            <p>Labels say exactly what a person checked for the version you're reading, and nothing more.</p>
            {meaningsOfLabels(item.labels).length > 0 && (
              <ul>
                {meaningsOfLabels(item.labels).map((label) => (
                  <li key={label.name}>
                    <strong>{label.name}:</strong> {label.meaning}
                  </li>
                ))}
              </ul>
            )}
            <p>If a label isn't here, that kind of review hasn't happened.</p>
          </WhatsThis>
        </section>
      )}

      {item.cover && (
        <img
          className="cover"
          src={item.cover.src}
          srcSet={item.cover.srcSet}
          sizes="(min-width: 48rem) 48rem, 100vw"
          alt={item.cover.alt}
        />
      )}
      {item.resource && <ResourceDetails resource={item.resource} />}
      {item.video && <StoryVideo title={item.title} video={item.video} />}
      {item.episode && <EpisodePlayer title={item.title} episode={item.episode} />}
      {item.creator && <CreatorDetails creator={item.creator} />}
      {item.provider && <ProviderDetails provider={item.provider} />}

      <div className="pane-body">
        <ArticleBodyView body={item.body} embeds={item.embeds} />
      </div>

      {item.episode && item.episode.transcript.length > 0 && (
        <section id="transcript" className="transcript" aria-labelledby="transcript-heading">
          <h2 id="transcript-heading">Transcript</h2>
          <TranscriptParagraphs paragraphs={item.episode.transcript} />
        </section>
      )}

      <footer className="pane-foot">
        {item.topics.length > 0 && (
          <p className="topic-line">
            <Icon icon={Tags} />
            <span>
              <span className="fact-name">Topics</span>{" "}
              {item.topics.map((topic, index) => (
                <span key={topic.slug}>
                  {index > 0 && ", "}
                  <Link reloadDocument to={`/topics/${topic.slug}`}>
                    {topic.name}
                  </Link>
                </span>
              ))}
            </span>
          </p>
        )}
        <div className="foot-row">
          {item.area && (
            <Link reloadDocument to={`/${item.area}`} className="button button-soft">
              More from {item.areaName}
              <Icon icon={ArrowRight} size={18} />
            </Link>
          )}
          <p className="report-problem">
            <Link reloadDocument to={`/forms/report?about=${encodeURIComponent(item.path)}`}>
              <Icon icon={Flag} size={18} />
              Report a problem with this {name}
            </Link>
          </p>
        </div>
      </footer>
    </article>
  );
}

/** A Video's footage in its own shape, and the way into its Learning Layer. Nothing plays until pressed. */
function StoryVideo({ title, video }: { title: string; video: NonNullable<PublicView["video"]> }) {
  return (
    <section className="story-video" aria-labelledby="watch-heading">
      <h2 id="watch-heading" className="visually-hidden">
        Watch
      </h2>
      <div className={`video-frame video-${video.orientation}`}>
        {/* biome-ignore lint/a11y/useMediaCaption: captions come with its Learning Layer's player, linked below, which has a full transcript. */}
        <video
          controls
          preload="none"
          playsInline
          poster={video.poster ?? undefined}
          className="public-video"
          aria-label={title}
          width={video.width}
          height={video.height}
        >
          <source src={video.src} type={video.type} />
        </video>
      </div>
      {video.layer && (
        <section aria-labelledby="explore-heading" className="explore-language">
          <span className="seat seat-medium">
            <Icon icon={Languages} size={28} />
          </span>
          <div className="explore-text">
            <h3 id="explore-heading">Explore the language</h3>
            <p>
              <Link to={video.layer.path} reloadDocument className="explore-link">
                {video.layer.title}
              </Link>
              : Fijian captions, a transcript, word meanings and practice.
            </p>
            <p className="explore-level">
              <Icon icon={GraduationCap} size={16} />
              {video.layer.level}
            </p>
          </div>
          <Icon icon={ArrowRight} className="explore-arrow" />
        </section>
      )}
    </section>
  );
}

/** An Episode's audio, who is speaking, and where else it can be heard. The transcript follows the body. */
function EpisodePlayer({ title, episode }: { title: string; episode: NonNullable<PublicView["episode"]> }) {
  return (
    <section className="episode" aria-labelledby="listen-heading">
      <h2 id="listen-heading">
        <Icon icon={Headphones} />
        Listen
      </h2>
      {episode.audioPath ? (
        // biome-ignore lint/a11y/useMediaCaption: audio-only; its alternative is the full transcript on this page (WCAG 1.2.1).
        <audio controls preload="none" className="episode-player" aria-label={`Audio of ${title}`}>
          <source src={episode.audioPath} type={episode.audioType} />
          <a href={episode.audioPath}>Open the audio</a>
        </audio>
      ) : (
        <p>The recording can't be played right now.</p>
      )}
      <p>
        <a href="#transcript">Read the transcript</a>
      </p>
      {episode.guests && (
        <dl>
          <dt>Host and guests</dt>
          <dd>{episode.guests}</dd>
        </dl>
      )}
      {episode.links.length > 0 && (
        <>
          <h3>Also available on</h3>
          <ul className="distribution">
            {episode.links.map((link) => (
              <li key={link.url}>
                <a href={link.url} rel="external noopener noreferrer">
                  {link.host}
                </a>
                {" (another website)"}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function CreatorDetails({ creator }: { creator: NonNullable<PublicView["creator"]> }) {
  return (
    <section className="creator" aria-labelledby="creator-heading">
      <h2 id="creator-heading" className="visually-hidden">
        About the creator
      </h2>
      {creator.portrait && (
        <img
          className="portrait"
          src={creator.portrait.src}
          srcSet={creator.portrait.srcSet}
          sizes="(min-width: 40rem) 16rem, 60vw"
          alt={creator.portrait.alt}
        />
      )}
      {creator.sample && (
        <div className="sample">
          <h3>A free sample of their work</h3>
          <p>
            <Link reloadDocument to={creator.sample.path}>
              {creator.sample.title}
            </Link>
            {` · ${creator.sample.kindName}`}
          </p>
          <p>{creator.sample.summary}</p>
        </div>
      )}
      {creator.links.length > 0 && (
        <ul className="distribution">
          {creator.links.map((link) => (
            <li key={link.url}>
              <a href={link.url} rel="external noopener noreferrer">
                {link.host}
              </a>
              {" (another website)"}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProviderDetails({ provider }: { provider: NonNullable<PublicView["provider"]> }) {
  return (
    <section className="resource-details" aria-labelledby="provider-heading">
      <h2 id="provider-heading">What they offer</h2>
      {provider.offerings.length > 0 && (
        <ul>
          {provider.offerings.map((offering) => (
            <li key={offering}>{offering}</li>
          ))}
        </ul>
      )}
      <dl>
        <dt>Where</dt>
        <dd>{provider.location}</dd>
        {provider.contact && (
          <>
            <dt>Getting in touch</dt>
            <dd>{provider.contact}</dd>
          </>
        )}
      </dl>
      {provider.website && (
        <p>
          <a className="button" href={provider.website.href} rel="external noopener noreferrer">
            <Icon icon={ExternalLink} size={18} />
            {`Go to ${provider.website.host}`}
          </a>{" "}
          (another website)
        </p>
      )}
    </section>
  );
}

/** What a visitor reads before downloading a Resource or following its link (resource behaviour). */
function ResourceDetails({ resource }: { resource: NonNullable<PublicView["resource"]> }) {
  return (
    <section className="resource-details" aria-labelledby="resource-heading">
      <h2 id="resource-heading">{resource.file ? "Before you download" : "Before you go"}</h2>
      <dl>
        {resource.file ? (
          <>
            <dt>File</dt>
            <dd>{`${resource.file.type}, ${resource.file.size}`}</dd>
          </>
        ) : (
          resource.url && (
            <>
              <dt>Goes to</dt>
              <dd>{`${resource.url.host}, another website`}</dd>
            </>
          )
        )}
        <dt>Language</dt>
        <dd>{resource.language}</dd>
        <dt>Suitable for</dt>
        <dd>{resource.ageGuidance}</dd>
        <dt>Accessibility</dt>
        <dd>{resource.accessibility}</dd>
        <dt>You may</dt>
        <dd>{resource.usageTerms}</dd>
      </dl>
      {resource.file ? (
        <p>
          <a className="button" href={resource.file.path}>
            <Icon icon={Download} size={18} />
            {`Download (${resource.file.type}, ${resource.file.size})`}
          </a>
        </p>
      ) : (
        resource.url && (
          <p>
            <a className="button" href={resource.url.href} rel="external noopener noreferrer">
              <Icon icon={ExternalLink} size={18} />
              {`Go to ${resource.url.host}`}
            </a>
          </p>
        )
      )}
    </section>
  );
}
