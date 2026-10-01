import { data, redirect } from "react-router";
import { ArticleBodyView } from "~/components/article-body-view";
import { ReviewPanel } from "~/components/review-panel";
import { RevisionTypeDetails } from "~/components/revision-type-details";
import type { ArticleSnapshot } from "~/lib/article-fields";
import { embedsFor } from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { mediaName } from "~/lib/media.server";
import { can, REVIEW_TYPES, type ReviewType } from "~/lib/permissions";
import { publicItemChanged } from "~/lib/public-change.server";
import { archive, eligibilityFor, publishRevision, withdraw } from "~/lib/publication.server";
import {
  assignReviewer,
  decidableRequirement,
  recordDecision,
  recordKnowledgeHolderApproval,
  reviewersFor,
  submitRevision,
} from "~/lib/review.server";
import { requireRevision } from "~/lib/revision-access.server";
import { topicNamer } from "~/lib/topics.server";
import type { Route } from "./+types/revision";

export const handle = { hydrate: false };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `Revision ${loaderData.revision.number} · Na iSema staff` : "Na iSema staff" }];
}

/** The media library file a Resource offers or an Episode plays, if any. */
const typeAssetId = (snapshot: ArticleSnapshot) =>
  snapshot.episode?.audioAssetId ??
  (snapshot.resource?.source.kind === "file" ? snapshot.resource.source.assetId : null);

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db, actor, article, revision, review } = await requireRevision(
    request,
    context.get(cloudflareContext).env,
    params,
  );
  const topicNames = await topicNamer(db);
  const isEditor = can(actor, { action: "content.edit" });
  const isCurrent = review.contentItem.currentDraftRevisionId === review.revisionId;
  const decideTypes = REVIEW_TYPES.filter((reviewType) => decidableRequirement(actor, review, reviewType) !== null);
  const published =
    review.contentItem.currentPublishedRevisionId &&
    (await db.query.revision.findFirst({
      columns: { number: true },
      where: (row, { eq }) => eq(row.id, review.contentItem.currentPublishedRevisionId as string),
    }));

  return {
    article: { id: article.id, title: article.currentRevision.snapshot.title },
    revision,
    topics: topicNames(revision.snapshot.topicIds),
    embeds: await embedsFor(db, revision.snapshot.body),
    fileName: await mediaName(db, typeAssetId(revision.snapshot)),
    review: {
      state: review.state,
      flags: review.flags,
      languageVariety: review.languageVariety,
      progress: review.progress.map(({ requirement, status, decision }) => ({
        requirement,
        status,
        decisionId: decision?.id ?? null,
      })),
      approvals: review.approvals,
      assignments: review.assignments,
      publicationState: review.contentItem.publicationState,
      publishedNumber: published ? published.number : null,
    },
    eligibility: await eligibilityFor(db, review),
    abilities: {
      isEditor,
      canSubmit: isEditor && isCurrent && !review.submitted,
      decideTypes: isCurrent && review.submitted ? decideTypes : [],
      canRecordKnowledgeHolder:
        isCurrent &&
        review.submitted &&
        review.requirements.some((requirement) => requirement.knowledgeHolder) &&
        can(actor, { action: "knowledgeHolderApproval.record", revision: { authorIds: review.authorIds } }),
      canPublish: can(actor, { action: "revision.publish" }),
      canWithdraw: can(actor, { action: "content.withdraw" }),
    },
    reviewerChoices: isEditor
      ? Object.fromEntries(
          await Promise.all(
            [...new Set(review.requirements.map((requirement) => requirement.reviewType))].map(
              async (reviewType) => [reviewType, await reviewersFor(db, reviewType)] as const,
            ),
          ),
        )
      : {},
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
};

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor, review, article } = await requireRevision(request, env, params);
  const form = await request.formData();
  const field = (name: string) => String(form.get(name) ?? "").trim();
  const intent = field("intent");
  const reviewType = field("reviewType") as ReviewType;
  const validType = (REVIEW_TYPES as readonly string[]).includes(reviewType);

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
      case "knowledgeHolder":
        return recordKnowledgeHolderApproval(db, actor, review, {
          knowledgeHolderName: field("knowledgeHolderName"),
          method: field("method"),
          conditions: field("conditions"),
          scope: field("scope"),
          notes: field("notes"),
        });
      case "publish":
        return publishRevision(db, actor, review);
      case "withdraw":
        return withdraw(db, actor, review);
      case "archive":
        return archive(db, actor, review);
      default:
        return { ok: false as const, error: "That action isn't available." };
    }
  })();

  if (!result.ok) return data({ error: result.error }, { status: 400 });
  // Publishing, withdrawing and archiving change what is public, and so can a review decision
  // recorded on the published Revision; purging after every action keeps that rule in one place.
  await publicItemChanged(env, db, article.id);
  throw redirect(`/admin/articles/${params.id}/revisions/${params.number}?done=${intent}`);
}

export default function Revision({ loaderData, actionData }: Route.ComponentProps) {
  const { article, revision, topics, embeds, review, abilities, done } = loaderData;
  const { snapshot } = revision;
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
      {done && DONE_MESSAGES[done] && !actionData && <p role="status">{DONE_MESSAGES[done]}</p>}
      {actionData?.error && <p role="alert">{actionData.error}</p>}
      <article className="article-preview">
        <h1>{snapshot.title}</h1>
        <p className="summary">{snapshot.summary}</p>
        <dl>
          <dt>Topics</dt>
          <dd>{topics.join(", ")}</dd>
          <dt>Credit</dt>
          <dd>{snapshot.credit}</dd>
          {snapshot.sources && (
            <>
              <dt>Sources</dt>
              <dd className="sources">{snapshot.sources}</dd>
            </>
          )}
        </dl>
        <ArticleBodyView body={snapshot.body} embeds={embeds} />
        <RevisionTypeDetails
          snapshot={snapshot}
          fileName={loaderData.fileName}
          audioPath={`/admin/articles/${article.id}/revisions/${revision.number}/audio`}
        />
      </article>
      <ReviewPanel
        revisionNumber={revision.number}
        review={review}
        eligibility={loaderData.eligibility}
        abilities={abilities}
        reviewerChoices={loaderData.reviewerChoices}
      />
    </main>
  );
}
