import type { ReactNode } from "react";
import { Form } from "react-router";
import type { RightsListEntry } from "~/lib/rights.server";
import { PERMITTED_USE_NAMES } from "~/lib/rights-names";
import type { RightsActionData } from "~/lib/rights-page.server";
import { formatDay, PERMITTED_USES, RIGHTS_PART_NAMES } from "~/lib/rights-rules";

const STATUS_NAMES = { current: "Current", expired: "Expired", withdrawn: "Withdrawn" } as const;

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * A subject's Rights Records and the form to record another, for a Content Item or a media library
 * file: what is recorded, its status, evidence and withdrawal. `intro` explains what the records
 * decide for this kind of subject.
 */
export function RightsRecords({
  intro,
  parts,
  records,
  contributors,
  done,
  actionData,
}: {
  intro: ReactNode;
  parts: { value: string; label: string }[];
  records: RightsListEntry[];
  contributors: { id: string; name: string }[];
  done: string | null;
  actionData: RightsActionData | undefined;
}) {
  const errors: Record<string, string> = actionData?.errors ?? {};
  const values = actionData?.values;
  const withdrawError = actionData?.withdraw;
  const fieldError = (field: string) =>
    errors[field] && (
      <p id={`${field}-error`} className="field-error">
        {errors[field]}
      </p>
    );
  const describedBy = (field: string) => (errors[field] ? `${field}-error` : undefined);

  return (
    <>
      {done === "recorded" && !actionData && <p role="status">Rights Record recorded.</p>}
      {done === "withdrawn" && !actionData && <p role="status">Rights Record withdrawn.</p>}
      {Object.keys(errors).length > 0 && <p role="alert">Nothing was saved. Fix the fields marked below.</p>}
      {withdrawError && !records.some((record) => record.id === withdrawError.recordId) && (
        <p role="alert">{withdrawError.error}</p>
      )}
      {intro}

      {records.length === 0 ? (
        <p>No Rights Records yet.</p>
      ) : (
        <ul className="rights-list">
          {records.map((record) => (
            <li key={record.id}>
              <h2>{`${record.rightsHolder}: ${STATUS_NAMES[record.status]}`}</h2>
              <dl>
                <dt>Covers</dt>
                <dd>
                  {record.part
                    ? `${capitalise(RIGHTS_PART_NAMES[record.part.kind])}: ${record.part.name}`
                    : "The whole item"}
                </dd>
                <dt>Permitted Uses</dt>
                <dd>{record.permittedUses.map((use) => PERMITTED_USE_NAMES[use]).join(", ")}</dd>
                {record.guardianPermission && (
                  <>
                    <dt>Guardian permission</dt>
                    <dd>Yes, for the identifiable children shown</dd>
                  </>
                )}
                {record.contributors.length > 0 && (
                  <>
                    <dt>Contributors</dt>
                    <dd>{record.contributors.join(", ")}</dd>
                  </>
                )}
                <dt>Expires</dt>
                <dd>{record.expiresAt ? formatDay(record.expiresAt) : "Never"}</dd>
                <dt>Recorded</dt>
                <dd>
                  {formatDay(record.createdAt)} by {record.recordedBy}
                </dd>
                <dt>Evidence</dt>
                <dd>
                  {record.evidenceStatus === "ready" ? (
                    <a href={`/admin/rights/${record.id}/evidence`}>Download {record.evidenceName}</a>
                  ) : record.evidenceStatus === "scanning" || record.evidenceStatus === "uploading" ? (
                    <>{record.evidenceName}: being scanned for viruses</>
                  ) : (
                    <>
                      {record.evidenceName}: refused. {record.evidenceReason} Record the permission again with a clean
                      copy.
                    </>
                  )}
                </dd>
                {record.withdrawnAt && (
                  <>
                    <dt>Withdrawn</dt>
                    <dd>
                      {formatDay(record.withdrawnAt)}: {record.withdrawalReason}
                    </dd>
                  </>
                )}
              </dl>
              {!record.withdrawnAt && (
                <Form method="post" className="inline-form">
                  <input type="hidden" name="intent" value="withdraw" />
                  <input type="hidden" name="recordId" value={record.id} />
                  <label htmlFor={`reason-${record.id}`}>Why is this permission withdrawn?</label>
                  <input
                    id={`reason-${record.id}`}
                    name="reason"
                    required
                    maxLength={1000}
                    aria-describedby={withdrawError?.recordId === record.id ? `withdraw-error-${record.id}` : undefined}
                  />
                  {withdrawError?.recordId === record.id && (
                    <p id={`withdraw-error-${record.id}`} className="field-error" role="alert">
                      {withdrawError.error}
                    </p>
                  )}
                  <button type="submit">Withdraw this Rights Record</button>
                </Form>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2>Record a Rights Record</h2>
      <Form method="post" encType="multipart/form-data" className="article-form">
        <input type="hidden" name="intent" value="record" />
        {parts.length > 0 && (
          <>
            <label htmlFor="part">What it covers</label>
            <p id="part-hint">The speakers, music and archive clips listed in the current draft.</p>
            <select
              id="part"
              name="part"
              defaultValue={values?.part ?? ""}
              aria-describedby={errors.part ? "part-hint part-error" : "part-hint"}
            >
              <option value="">The whole item</option>
              {parts.map((part) => (
                <option key={part.value} value={part.value}>
                  {part.label}
                </option>
              ))}
            </select>
            {fieldError("part")}
          </>
        )}

        <label htmlFor="rightsHolder">Rights holder</label>
        <input
          id="rightsHolder"
          name="rightsHolder"
          required
          maxLength={300}
          defaultValue={values?.rightsHolder}
          aria-describedby={describedBy("rightsHolder")}
        />
        {fieldError("rightsHolder")}

        <fieldset aria-describedby={errors.permittedUses ? "uses-hint permittedUses-error" : "uses-hint"}>
          <legend>Permitted Uses</legend>
          <p id="uses-hint">Tick only what the evidence grants. AI training is never assumed.</p>
          {PERMITTED_USES.map((use) => (
            <div key={use} className="choice">
              <input
                type="checkbox"
                id={`use-${use}`}
                name="use"
                value={use}
                defaultChecked={values?.permittedUses.includes(use)}
              />
              <label htmlFor={`use-${use}`}>{PERMITTED_USE_NAMES[use]}</label>
            </div>
          ))}
          {fieldError("permittedUses")}
        </fieldset>

        <div className="choice">
          <input type="checkbox" id="guardianPermission" name="guardianPermission" />
          <label htmlFor="guardianPermission">
            This is documented permission from the guardian of the identifiable children shown
          </label>
        </div>

        <label htmlFor="expiresOn">Expires on (leave empty if it doesn't expire)</label>
        <input
          id="expiresOn"
          name="expiresOn"
          type="date"
          defaultValue={values?.expiresOn}
          aria-describedby={describedBy("expiresOn")}
        />
        {fieldError("expiresOn")}

        {contributors.length > 0 && (
          <fieldset aria-describedby={describedBy("contributorIds")}>
            <legend>Contributors this covers</legend>
            {contributors.map((person) => (
              <div key={person.id} className="choice">
                <input
                  type="checkbox"
                  id={`contributor-${person.id}`}
                  name="contributorId"
                  value={person.id}
                  defaultChecked={values?.contributorIds.includes(person.id)}
                />
                <label htmlFor={`contributor-${person.id}`}>{person.name}</label>
              </div>
            ))}
            {fieldError("contributorIds")}
          </fieldset>
        )}
        <p>
          <a href="/admin/contributors">Add a contributor</a>
        </p>

        <label htmlFor="evidence">Evidence (PDF, JPEG, PNG or WebP, up to 10 MB)</label>
        <input
          id="evidence"
          name="evidence"
          type="file"
          required
          accept="application/pdf,image/jpeg,image/png,image/webp"
          aria-describedby={describedBy("evidence")}
        />
        {fieldError("evidence")}

        <button type="submit">Record Rights Record</button>
      </Form>
    </>
  );
}
