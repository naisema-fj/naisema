import type { ArticleSnapshot } from "~/lib/article-fields";
import { distributionText, episodeSpeakers, formatDuration, transcriptParagraphs } from "~/lib/episode-fields";
import { AGE_GUIDANCE } from "~/lib/resource-fields";
import { TranscriptParagraphs } from "./transcript-paragraphs";

const MISSING_FILE = "A file no longer in the media library";

/**
 * What a Resource or an Episode adds to a Revision, as its reviewers see it: everything a visitor
 * would rely on, so the review covers it. `fileName` names the media library file it uses.
 */
export function RevisionTypeDetails({
  snapshot,
  fileName,
  audioPath,
}: {
  snapshot: ArticleSnapshot;
  fileName: string | null;
  audioPath: string;
}) {
  const { resource, episode } = snapshot;
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
      {/* biome-ignore lint/a11y/useMediaCaption: audio-only; its alternative is the transcript below (WCAG 1.2.1). */}
      <audio controls preload="none" src={audioPath} aria-label="Audio of this revision" />
      <dl>
        <dt>Audio file</dt>
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
