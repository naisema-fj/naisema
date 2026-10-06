import { Form } from "react-router";
import type { ReviewType } from "~/lib/permissions";
import {
  FLAG_NAMES,
  PUBLICATION_NAMES,
  type PublicationState,
  REVIEW_NAMES,
  requirementName,
  STATE_NAMES,
} from "~/lib/review-names";
import type { ContentFlag, ReviewRequirement, RevisionState } from "~/lib/review-rules";

type Approval = {
  id: string;
  reviewType: string;
  languageVariety: string | null;
  decision: string;
  reviewerEmail: string;
  scope: string | null;
  notes: string | null;
  knowledgeHolderName: string | null;
  knowledgeHolderMethod: string | null;
  conditions: string | null;
  carriedFromNumber: number | null;
  decidedAt: Date | string;
  /** A Learning Layer's Knowledge Holder Approval: who the Review Link they saw it through was for. */
  reviewLinkRecipient?: string | null;
  /** Where an editor downloads the approval's private evidence, if it has any. */
  evidence?: { name: string; href: string } | null;
};

type Props = {
  revisionNumber: number;
  /** What is reviewed and published, as staff name it. */
  subject?: "article" | "Learning Layer";
  /**
   * A Learning Layer's Review Links: a Knowledge Holder Approval names the one they saw the
   * Revision through, and can carry private evidence.
   */
  reviewLinks?: { id: string; label: string }[];
  review: {
    state: RevisionState;
    flags: ContentFlag[];
    languageVariety: string | null;
    progress: {
      requirement: ReviewRequirement;
      status: "awaiting" | "approved" | "rejected";
      decisionId: string | null;
    }[];
    approvals: Approval[];
    assignments: { id: string; reviewType: string; reviewerId: string; email: string | null }[];
    publicationState: PublicationState;
    publishedNumber: number | null;
  };
  eligibility: { eligible: true } | { eligible: false; reasons: string[] };
  abilities: {
    isEditor: boolean;
    canSubmit: boolean;
    decideTypes: ReviewType[];
    canRecordKnowledgeHolder: boolean;
    canPublish: boolean;
    canWithdraw: boolean;
  };
  reviewerChoices: Partial<Record<string, { id: string; email: string }[]>>;
};

const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString("en-AU", { dateStyle: "medium", timeZone: "UTC" });

function describeApproval(approval: Approval) {
  const verb = approval.decision === "approved" ? "Approved" : "Rejected";
  const who = approval.knowledgeHolderName
    ? `by ${approval.knowledgeHolderName} (${approval.knowledgeHolderMethod}), recorded by ${approval.reviewerEmail}`
    : `by ${approval.reviewerEmail}`;
  const carried = approval.carriedFromNumber ? `, carried forward from revision ${approval.carriedFromNumber}` : "";
  const seen = approval.reviewLinkRecipient ? `, seen through the Review Link for ${approval.reviewLinkRecipient}` : "";
  return `${verb} ${who} on ${formatDate(approval.decidedAt)}${seen}${carried}`;
}

/** Review and publication for one Revision: what it needs, what is decided, and what you can do. */
export function ReviewPanel({
  revisionNumber,
  subject = "article",
  reviewLinks,
  review,
  eligibility,
  abilities,
  reviewerChoices,
}: Props) {
  const approvals = new Map(review.approvals.map((approval) => [approval.id, approval]));

  return (
    <section aria-labelledby="review-heading" className="review-panel">
      <h2 id="review-heading">Review and publishing</h2>
      <dl>
        <dt>This revision</dt>
        <dd>{STATE_NAMES[review.state]}</dd>
        <dt>{subject === "article" ? "Article" : subject}</dt>
        <dd>
          {PUBLICATION_NAMES[review.publicationState]}
          {review.publishedNumber !== null && review.publicationState !== "unpublished"
            ? ` (revision ${review.publishedNumber})`
            : ""}
        </dd>
        <dt>Content Flags</dt>
        <dd>{review.flags.length ? review.flags.map((flag) => FLAG_NAMES[flag]).join(", ") : "None"}</dd>
      </dl>

      <h3>Required reviews</h3>
      {review.progress.length === 0 ? (
        <p>These Content Flags need no review. Submitting the revision makes it approved.</p>
      ) : (
        <table>
          <caption className="visually-hidden">Reviews this revision needs and where each stands</caption>
          <thead>
            <tr>
              <th scope="col">Review</th>
              <th scope="col">Status</th>
              <th scope="col">Assigned</th>
            </tr>
          </thead>
          <tbody>
            {review.progress.map(({ requirement, decisionId }) => {
              const decision = decisionId ? approvals.get(decisionId) : undefined;
              const assigned = review.assignments.filter((row) => row.reviewType === requirement.reviewType);
              return (
                <tr key={requirementName(requirement)}>
                  <td>
                    {requirementName(requirement)}
                    {requirement.flagRemovedAfter &&
                      `: still needed because revision ${requirement.flagRemovedAfter} had its flag`}
                  </td>
                  <td>{decision ? describeApproval(decision) : "Waiting for review"}</td>
                  <td>
                    {requirement.knowledgeHolder
                      ? "Recorded by an editor"
                      : assigned.map((row) => row.email ?? "a former staff member").join(", ") || "Nobody yet"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {abilities.canSubmit && (
        <Form method="post">
          <input type="hidden" name="intent" value="submit" />
          <button type="submit">Submit revision {revisionNumber} for review</button>
        </Form>
      )}

      {abilities.isEditor &&
        review.progress
          .filter(({ requirement }) => !requirement.knowledgeHolder)
          .map(({ requirement }) => {
            const choices = reviewerChoices[requirement.reviewType] ?? [];
            const id = `assign-${requirement.reviewType}`;
            return (
              <Form method="post" key={id} className="inline-form">
                <input type="hidden" name="intent" value="assign" />
                <input type="hidden" name="reviewType" value={requirement.reviewType} />
                {choices.length ? (
                  <>
                    <label htmlFor={id}>
                      Assign a reviewer for {REVIEW_NAMES[requirement.reviewType].toLowerCase()}
                    </label>
                    <select id={id} name="reviewerId" required>
                      {choices.map((choice) => (
                        <option key={choice.id} value={choice.id}>
                          {choice.email}
                        </option>
                      ))}
                    </select>
                    <button type="submit">Assign</button>
                  </>
                ) : (
                  <p>
                    Nobody does {REVIEW_NAMES[requirement.reviewType].toLowerCase()} yet. An administrator can grant the
                    reviewer role.
                  </p>
                )}
              </Form>
            );
          })}

      {abilities.decideTypes.map((reviewType) => (
        <Form method="post" key={`decide-${reviewType}`} className="decision-form">
          <h3>Your {REVIEW_NAMES[reviewType].toLowerCase()}</h3>
          <input type="hidden" name="intent" value="decide" />
          <input type="hidden" name="reviewType" value={reviewType} />
          <fieldset>
            <legend>Decision on revision {revisionNumber}</legend>
            <div className="choice">
              <input type="radio" id={`${reviewType}-approve`} name="decision" value="approved" required />
              <label htmlFor={`${reviewType}-approve`}>Approve</label>
            </div>
            <div className="choice">
              <input type="radio" id={`${reviewType}-reject`} name="decision" value="rejected" />
              <label htmlFor={`${reviewType}-reject`}>Reject</label>
            </div>
          </fieldset>
          <label htmlFor={`${reviewType}-scope`}>What you reviewed</label>
          <input id={`${reviewType}-scope`} name="scope" />
          <label htmlFor={`${reviewType}-notes`}>Notes</label>
          <p id={`${reviewType}-notes-hint`}>Required when rejecting: say what needs to change.</p>
          <textarea id={`${reviewType}-notes`} name="notes" rows={3} aria-describedby={`${reviewType}-notes-hint`} />
          <button type="submit">Record decision</button>
        </Form>
      ))}

      {abilities.canRecordKnowledgeHolder && (
        <Form method="post" className="decision-form" encType={reviewLinks ? "multipart/form-data" : undefined}>
          <h3>Record a Knowledge Holder Approval</h3>
          <p>Record it only for revision {revisionNumber}, the exact revision the Knowledge Holder saw.</p>
          <input type="hidden" name="intent" value="knowledgeHolder" />
          {reviewLinks &&
            (reviewLinks.length ? (
              <>
                <label htmlFor="kh-link">The Review Link they saw it through</label>
                <select id="kh-link" name="reviewLinkId" required>
                  {reviewLinks.map((link) => (
                    <option key={link.id} value={link.id}>
                      {link.label}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p>
                Issue a Review Link first: the approval names the link the Knowledge Holder saw this revision through.
              </p>
            ))}
          <label htmlFor="kh-name">Knowledge Holder</label>
          <input id="kh-name" name="knowledgeHolderName" required />
          <label htmlFor="kh-method">How they gave approval</label>
          <p id="kh-method-hint">For example in person, by phone or in writing.</p>
          <input id="kh-method" name="method" required aria-describedby="kh-method-hint" />
          <label htmlFor="kh-conditions">Conditions</label>
          <textarea id="kh-conditions" name="conditions" rows={2} />
          <label htmlFor="kh-scope">What they reviewed</label>
          <input id="kh-scope" name="scope" />
          <label htmlFor="kh-notes">Notes</label>
          <textarea id="kh-notes" name="notes" rows={2} />
          {reviewLinks && (
            <>
              <label htmlFor="kh-evidence">Evidence (optional: PDF, JPEG, PNG or WebP, up to 10 MB)</label>
              <p id="kh-evidence-hint">Kept privately, for editors only, once it passes its virus scan.</p>
              <input
                id="kh-evidence"
                name="evidence"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                aria-describedby="kh-evidence-hint"
              />
            </>
          )}
          <button type="submit">Record approval</button>
        </Form>
      )}

      {abilities.canPublish && (
        <>
          <h3>Publishing</h3>
          {!eligibility.eligible && (
            <>
              <p>Revision {revisionNumber} can't be published yet:</p>
              <ul>
                {eligibility.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          )}
          {review.publicationState !== "archived" && (
            <Form method="post" className="inline-form">
              <input type="hidden" name="intent" value="publish" />
              <button type="submit">Publish revision {revisionNumber}</button>
            </Form>
          )}
        </>
      )}
      {abilities.canWithdraw && review.publicationState === "published" && (
        <Form method="post" className="inline-form">
          <input type="hidden" name="intent" value="withdraw" />
          <ReasonField id="withdraw-reason" />
          <button type="submit">Withdraw the {subject}</button>
        </Form>
      )}
      {abilities.canWithdraw &&
        (review.publicationState === "unpublished" || review.publicationState === "withdrawn") && (
          <Form method="post" className="inline-form">
            <input type="hidden" name="intent" value="archive" />
            <ReasonField id="archive-reason" />
            <button type="submit">Archive the {subject}</button>
          </Form>
        )}

      {review.approvals.length > 0 && (
        <>
          <h3>All decisions on this revision</h3>
          <ul>
            {review.approvals.map((approval) => (
              <li key={approval.id}>
                {REVIEW_NAMES[approval.reviewType as ReviewType]}: {describeApproval(approval)}
                {approval.scope && `. Reviewed: ${approval.scope}`}
                {approval.conditions && `. Conditions: ${approval.conditions}`}
                {approval.notes && `. Notes: ${approval.notes}`}
                {approval.evidence && (
                  <>
                    . <a href={approval.evidence.href}>Download the evidence ({approval.evidence.name})</a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Why the editor is taking an item down or retiring it, for the audit log; optional. */
function ReasonField({ id }: { id: string }) {
  return (
    <>
      <label htmlFor={id}>Why (optional, kept in the audit log)</label>
      <input id={id} name="reason" maxLength={500} />
    </>
  );
}
