import { Form } from "react-router";
import { formatDay } from "~/lib/rights-rules";

const LINK_STATES = { active: "Active", expired: "Expired", revoked: "Revoked" } as const;

export type ReviewLinkRow = {
  id: string;
  recipient: string;
  issuedBy: string;
  createdAt: Date;
  expiresAt: Date;
  state: keyof typeof LINK_STATES;
  views: number;
  lastViewedAt: Date | null;
};

/**
 * The Review Links to one Revision, for the editors who share it: the links so far, a form to issue
 * another, and the address of one just issued, which is shown once because only a hash of its
 * token is kept. A Learning Layer's page and a Content Item's page use the same section.
 */
export function ReviewLinksSection({
  number,
  links,
  issued,
  canIssue,
  rightsWarning,
  error,
}: {
  number: number;
  links: ReviewLinkRow[];
  issued: { url: string; recipient: string } | null;
  canIssue: boolean;
  /** What to say when the footage or recording it plays has no Rights Record granting Publish yet; null if nothing to say. */
  rightsWarning: string | null;
  /** Why issuing or revoking a link was refused. */
  error: string | null;
}) {
  return (
    <section aria-labelledby="links-heading">
      <h2 id="links-heading">Review Links</h2>
      <p>
        A Review Link shows revision {number} exactly as it is, to someone without a staff account, such as a Knowledge
        Holder. It needs no sign-in, can't change anything, lasts 14 days and is logged each time it is opened.
      </p>
      {error && (
        <p
          role="alert"
          id="link-error"
          tabIndex={-1} /* biome-ignore lint/a11y/noAutofocus: lands on the refusal after a full-page post */
          autoFocus
        >
          {error}
        </p>
      )}
      {issued && (
        <div role="status" className="issued-link" id="outcome" tabIndex={-1}>
          <p>Review Link for {issued.recipient}. Copy it now: it won't be shown again.</p>
          <p>
            <code>{issued.url}</code>
          </p>
        </div>
      )}
      {links.length > 0 && (
        <table>
          <caption className="visually-hidden">Review Links to revision {number}</caption>
          <thead>
            <tr>
              <th scope="col">For</th>
              <th scope="col">Issued</th>
              <th scope="col">State</th>
              <th scope="col">Opened</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.id}>
                <th scope="row">{link.recipient}</th>
                <td>
                  {formatDay(link.createdAt)} by {link.issuedBy}
                </td>
                <td>
                  {LINK_STATES[link.state]}
                  {link.state === "active" && `, until ${formatDay(link.expiresAt)}`}
                </td>
                <td>
                  {link.views === 0
                    ? "Not yet"
                    : `${link.views === 1 ? "Once" : `${link.views} times`}, last ${formatDay(link.lastViewedAt ?? link.createdAt)}`}
                </td>
                <td>
                  {link.state === "active" && (
                    <Form method="post" className="inline-form">
                      <input type="hidden" name="intent" value="revokeLink" />
                      <input type="hidden" name="linkId" value={link.id} />
                      <button type="submit">
                        Revoke<span className="visually-hidden"> the Review Link for {link.recipient}</span>
                      </button>
                    </Form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canIssue && rightsWarning && (
        <p className="field-error" id="link-rights-warning">
          {rightsWarning}
        </p>
      )}
      {canIssue ? (
        <Form
          method="post"
          className="inline-form"
          aria-describedby={rightsWarning ? "link-rights-warning" : undefined}
        >
          <input type="hidden" name="intent" value="issueLink" />
          <label htmlFor="link-recipient">Who it is for</label>
          <input
            id="link-recipient"
            name="recipient"
            required
            maxLength={200}
            aria-describedby={error ? "link-error" : undefined}
          />
          <button type="submit">Issue a Review Link</button>
        </Form>
      ) : (
        <p>Submit revision {number} for review before sharing it.</p>
      )}
    </section>
  );
}
