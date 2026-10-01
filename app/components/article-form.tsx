import { Form } from "react-router";
import { AREA_NAMES, PRIMARY_AREAS, type PrimaryArea } from "~/lib/areas";
import type { ArticleBody } from "~/lib/article-body";
import { ARTICLE_LIMITS, type ArticleSnapshot, type FieldErrors } from "~/lib/article-fields";
import { CONTENT_TYPE_NAMES, type ContentType } from "~/lib/content-types";
import { EPISODE_LIMITS } from "~/lib/episode-fields";
import { AGE_GUIDANCE, RESOURCE_LIMITS } from "~/lib/resource-fields";
import { FLAG_NAMES } from "~/lib/review-names";
import { CONTENT_FLAGS } from "~/lib/review-rules";
import { BodyEditor, type EmbeddableItem } from "./body-editor";

type Props = {
  type: ContentType;
  /** What the fields start with: the current revision, or what the editor just submitted. */
  values: ArticleSnapshot;
  errors?: FieldErrors;
  topics: { id: string; name: string }[];
  embeddable: EmbeddableItem[];
  /**
   * New items choose their area (a new Page chooses which site page it is); afterwards it is
   * fixed, because it is part of the URL.
   */
  area:
    | { choose: true }
    | { choose: "page"; pages: { path: string; title: string }[] }
    | { choose: false; current: PrimaryArea | null };
  /** Media library files a Resource can offer for download. */
  files?: { id: string; name: string; typeName: string }[];
  /** Media library audio an Episode can play. */
  audio?: { id: string; name: string; typeName: string }[];
  /** The Revision this form was opened from, so a save can't silently replace a newer one. */
  baseRevisionId?: string;
  submitLabel: string;
};

export function ArticleForm({
  type,
  values,
  errors = {},
  topics,
  embeddable,
  area,
  files = [],
  audio = [],
  baseRevisionId,
  submitLabel,
}: Props) {
  const resource = values.resource;
  const source = resource?.source;
  const episode = values.episode;
  // Room for every saved distribution link, and at least two empty rows to add one.
  const linkRows = [
    ...(episode?.distribution ?? []),
    ...Array.from({ length: EPISODE_LIMITS.distribution }, () => ({ label: "", url: "" })),
  ].slice(0, Math.max(EPISODE_LIMITS.distribution, (episode?.distribution.length ?? 0) + 2));
  const describedBy = (field: keyof FieldErrors) => (errors[field] ? `${field}-error` : undefined);
  const fieldError = (field: keyof FieldErrors) =>
    errors[field] && (
      <p id={`${field}-error`} className="field-error">
        {errors[field]}
      </p>
    );

  return (
    <Form method="post" className="article-form">
      {Object.keys(errors).length > 0 && (
        <p role="alert">
          This {CONTENT_TYPE_NAMES[type].toLowerCase()} wasn't saved. Fix the fields marked below and save again.
        </p>
      )}
      {baseRevisionId && <input type="hidden" name="baseRevisionId" value={baseRevisionId} />}

      <label htmlFor="title">Title</label>
      <input
        id="title"
        name="title"
        defaultValue={values.title}
        required
        maxLength={ARTICLE_LIMITS.title}
        aria-describedby={describedBy("title")}
      />
      {fieldError("title")}

      <label htmlFor="summary">Summary</label>
      <textarea
        id="summary"
        name="summary"
        defaultValue={values.summary}
        required
        maxLength={ARTICLE_LIMITS.summary}
        rows={3}
        aria-describedby={describedBy("summary")}
      />
      {fieldError("summary")}

      {area.choose === "page" ? (
        <>
          <label htmlFor="page">Which page</label>
          <select id="page" name="page" required aria-describedby={describedBy("page")}>
            {area.pages.map((page) => (
              <option key={page.path} value={page.path}>
                {page.title} (/{page.path})
              </option>
            ))}
          </select>
          {fieldError("page")}
        </>
      ) : area.choose ? (
        <>
          <label htmlFor="primaryArea">Primary area</label>
          <select
            id="primaryArea"
            name="primaryArea"
            defaultValue="ezine"
            required
            aria-describedby={describedBy("primaryArea")}
          >
            {PRIMARY_AREAS.map((option) => (
              <option key={option} value={option}>
                {AREA_NAMES[option]}
              </option>
            ))}
          </select>
          {fieldError("primaryArea")}
        </>
      ) : area.current ? (
        <p>
          Primary area: <strong>{AREA_NAMES[area.current]}</strong>
        </p>
      ) : null}

      {type !== "page" && (
        <fieldset aria-describedby={describedBy("topicIds")}>
          <legend>Topics</legend>
          {topics.length === 0 && (
            <p>
              There are no topics yet. <a href="/admin/topics">Add a topic</a> first.
            </p>
          )}
          {topics.map((topic) => (
            <div key={topic.id} className="choice">
              <input
                type="checkbox"
                id={`topic-${topic.id}`}
                name="topicId"
                value={topic.id}
                defaultChecked={values.topicIds.includes(topic.id)}
              />
              <label htmlFor={`topic-${topic.id}`}>{topic.name}</label>
            </div>
          ))}
          {fieldError("topicIds")}
        </fieldset>
      )}

      <label htmlFor="credit">Credit</label>
      <input
        id="credit"
        name="credit"
        defaultValue={values.credit}
        required
        maxLength={ARTICLE_LIMITS.credit}
        aria-describedby={describedBy("credit")}
      />
      {fieldError("credit")}

      <fieldset aria-describedby="flags-hint">
        <legend>Content Flags</legend>
        <p id="flags-hint">Flags decide which reviews this revision needs before it can be published.</p>
        {CONTENT_FLAGS.map((flag) => (
          <div key={flag} className="choice">
            <input
              type="checkbox"
              id={`flag-${flag}`}
              name="flag"
              value={flag}
              defaultChecked={(values.flags ?? []).includes(flag)}
            />
            <label htmlFor={`flag-${flag}`}>{FLAG_NAMES[flag]}</label>
          </div>
        ))}
        <label htmlFor="languageVariety">Language Variety (for language instruction)</label>
        <input
          id="languageVariety"
          name="languageVariety"
          defaultValue={values.languageVariety ?? ""}
          placeholder="standard-fijian"
          aria-describedby={describedBy("languageVariety")}
        />
        {fieldError("languageVariety")}
        <label htmlFor="sources">Sources (for historical claims)</label>
        <textarea
          id="sources"
          name="sources"
          defaultValue={values.sources ?? ""}
          rows={3}
          maxLength={ARTICLE_LIMITS.sources}
          aria-describedby={describedBy("sources")}
        />
        {fieldError("sources")}
      </fieldset>

      {type === "resource" && (
        <fieldset aria-describedby="resource-hint">
          <legend>The resource</legend>
          <p id="resource-hint">Visitors see all of this before they download the file or follow the link.</p>
          <fieldset aria-describedby={describedBy("resourceKind")}>
            <legend>File or link</legend>
            <div className="choice">
              <input
                type="radio"
                id="resource-kind-file"
                name="resourceKind"
                value="file"
                defaultChecked={source?.kind !== "link"}
              />
              <label htmlFor="resource-kind-file">A file from the media library</label>
            </div>
            <div className="choice">
              <input
                type="radio"
                id="resource-kind-link"
                name="resourceKind"
                value="link"
                defaultChecked={source?.kind === "link"}
              />
              <label htmlFor="resource-kind-link">A link to another site</label>
            </div>
            {fieldError("resourceKind")}
          </fieldset>
          <label htmlFor="resourceAssetId">File (for a file)</label>
          <select
            id="resourceAssetId"
            name="resourceAssetId"
            defaultValue={source?.kind === "file" ? source.assetId : ""}
            aria-describedby={describedBy("resourceAssetId")}
          >
            <option value="">Choose a file</option>
            {files.map((file) => (
              <option key={file.id} value={file.id}>
                {file.name} ({file.typeName})
              </option>
            ))}
          </select>
          {fieldError("resourceAssetId")}
          <label htmlFor="resourceUrl">Web address (for a link)</label>
          <input
            id="resourceUrl"
            name="resourceUrl"
            type="url"
            placeholder="https://"
            maxLength={RESOURCE_LIMITS.url}
            defaultValue={source?.kind === "link" ? source.url : ""}
            aria-describedby={describedBy("resourceUrl")}
          />
          {fieldError("resourceUrl")}
          <label htmlFor="resourceCheckedOn">Link last checked on (for a link)</label>
          <input
            id="resourceCheckedOn"
            name="resourceCheckedOn"
            type="date"
            defaultValue={source?.kind === "link" ? source.checkedOn : ""}
            aria-describedby={describedBy("resourceCheckedOn")}
          />
          {fieldError("resourceCheckedOn")}
          <label htmlFor="resourceLanguage">Language</label>
          <input
            id="resourceLanguage"
            name="resourceLanguage"
            placeholder="Standard Fijian and English"
            maxLength={RESOURCE_LIMITS.language}
            defaultValue={resource?.language ?? ""}
            aria-describedby={describedBy("resourceLanguage")}
          />
          {fieldError("resourceLanguage")}
          <label htmlFor="resourceAgeGuidance">Suitable for</label>
          <select
            id="resourceAgeGuidance"
            name="resourceAgeGuidance"
            defaultValue={resource?.ageGuidance ?? ""}
            aria-describedby={describedBy("resourceAgeGuidance")}
          >
            <option value="">Choose</option>
            {Object.entries(AGE_GUIDANCE).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
          {fieldError("resourceAgeGuidance")}
          <label htmlFor="resourceAccessibility">Accessibility features</label>
          <textarea
            id="resourceAccessibility"
            name="resourceAccessibility"
            rows={2}
            placeholder="Tagged PDF with headings; large print available."
            maxLength={RESOURCE_LIMITS.accessibility}
            defaultValue={resource?.accessibility ?? ""}
            aria-describedby={describedBy("resourceAccessibility")}
          />
          {fieldError("resourceAccessibility")}
          <label htmlFor="resourceUsageTerms">What visitors may do with it</label>
          <textarea
            id="resourceUsageTerms"
            name="resourceUsageTerms"
            rows={2}
            placeholder="Free to print and share for teaching. Not for sale."
            maxLength={RESOURCE_LIMITS.usageTerms}
            defaultValue={resource?.usageTerms ?? ""}
            aria-describedby={describedBy("resourceUsageTerms")}
          />
          {fieldError("resourceUsageTerms")}
        </fieldset>
      )}

      {type === "episode" && (
        <fieldset>
          <legend>Episode</legend>
          <label htmlFor="episodeAudioAssetId">Audio</label>
          <select
            id="episodeAudioAssetId"
            name="episodeAudioAssetId"
            defaultValue={episode?.audioAssetId ?? ""}
            aria-describedby={describedBy("episodeAudioAssetId")}
          >
            <option value="">Choose the audio</option>
            {audio.map((file) => (
              <option key={file.id} value={file.id}>
                {file.name} ({file.typeName})
              </option>
            ))}
          </select>
          {fieldError("episodeAudioAssetId")}
          <label htmlFor="episodeHost">Host</label>
          <input
            id="episodeHost"
            name="episodeHost"
            maxLength={EPISODE_LIMITS.name}
            defaultValue={episode?.host ?? ""}
            aria-describedby={describedBy("episodeHost")}
          />
          {fieldError("episodeHost")}
          <label htmlFor="episodeGuests">Guests, one per line</label>
          <textarea
            id="episodeGuests"
            name="episodeGuests"
            rows={3}
            defaultValue={episode?.guests.join("\n") ?? ""}
            aria-describedby={describedBy("episodeGuests")}
          />
          {fieldError("episodeGuests")}
          <label htmlFor="episodeRecordedOn">Recorded on</label>
          <input
            id="episodeRecordedOn"
            name="episodeRecordedOn"
            type="date"
            defaultValue={episode?.recordedOn ?? ""}
            aria-describedby={describedBy("episodeRecordedOn")}
          />
          {fieldError("episodeRecordedOn")}
          <label htmlFor="episodeDuration">Length, as minutes:seconds or hours:minutes:seconds</label>
          <input
            id="episodeDuration"
            name="episodeDuration"
            inputMode="numeric"
            placeholder="32:10"
            defaultValue={episode?.durationSeconds ? clock(episode.durationSeconds) : ""}
            aria-describedby={describedBy("episodeDuration")}
          />
          {fieldError("episodeDuration")}
          <fieldset aria-describedby={describedBy("episodeDistribution") ?? "distribution-hint"}>
            <legend>Also available on</legend>
            <p id="distribution-hint">Only places approved for distribution, such as a podcast app.</p>
            {linkRows.map((link, index) => (
              <div key={`link-${index.toString()}`}>
                <label htmlFor={`episodeLinkLabel-${index}`}>{`Name of place ${index + 1}`}</label>
                <input
                  id={`episodeLinkLabel-${index}`}
                  name="episodeLinkLabel"
                  maxLength={EPISODE_LIMITS.linkLabel}
                  defaultValue={link.label}
                />
                <label htmlFor={`episodeLinkUrl-${index}`}>{`Web address ${index + 1}`}</label>
                <input
                  id={`episodeLinkUrl-${index}`}
                  name="episodeLinkUrl"
                  type="url"
                  placeholder="https://"
                  maxLength={EPISODE_LIMITS.url}
                  defaultValue={link.url}
                />
              </div>
            ))}
            {fieldError("episodeDistribution")}
          </fieldset>
        </fieldset>
      )}

      <BodyEditor initial={values.body as ArticleBody} embeddable={embeddable} error={errors.body} />

      {type === "episode" && (
        <>
          <label htmlFor="episodeTranscript">Transcript</label>
          <p id="transcript-hint" className="hint">
            Needed before publishing, and reviewed for accessibility. Separate paragraphs with a blank line; start a
            paragraph with a name and a colon, like "Mere: Bula", to show who is speaking.
          </p>
          <textarea
            id="episodeTranscript"
            name="episodeTranscript"
            rows={16}
            maxLength={EPISODE_LIMITS.transcript}
            defaultValue={episode?.transcript ?? ""}
            aria-describedby={errors.episodeTranscript ? "transcript-hint episodeTranscript-error" : "transcript-hint"}
          />
          {fieldError("episodeTranscript")}
        </>
      )}

      <label htmlFor="relatedId">Related items (up to 6, in the order chosen)</label>
      <p id="related-hint" className="hint">
        Shown under this {CONTENT_TYPE_NAMES[type].toLowerCase()} on the public site, when they are published.
      </p>
      <select
        id="relatedId"
        name="relatedId"
        multiple
        size={Math.min(8, Math.max(3, embeddable.length))}
        defaultValue={values.relatedIds ?? []}
        aria-describedby={errors.relatedIds ? "related-hint relatedIds-error" : "related-hint"}
      >
        {embeddable.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
            {item.typeName ? ` (${item.typeName})` : ""}
          </option>
        ))}
      </select>
      {fieldError("relatedIds")}

      <button type="submit">{submitLabel}</button>
    </Form>
  );
}

/** Seconds as the form takes them back: "32:10", "1:05:00". */
function clock(seconds: number) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}` : `${minutes}:${pad(seconds % 60)}`;
}
