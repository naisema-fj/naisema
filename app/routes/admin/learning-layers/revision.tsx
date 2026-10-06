import { data, Form, redirect } from "react-router";
import { LayerRevisionView } from "~/components/layer-revision-view";
import { ReviewPanel } from "~/components/review-panel";
import { cloudflareContext } from "~/lib/cloudflare";
import { readEvidenceFile } from "~/lib/evidence-file";
import {
  layerReviewAbilities,
  recordLayerKnowledgeHolderApproval,
  submitLayerRevision,
} from "~/lib/layer-review.server";
import { requireLayerRevision } from "~/lib/layer-revision-access.server";
import { REVIEW_TYPES, type ReviewType } from "~/lib/permissions";
import { primaryPublicOrigin } from "~/lib/public-cache.server";
import { changeLayerPublication } from "~/lib/publication.server";
import { assignReviewer, recordDecision, reviewersFor } from "~/lib/review.server";
import {
  issueReviewLink,
  reviewLinkPath,
  reviewLinksFor,
  revokeReviewLink,
  videoHasPublishRights,
} from "~/lib/review-links.server";
import { formatDay } from "~/lib/rights-rules";
import { forStaff, layerRevisionEligibility } from "~/lib/visibility.server";
import type { Route } from "./+types/revision";

export const handle = { hydrate: false };

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: loaderData
        ? `${loaderData.snapshot.title}, revision ${loaderData.number} · NAISEMA staff`
        : "NAISEMA staff",
    },
  ];
}

const LINK_STATES = { active: "Active", expired: "Expired", revoked: "Revoked" } as const;

/**
 * GET /admin/learning-layers/:id/revisions/:number — one Learning Layer Revision, exactly as saved,
 * with its review and publishing: submitting, assigning reviewers, decisions, Review Links,
 * Knowledge Holder Approvals, and publishing or withdrawing the Learning Layer on its own.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db, actor, review } = await requireLayerRevision(request, context.get(cloudflareContext).env, params);
  const { canShareLinks, canReadEvidence, ...abilities } = layerReviewAbilities(actor, review);
  const isCurrent = review.layer.currentDraftRevisionId === review.revisionId;
  const links = canShareLinks ? await reviewLinksFor(db, review.revisionId) : null;
  const published = review.layer.currentPublishedRevisionId
    ? await db.query.learningLayerRevision.findFirst({
        columns: { number: true },
        where: (row, { eq }) => eq(row.id, review.layer.currentPublishedRevisionId as string),
      })
    : undefined;
  return {
    layerId: review.layer.id,
    number: review.number,
    snapshot: review.snapshot,
    isCurrent,
    review: {
      state: review.state,
      flags: review.flags,
      languageVariety: review.layer.languageVariety,
      progress: review.progress.map(({ requirement, status, decision }) => ({
        requirement,
        status,
        decisionId: decision?.id ?? null,
      })),
      approvals: review.approvals.map((approval) => ({
        ...approval,
        evidence:
          approval.evidenceName && canReadEvidence
            ? { name: approval.evidenceName, href: `/admin/learning-layers/approvals/${approval.id}/evidence` }
            : null,
      })),
      assignments: review.assignments,
      publicationState: review.layer.publicationState,
      publishedNumber: published?.number ?? null,
    },
    eligibility: forStaff(await layerRevisionEligibility(db, review)),
    abilities,
    reviewerChoices: abilities.isEditor
      ? Object.fromEntries(
          await Promise.all(
            [...new Set(review.requirements.map((requirement) => requirement.reviewType))].map(
              async (type) => [type, await reviewersFor(db, type)] as const,
            ),
          ),
        )
      : {},
    links,
    canIssueLinks: links !== null && review.submitted,
    videoHasRights: links !== null && (await videoHasPublishRights(db, review.layer.contentItemId)),
    done: new URL(request.url).searchParams.get("done"),
  };
}

const DONE_MESSAGES: Record<string, string> = {
  submit: "Submitted for review.",
  assign: "Reviewer assigned.",
  decide: "Your decision is recorded.",
  knowledgeHolder: "Knowledge Holder Approval recorded.",
  publish: "Published.",
  withdraw: "Withdrawn.",
  archive: "Archived.",
  revokeLink: "Review Link revoked. It no longer opens.",
};

type ActionData = { error: string } | { issued: { url: string; recipient: string } };

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor, review } = await requireLayerRevision(request, env, params);
  const form = await request.formData();
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const intent = field("intent");
  const reviewType = field("reviewType") as ReviewType;
  const validType = (REVIEW_TYPES as readonly string[]).includes(reviewType);

  if (intent === "issueLink") {
    const issued = await issueReviewLink(db, actor, review, field("recipient"));
    if (!issued.ok) return data<ActionData>({ error: issued.error }, { status: 400 });
    // The address is shown once: only a hash of its token is kept.
    const url = new URL(reviewLinkPath(issued.token), primaryPublicOrigin(env) || request.url).toString();
    return data<ActionData>({ issued: { url, recipient: issued.recipient } });
  }

  const result = await (async () => {
    switch (intent) {
      case "submit":
        return submitLayerRevision(db, actor, review);
      case "assign":
        if (!validType) return { ok: false as const, error: "Choose a Review Type." };
        return assignReviewer(db, actor, review, reviewType, field("reviewerId"));
      case "decide": {
        const decision = field("decision");
        if (!validType || (decision !== "approved" && decision !== "rejected")) {
          return { ok: false as const, error: "Choose approve or reject." };
        }
        return recordDecision(db, actor, review, {
          reviewType,
          decision,
          scope: field("scope"),
          notes: field("notes"),
        });
      }
      case "knowledgeHolder": {
        const file = form.get("evidence");
        const attached = file instanceof File && file.size > 0;
        const evidence = attached ? await readEvidenceFile(file, "") : null;
        if (evidence && !evidence.ok) return { ok: false as const, error: evidence.error };
        return recordLayerKnowledgeHolderApproval(env, db, actor, review, {
          knowledgeHolderName: field("knowledgeHolderName"),
          method: field("method"),
          conditions: field("conditions"),
          scope: field("scope"),
          notes: field("notes"),
          reviewLinkId: field("reviewLinkId"),
          evidence: evidence?.ok ? evidence.file : null,
        });
      }
      case "revokeLink":
        return revokeReviewLink(db, actor, review, field("linkId"));
      case "publish":
      case "withdraw":
      case "archive":
        return changeLayerPublication(env, db, actor, review, intent, field("reason"));
      default:
        return { ok: false as const, error: "That action isn't available." };
    }
  })();
  if (!result.ok) return data<ActionData>({ error: result.error }, { status: 400 });
  throw redirect(`/admin/learning-layers/${params.id}/revisions/${params.number}?done=${intent}`);
}

export default function LayerRevision({ loaderData, actionData }: Route.ComponentProps) {
  const { layerId, number, snapshot, review, abilities, links, done } = loaderData;
  const error = actionData && "error" in actionData ? actionData.error : null;
  const issued = actionData && "issued" in actionData ? actionData.issued : null;
  return (
    <main id="main" className="page">
      <p>
        <a href={`/admin/learning-layers/${layerId}`}>Back to the Learning Layer</a>
        {" · "}
        <a href="/admin/reviews">Your reviews</a>
      </p>
      <p>
        Revision {number}
        {!loaderData.isCurrent && " (a newer revision exists)"}
      </p>
      {done && DONE_MESSAGES[done] && !actionData && <p role="status">{DONE_MESSAGES[done]}</p>}
      {error && <p role="alert">{error}</p>}
      <h1>{snapshot.title}</h1>
      <LayerRevisionView snapshot={snapshot} languageVariety={review.languageVariety} />

      <ReviewPanel
        revisionNumber={number}
        subject="Learning Layer"
        reviewLinks={(links ?? [])
          .filter((link) => link.views > 0)
          .map((link) => ({
            id: link.id,
            label: `For ${link.recipient}, issued ${formatDay(link.createdAt)} (opened ${link.views === 1 ? "once" : `${link.views} times`})`,
          }))}
        review={review}
        eligibility={loaderData.eligibility}
        abilities={abilities}
        reviewerChoices={loaderData.reviewerChoices}
      />

      {links && (
        <section aria-labelledby="links-heading">
          <h2 id="links-heading">Review Links</h2>
          <p>
            A Review Link shows revision {number} exactly as it is, to someone without a staff account, such as a
            Knowledge Holder. It needs no sign-in, can't change anything, lasts 14 days and is logged each time it is
            opened.
          </p>
          {issued && (
            <div role="status" className="issued-link">
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
                    <td>{link.recipient}</td>
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
          {loaderData.canIssueLinks && !loaderData.videoHasRights && (
            <p className="field-error" id="link-rights-warning">
              This Video has no Rights Record granting Publish yet. Share it only with people the rights holder has
              agreed can see it.
            </p>
          )}
          {loaderData.canIssueLinks ? (
            <Form
              method="post"
              className="inline-form"
              aria-describedby={loaderData.videoHasRights ? undefined : "link-rights-warning"}
            >
              <input type="hidden" name="intent" value="issueLink" />
              <label htmlFor="link-recipient">Who it is for</label>
              <input id="link-recipient" name="recipient" required maxLength={200} />
              <button type="submit">Issue a Review Link</button>
            </Form>
          ) : (
            <p>Submit revision {number} for review before sharing it.</p>
          )}
        </section>
      )}
    </main>
  );
}
