import type { ReactNode } from "react";
import type { ArticleSnapshot } from "~/lib/article-fields";
import { MEDIA_TYPES } from "~/lib/creator-fields";
import { distributionText, episodeSpeakers, formatDuration, transcriptParagraphs } from "~/lib/episode-fields";
import { AGE_GUIDANCE } from "~/lib/resource-fields";
import { TranscriptParagraphs } from "./transcript-paragraphs";

const MISSING_FILE = "A file no longer in the media library";

/**
 * What a Resource, Episode, Creator Profile or Video adds to a Revision, as its reviewers see it: everything a visitor
 * would rely on, so the review covers it. `fileName` names the media library file it uses.
 */
export function RevisionTypeDetails({
  snapshot,
  fileName,
  audioPath,
  sampleTitle = null,
  player,
}: {
  snapshot: ArticleSnapshot;
  fileName: string | null;
  /** Where an audio Episode's recording plays from; null where it may not be played. */
  audioPath: string | null;
  /** A Creator Profile's free sample, by its current title. */
  sampleTitle?: string | null;
  /**
   * The video player for a Video or a video Episode, where the page plays footage itself (a Review
   * Link): the element to show, or null where the footage may not be played. Left out on the staff
   * page, which has the media library's video page instead.
   */
  player?: ReactNode | null;
}) {
  const { resource, episode, creator, video } = snapshot;
  if (video) {
    return (
      <section aria-labelledby="type-details-heading">
        <h2 id="type-details-heading">Video</h2>
        <dl>
          <dt>Footage</dt>
          <dd>{fileName ?? MISSING_FILE}</dd>
        </dl>
        {player !== undefined &&
          (player ?? <p>The video can't be played right now. Everything else here is as it will be reviewed.</p>)}
      </section>
    );
  }
  if (creator) {
    return (
      <section aria-labelledby="type-details-heading">
        <h2 id="type-details-heading">Creator Profile</h2>
        <dl>
          <dt>Portrait</dt>
          <dd>{fileName ?? MISSING_FILE}</dd>
          <dt>Based in</dt>
          <dd>{creator.location}</dd>
          <dt>Languages</dt>
          <dd>{creator.languages.join(", ") || "None given"}</dd>
          <dt>Works in</dt>
          <dd>{creator.mediaTypes.map((type) => MEDIA_TYPES[type]).join(", ")}</dd>
          <dt>Free sample</dt>
          <dd>{sampleTitle ?? "An item that no longer exists"}</dd>
        </dl>
      </section>
    );
  }
  if (resource) {
    const { source } = resource;
    return (
      <section aria-labelledby="type-details-heading">
        <h2 id="type-details-heading">Resource</h2>
        <dl>
          {source.kind === "file" ? (
            <>
              <dt>File</dt>
              <dd>{fileName ?? MISSING_FILE}</dd>
            </>
          ) : (
            <>
              <dt>Link</dt>
              <dd>{source.url}</dd>
              <dt>Last checked</dt>
              <dd>{source.checkedOn}</dd>
            </>
          )}
          <dt>Language</dt>
          <dd>{resource.language}</dd>
          <dt>Suitable for</dt>
          <dd>{AGE_GUIDANCE[resource.ageGuidance]}</dd>
          <dt>Accessibility</dt>
          <dd>{resource.accessibility || "Not described"}</dd>
          <dt>Usage terms</dt>
          <dd>{resource.usageTerms}</dd>
        </dl>
      </section>
    );
  }
  if (!episode) return null;
  const transcript = transcriptParagraphs(episode.transcript, episodeSpeakers(episode));
  return (
    <section aria-labelledby="type-details-heading">
      <h2 id="type-details-heading">Episode</h2>
      {episode.videoAssetId ? (
        player !== undefined ? (
          (player ?? <p>The video can't be played right now. The transcript below is as it will be reviewed.</p>)
        ) : (
          <p>
            A video Episode: <a href={`/admin/media/${episode.videoAssetId}/video`}>watch its video</a> in the media
            library.
          </p>
        )
      ) : audioPath ? (
        // biome-ignore lint/a11y/useMediaCaption: audio-only; its alternative is the transcript below (WCAG 1.2.1).
        <audio controls preload="none" src={audioPath} aria-label="Audio of this revision" />
      ) : (
        <p>The recording can't be played right now. The transcript below is as it will be reviewed.</p>
      )}
      <dl>
        <dt>{episode.videoAssetId ? "Video file" : "Audio file"}</dt>
        <dd>{fileName ?? MISSING_FILE}</dd>
        <dt>Host</dt>
        <dd>{episode.host}</dd>
        <dt>Guests</dt>
        <dd>{episode.guests.join(", ") || "None"}</dd>
        <dt>Music</dt>
        <dd>{episode.music?.join("; ") || "None"}</dd>
        <dt>Archive clips</dt>
        <dd>{episode.archiveClips?.join("; ") || "None"}</dd>
        <dt>Recorded on</dt>
        <dd>{episode.recordedOn}</dd>
        <dt>Length</dt>
        <dd>{formatDuration(episode.durationSeconds)}</dd>
        <dt>Also available on</dt>
        <dd>{episode.distribution.length ? distributionText(episode.distribution) : "Nowhere else"}</dd>
      </dl>
      <h3>Transcript</h3>
      {transcript.length ? (
        <TranscriptParagraphs paragraphs={transcript} />
      ) : (
        <p>No transcript yet. It is needed before publishing.</p>
      )}
    </section>
  );
}
