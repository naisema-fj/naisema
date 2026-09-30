import { Form } from "react-router";
import { AREA_NAMES, PRIMARY_AREAS, type PrimaryArea } from "~/lib/areas";
import type { ArticleBody } from "~/lib/article-body";
import type { ArticleSnapshot, FieldErrors } from "~/lib/articles.server";
import { BodyEditor, type EmbeddableItem } from "./body-editor";

type Props = {
  /** What the fields start with: the current draft, or what the editor just submitted. */
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
        maxLength={200}
        aria-describedby={describedBy("title")}
      />
      {fieldError("title")}

      <label htmlFor="summary">Summary</label>
      <textarea
        id="summary"
        name="summary"
        defaultValue={values.summary}
        required
        maxLength={500}
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
        maxLength={300}
        aria-describedby={describedBy("credit")}
      />
      {fieldError("credit")}

      <BodyEditor initial={values.body as ArticleBody} embeddable={embeddable} error={errors.body} />

      <button type="submit">{submitLabel}</button>
    </Form>
  );
}
