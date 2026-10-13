import { data, redirect } from "react-router";
import { ContentRevisionView } from "~/components/content-revision-view";
import { ReviewLinksSection } from "~/components/review-links-section";
import { ReviewPanel, splitFailure } from "~/components/review-panel";
import { footageOf } from "~/lib/article-fields";
import { cloudflareContext } from "~/lib/cloudflare";
import { readEvidenceFile } from "~/lib/evidence-file";
import { REVIEW_TYPES, type ReviewType } from "~/lib/permissions";
import { primaryPublicOrigin } from "~/lib/public-cache.server";
import { publicItemChanged } from "~/lib/public-change.server";
import { changePublication } from "~/lib/publication.server";
import {
  assignReviewer,
  contentReviewAbilities,
  recordContentKnowledgeHolderApproval,
  recordDecision,
  reviewersFor,
  submitRevision,
} from "~/lib/review.server";
import {
  issueContentReviewLink,
  reviewLinkPath,
  reviewLinksFor,
  revokeReviewLink,
  videoHasPublishRights,
} from "~/lib/review-links.server";
import { requireRevision } from "~/lib/revision-access.server";
import { revisionDisplay } from "~/lib/revision-display.server";
import { formatDay } from "~/lib/rights-rules";
import { forStaff, revisionEligibility } from "~/lib/visibility.server";
import type { Route } from "./+types/revision";

export const handle = { hydrate: false };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `Revision ${loaderData.revision.number} · NAISEMA staff` : "NAISEMA staff" }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db, actor, article, revision, review } = await requireRevision(
    request,
    context.get(cloudflareContext).env,
    params,
  );
  const { canShareLinks, canReadEvidence, ...abilities } = contentReviewAbilities(actor, review);
  const links = canShareLinks ? await reviewLinksFor(db, review.revisionId, new Date(), "contentItem") : null;
  const published =
    review.contentItem.currentPublishedRevisionId &&
    (await db.query.revision.findFirst({
      columns: { number: true },
      where: (row, { eq }) => eq(row.id, review.contentItem.currentPublishedRevisionId as string),
    }));

  return {
    article: { id: article.id, title: article.currentRevision.snapshot.title },
    revision,
    ...(await revisionDisplay(db, revision.snapshot, true)),
    review: {
      state: review.state,
      flags: review.flags,
      languageVariety: review.languageVariety,
      progress: review.progress.map(({ requirement, status, decision }) => ({
        requirement,
        status,
        decisionId: decision?.id ?? null,
      })),
      // The evidence's key and name are for editors only, like the file itself.
      approvals: review.approvals.map(
        ({ evidenceAssetId: _asset, evidenceKey: _key, evidenceName, evidenceType: _type, ...approval }) => ({
          ...approval,
          evidence:
            evidenceName && canReadEvidence
              ? { name: evidenceName, href: `/admin/articles/approvals/${approval.id}/evidence` }
              : null,
        }),
      ),
      assignments: review.assignments,
      publicationState: review.contentItem.publicationState,
      publishedNumber: published ? published.number : null,
    },
    eligibility: forStaff(await revisionEligibility(db, review)),
    abilities,
    reviewerChoices: abilities.isEditor
      ? Object.fromEntries(
          await Promise.all(
            [...new Set(review.requirements.map((requirement) => requirement.reviewType))].map(
              async (reviewType) => [reviewType, await reviewersFor(db, reviewType)] as const,
            ),
          ),
        )
      : {},
    links,
    canIssueLinks: links !== null && review.submitted,
    // Footage or a recording is what makes sharing it outside the staff a rights matter.
    rightsWarning:
      links !== null &&
      (footageOf(revision.snapshot) !== null || !!revision.snapshot.episode) &&
      !(await videoHasPublishRights(db, article.id)),
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

type ActionData =
  | { error: string; intent: string; reviewType: string }
  | { issued: { url: string; recipient: string } };

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor, review, article } = await requireRevision(request, env, params);
  const form = await request.formData();
  const field = (name: string) => String(form.get(name) ?? "").trim();
  const intent = field("intent");
  const reviewType = field("reviewType") as ReviewType;
  const validType = (REVIEW_TYPES as readonly string[]).includes(reviewType);

  if (intent === "issueLink") {
    const issued = await issueContentReviewLink(db, actor, review, field("recipient"));
    if (!issued.ok) return data<ActionData>({ error: issued.error, intent, reviewType }, { status: 400 });
    // The address is shown once: only a hash of its token is kept.
    const url = new URL(reviewLinkPath(issued.token), primaryPublicOrigin(env) || request.url).toString();
    return data<ActionData>({ issued: { url, recipient: issued.recipient } });
  }

  const result = await (async () => {
    switch (intent) {
      case "submit":
        return submitRevision(db, actor, review);
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
        return recordContentKnowledgeHolderApproval(env, db, actor, review, {
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
        return revokeReviewLink(db, actor, review, field("linkId"), "contentItem");
      case "publish":
      case "withdraw":
      case "archive":
        return changePublication(env, db, actor, review, intent, field("reason"));
      default:
        return { ok: false as const, error: "That action isn't available." };
    }
  })();

  if (!result.ok) return data<ActionData>({ error: result.error, intent, reviewType }, { status: 400 });
  // A review decision recorded on the published Revision can change what is public too (its Review
  // Labels); publishing, withdrawing and archiving bring the public site up to date themselves.
  if (!["publish", "withdraw", "archive"].includes(intent)) await publicItemChanged(env, db, article.id);
  throw redirect(`/admin/articles/${params.id}/revisions/${params.number}?done=${intent}#outcome`);
}

export default function Revision({ loaderData, actionData }: Route.ComponentProps) {
  const { article, revision, review, abilities, links, done } = loaderData;
  const { panelError, otherError } = splitFailure(actionData);
  const issued = actionData && "issued" in actionData ? actionData.issued : null;
  return (
    <main id="main" className="page">
      <p>
        {abilities.isEditor ? (
          <a href={`/admin/articles/${article.id}/history`}>Back to revision history</a>
        ) : (
          <a href="/admin/reviews">Back to your reviews</a>
        )}
      </p>
      <p>
        Revision {revision.number} of {article.title}
      </p>
      {otherError && !links && <p role="alert">{otherError}</p>}
      {done && DONE_MESSAGES[done] && !actionData && (
        <p role="status" id="outcome" tabIndex={-1}>
          {DONE_MESSAGES[done]}
        </p>
      )}
      <ContentRevisionView
        snapshot={revision.snapshot}
        topics={loaderData.topics}
        embeds={loaderData.embeds}
        fileName={loaderData.fileName}
        sampleTitle={loaderData.sampleTitle}
        audioPath={`/admin/articles/${article.id}/revisions/${revision.number}/audio`}
      />
      <ReviewPanel
        revisionNumber={revision.number}
        reviewLinks={(links ?? [])
          .filter((link) => link.views > 0)
          .map((link) => ({
            id: link.id,
            label: `For ${link.recipient}, issued ${formatDay(link.createdAt)} (opened ${link.views === 1 ? "once" : `${link.views} times`})`,
          }))}
        review={review}
        eligibility={loaderData.eligibility}
        error={panelError}
        abilities={abilities}
        reviewerChoices={loaderData.reviewerChoices}
      />
      {links && (
        <ReviewLinksSection
          number={revision.number}
          links={links}
          issued={issued}
          canIssue={loaderData.canIssueLinks}
          error={otherError}
          rightsWarning={
            loaderData.rightsWarning
              ? "This has no Rights Record granting Publish yet. Share its footage or recording only with people the rights holder has agreed can see it."
              : null
          }
        />
      )}
    </main>
  );
}
