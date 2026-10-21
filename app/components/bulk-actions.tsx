import { BULK_KIND_NAMES, BULK_REASON_LIMIT, type BulkKind } from "~/lib/bulk-actions";
import type { ReviewerChoices } from "~/lib/bulk-actions.server";

/** The checkbox that chooses one item for a bulk action; its label names the item. */
export function BulkChoice({ prefix, id, title }: { prefix: string; id: string; title: string }) {
  const inputId = `${prefix}-${id}`;
  return (
    <>
      <input type="checkbox" name="id" value={id} id={inputId} />
      <label htmlFor={inputId} className="visually-hidden">
        Choose {title}
      </label>
    </>
  );
}

/**
 * What can be done with the items chosen above it, inside the one form that holds the checkboxes
 * (BO-07). It posts without JavaScript to the result page. Publishing is not offered: each
 * revision is published on its own page, after its own eligibility check.
 */
export function BulkActions({
  kind,
  prefix,
  reviewers,
}: {
  kind: BulkKind;
  prefix: string;
  reviewers: ReviewerChoices;
}) {
  const noun = BULK_KIND_NAMES[kind].many;
  return (
    <fieldset className="bulk-actions" id={`${prefix}-actions`}>
      <legend>Do something with the {noun} you chose</legend>
      <input type="hidden" name="kind" value={kind} />
      <p id={`${prefix}-hint`} className="hint">
        Each one is checked on its own. Any that can't take the action are skipped, and the next page says why.
        Publishing is done one revision at a time, on its own page.
      </p>
      <fieldset>
        <legend>Assign a reviewer</legend>
        {reviewers.length ? (
          <>
            <label htmlFor={`${prefix}-reviewer`}>Reviewer</label>
            <select id={`${prefix}-reviewer`} name="reviewer" aria-describedby={`${prefix}-hint`}>
              <option value="">Choose a reviewer</option>
              {reviewers.map((group) => (
                <optgroup key={group.reviewType} label={group.name}>
                  {group.people.map((person) => (
                    <option key={person.id} value={`${group.reviewType}:${person.id}`}>
                      {person.email}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button type="submit" name="intent" value="assign">
              Assign to the {noun} I chose
            </button>
          </>
        ) : (
          <p>No reviewers have been set up yet.</p>
        )}
      </fieldset>
      <fieldset>
        <legend>Withdraw or archive</legend>
        <label htmlFor={`${prefix}-reason`}>Why (required, kept in the audit log for each one)</label>
        <input
          id={`${prefix}-reason`}
          name="reason"
          maxLength={BULK_REASON_LIMIT}
          aria-describedby={`${prefix}-hint`}
        />
        <button type="submit" name="intent" value="withdraw">
          Withdraw the {noun} I chose
        </button>
        <button type="submit" name="intent" value="archive">
          Archive the {noun} I chose
        </button>
      </fieldset>
    </fieldset>
  );
}
