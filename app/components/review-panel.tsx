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
  eligibility: { eligible: true } | { eligible: false; reasons: { kind: string; text: string }[] };
  abilities: {
    isEditor: boolean;
    canSubmit: boolean;
    decideTypes: ReviewType[];
    canRecordKnowledgeHolder: boolean;
    canPublish: boolean;
    canWithdraw: boolean;
  };
  reviewerChoices: Partial<Record<string, { id: string; email: string }[]>>;
  /** What went wrong with the last attempt, shown inside the form it came from. */
  error?: PanelError | null;
};

/** A refused action, and which of the panel's forms it came from. */
export type PanelError = { intent: string; reviewType?: string; message: string };

/** The actions the panel's forms post; any other refusal belongs to another part of the page. */
export const PANEL_INTENTS = ["submit", "assign", "decide", "knowledgeHolder", "publish", "withdraw", "archive"];

const STATUS_SYMBOLS = { approved: "✓", rejected: "✕", awaiting: "…" } as const;
const STATUS_WORDS = { approved: "Approved", rejected: "Rejected", awaiting: "Waiting for review" } as const;

/** A status in words and a symbol, so it never depends on colour alone. */
function Status({ status }: { status: keyof typeof STATUS_WORDS }) {
  return (
    <span className={`status status-${status}`}>
      <span aria-hidden="true">{STATUS_SYMBOLS[status]}</span> {STATUS_WORDS[status]}
    </span>
  );
}

/** A refusal inside its form, announced and focused so the person lands on what to fix. */
function FormError({
  id,
  error,
  intent,
  reviewType,
}: {
  id: string;
  error?: PanelError | null;
  intent: string;
  reviewType?: string;
}) {
  if (!error || error.intent !== intent || (error.reviewType ?? undefined) !== reviewType) return null;
  return (
    <p
      role="alert"
      id={id}
      tabIndex={-1} /* biome-ignore lint/a11y/noAutofocus: lands on the refusal after a full-page post */
      autoFocus
    >
      {error.message}
    </p>
  );
}

const errorId = (error: PanelError | null | undefined, intent: string, reviewType?: string) =>
  error && error.intent === intent && (error.reviewType ?? undefined) === reviewType
    ? `error-${intent}${reviewType ? `-${reviewType}` : ""}`
    : undefined;

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

/** Where a person goes to do something about a thing still missing, if they can. */
type MissingItem = { key: string; text: string; action: { href: string; label: string } | null };

function missingBeforePublishing(
  { review, eligibility, abilities }: Pick<Props, "review" | "eligibility" | "abilities">,
  revisionNumber: number,
): MissingItem[] {
  if (eligibility.eligible) return [];
  const items: MissingItem[] = [];
  for (const reason of eligibility.reasons) {
    if (reason.kind === "review") continue;
    items.push({
      key: reason.text,
      text: reason.text,
      action:
        reason.kind === "unsubmitted" && abilities.canSubmit
          ? { href: "#submit-revision", label: `Submit revision ${revisionNumber} for review` }
          : null,
    });
  }
  // Reviews come from the progress rows, which know which form answers each one.
  const reviews = review.progress.flatMap(({ requirement, status }): MissingItem[] => {
    if (status === "approved") return [];
    const name = requirementName(requirement);
    const assigned = review.assignments.some((row) => row.reviewType === requirement.reviewType);
    let action: MissingItem["action"] = null;
    if (requirement.knowledgeHolder) {
      if (abilities.canRecordKnowledgeHolder) action = { href: "#kh-form", label: "Record the approval" };
    } else if (abilities.decideTypes.includes(requirement.reviewType)) {
      action = { href: `#decide-${requirement.reviewType}`, label: "Record your decision" };
    } else if (abilities.isEditor && !assigned) {
      action = { href: `#assign-form-${requirement.reviewType}`, label: "Assign a reviewer" };
    }
    return [
      {
        key: `review-${name}`,
        text: status === "rejected" ? `${name} was rejected.` : `${name} is still needed.`,
        action,
      },
    ];
  });
  return [...items.filter((item) => item.action), ...reviews, ...items.filter((item) => !item.action)];
}

/** Whether the panel shows the form an error came from; if not, the error is shown above the panel instead. */
function hasFormFor(error: PanelError, { review, abilities }: Pick<Props, "review" | "abilities">) {
  switch (error.intent) {
    case "submit":
      return abilities.canSubmit;
    case "assign":
      return (
        abilities.isEditor &&
        review.progress.some(
          ({ requirement }) => !requirement.knowledgeHolder && requirement.reviewType === error.reviewType,
        )
      );
    case "decide":
      return abilities.decideTypes.some((type) => type === error.reviewType);
    case "knowledgeHolder":
      return abilities.canRecordKnowledgeHolder;
    case "publish":
      return abilities.canPublish && review.publicationState !== "archived";
    case "withdraw":
      return abilities.canWithdraw && review.publicationState === "published";
    default:
      return abilities.canWithdraw && ["unpublished", "withdrawn"].includes(review.publicationState);
  }
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
  error,
}: Props) {
  const approvals = new Map(review.approvals.map((approval) => [approval.id, approval]));
  const missing = missingBeforePublishing({ review, eligibility, abilities }, revisionNumber);
  const stray = error && !hasFormFor(error, { review, abilities }) ? error : null;
  const live = review.publicationState === "published" && review.publishedNumber === revisionNumber;

  return (
    <section aria-labelledby="review-heading" className="review-panel">
      <h2 id="review-heading">Review and publishing</h2>
      {stray && <FormError id="error-stray" error={stray} intent={stray.intent} reviewType={stray.reviewType} />}
      <dl className="review-status">
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
        {review.publicationState !== "archived" && (
          <>
            <dt>Publishing</dt>
            <dd>
              {live ? (
                "This revision is the one published."
              ) : eligibility.eligible ? (
                <strong>Ready to publish</strong>
              ) : (
                <strong>Not ready to publish</strong>
              )}
            </dd>
          </>
        )}
      </dl>

      {abilities.canPublish && missing.length > 0 && (
        <div className="missing">
          <h3 id="missing-heading">Before revision {revisionNumber} can be published</h3>
          <ul>
            {missing.map((item) => (
              <li key={item.key}>
                {item.text}
                {item.action && (
                  <>
                    {" "}
                    <a href={item.action.href}>{item.action.label}</a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

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
            {review.progress.map(({ requirement, status, decisionId }) => {
              const decision = decisionId ? approvals.get(decisionId) : undefined;
              const assigned = review.assignments.filter((row) => row.reviewType === requirement.reviewType);
              return (
                <tr key={requirementName(requirement)}>
                  <th scope="row">
                    {requirementName(requirement)}
                    {requirement.flagRemovedAfter &&
                      `: still needed because revision ${requirement.flagRemovedAfter} had its flag`}
                  </th>
                  <td>
                    <Status status={status} />
                    {decision && <span className="status-detail">{describeApproval(decision)}</span>}
                  </td>
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
        <Form method="post" id="submit-revision">
          <FormError id="error-submit" error={error} intent="submit" />
          <input type="hidden" name="intent" value="submit" />
          <button type="submit" aria-describedby={errorId(error, "submit")}>
            Submit revision {revisionNumber} for review
          </button>
        </Form>
      )}

      {abilities.isEditor &&
        review.progress
          .filter(({ requirement }) => !requirement.knowledgeHolder)
          .map(({ requirement }) => {
            const choices = reviewerChoices[requirement.reviewType] ?? [];
            const id = `assign-${requirement.reviewType}`;
            const failed = errorId(error, "assign", requirement.reviewType);
            return (
              <Form method="post" key={id} id={`assign-form-${requirement.reviewType}`} className="inline-form">
                <FormError
                  id={`error-assign-${requirement.reviewType}`}
                  error={error}
                  intent="assign"
                  reviewType={requirement.reviewType}
                />
                <input type="hidden" name="intent" value="assign" />
                <input type="hidden" name="reviewType" value={requirement.reviewType} />
                {choices.length ? (
                  <>
                    <label htmlFor={id}>
                      Assign a reviewer for {REVIEW_NAMES[requirement.reviewType].toLowerCase()}
                    </label>
                    <select id={id} name="reviewerId" required aria-describedby={failed}>
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

      {abilities.decideTypes.map((reviewType) => {
        const failed = errorId(error, "decide", reviewType);
        return (
          <Form method="post" key={`decide-${reviewType}`} id={`decide-${reviewType}`} className="decision-form">
            <h3>Your {REVIEW_NAMES[reviewType].toLowerCase()}</h3>
            <FormError id={`error-decide-${reviewType}`} error={error} intent="decide" reviewType={reviewType} />
            <input type="hidden" name="intent" value="decide" />
            <input type="hidden" name="reviewType" value={reviewType} />
            <fieldset aria-describedby={failed}>
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
            <textarea
              id={`${reviewType}-notes`}
              name="notes"
              rows={3}
              aria-describedby={[`${reviewType}-notes-hint`, failed].filter(Boolean).join(" ")}
            />
            <button type="submit">Record decision</button>
          </Form>
        );
      })}

      {abilities.canRecordKnowledgeHolder && (
        <Form
          method="post"
          id="kh-form"
          className="decision-form"
          encType={reviewLinks ? "multipart/form-data" : undefined}
        >
          <h3>Record a Knowledge Holder Approval</h3>
          <p>Record it only for revision {revisionNumber}, the exact revision the Knowledge Holder saw.</p>
          <FormError id="error-knowledgeHolder" error={error} intent="knowledgeHolder" />
          <input type="hidden" name="intent" value="knowledgeHolder" />
          {reviewLinks &&
            (reviewLinks.length ? (
              <>
                <label htmlFor="kh-link">The Review Link they saw it through</label>
                <select id="kh-link" name="reviewLinkId" required aria-describedby={errorId(error, "knowledgeHolder")}>
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
          <input
            id="kh-name"
            name="knowledgeHolderName"
            required
            aria-describedby={errorId(error, "knowledgeHolder")}
          />
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

      {abilities.canPublish && review.publicationState !== "archived" && (
        <>
          <h3 id="publishing">Publishing</h3>
          <Form method="post" className="inline-form">
            <FormError id="error-publish" error={error} intent="publish" />
            <input type="hidden" name="intent" value="publish" />
            <button type="submit" aria-describedby={errorId(error, "publish")}>
              Publish revision {revisionNumber}
            </button>
          </Form>
        </>
      )}
      {abilities.canWithdraw && review.publicationState === "published" && (
        <Form method="post" className="inline-form">
          <FormError id="error-withdraw" error={error} intent="withdraw" />
          <input type="hidden" name="intent" value="withdraw" />
          <ReasonField id="withdraw-reason" describedBy={errorId(error, "withdraw")} />
          <button type="submit">Withdraw the {subject}</button>
        </Form>
      )}
      {abilities.canWithdraw &&
        (review.publicationState === "unpublished" || review.publicationState === "withdrawn") && (
          <Form method="post" className="inline-form">
            <FormError id="error-archive" error={error} intent="archive" />
            <input type="hidden" name="intent" value="archive" />
            <ReasonField id="archive-reason" describedBy={errorId(error, "archive")} />
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
function ReasonField({ id, describedBy }: { id: string; describedBy?: string }) {
  return (
    <>
      <label htmlFor={id}>Why (optional, kept in the audit log)</label>
      <input id={id} name="reason" maxLength={500} aria-describedby={describedBy} />
    </>
  );
}
