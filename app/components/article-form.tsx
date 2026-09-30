import { Form } from "react-router";
import { AREA_NAMES, PRIMARY_AREAS, type PrimaryArea } from "~/lib/areas";
import type { ArticleBody } from "~/lib/article-body";
import { ARTICLE_LIMITS, type ArticleSnapshot, type FieldErrors } from "~/lib/article-fields";
import { FLAG_NAMES } from "~/lib/review-names";
import { CONTENT_FLAGS } from "~/lib/review-rules";
import { BodyEditor, type EmbeddableItem } from "./body-editor";

type Props = {
  /** What the fields start with: the current revision, or what the editor just submitted. */
  values: ArticleSnapshot;
  errors?: FieldErrors;
  topics: { id: string; name: string }[];
  embeddable: EmbeddableItem[];
  /** New Articles choose their area; afterwards it is fixed, because it is part of the URL. */
  area: { choose: true } | { choose: false; current: PrimaryArea };
  /** The Revision this form was opened from, so a save can't silently replace a newer one. */
  baseRevisionId?: string;
  submitLabel: string;
};

export function ArticleForm({ values, errors = {}, topics, embeddable, area, baseRevisionId, submitLabel }: Props) {
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
        <p role="alert">This article wasn't saved. Fix the fields marked below and save again.</p>
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

      {area.choose ? (
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
      ) : (
        <p>
          Primary area: <strong>{AREA_NAMES[area.current]}</strong>
        </p>
      )}

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

      <BodyEditor initial={values.body as ArticleBody} embeddable={embeddable} error={errors.body} />

      <button type="submit">{submitLabel}</button>
    </Form>
  );
}
