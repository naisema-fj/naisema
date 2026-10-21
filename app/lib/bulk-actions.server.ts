import { eq } from "drizzle-orm";
import { learningLayer } from "~db/schema";
import { getArticle } from "./articles.server";
import type { BulkOutcome, BulkRequest } from "./bulk-actions";
import type { Database } from "./db.server";
import { loadLayerReview } from "./layer-review.server";
import { logError } from "./log.server";
import { type Actor, REVIEW_TYPES, type ReviewType } from "./permissions";
import { changeLayerPublication, changePublication } from "./publication.server";
import { assignReviewer, loadReview, type ReviewCore, reviewersFor } from "./review.server";
import { REVIEW_NAMES } from "./review-names";

/**
 * Bulk actions (BO-07): assigning a reviewer to, withdrawing or archiving several Content Items or
 * Learning Layers in one step. There is no bulk path past the single actions: every item is loaded,
 * checked and changed by the same function the single action uses, as this person, so each is
 * permission-checked, audited with the reason and brings the public site up to date on its own.
 * An item that cannot take the action is skipped with the reason and the rest carry on. Publishing
 * is deliberately absent: each Revision needs its own eligibility check.
 */

type Target = {
  title: string;
  publicationState: string;
  review: ReviewCore;
  change: (action: "withdraw" | "archive", reason: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

/** An item's current draft with the means to change it, or null when it is gone. */
async function load(db: Database, env: Env, actor: Actor, request: BulkRequest, id: string): Promise<Target | null> {
  if (request.kind === "content") {
    const article = await getArticle(db, id);
    const review = article && (await loadReview(db, article.currentRevision.id));
    if (!article || !review) return null;
    return {
      title: article.currentRevision.snapshot.title,
      publicationState: review.contentItem.publicationState,
      review,
      change: (action, reason) => changePublication(env, db, actor, review, action, reason),
    };
  }
  const layer = await db
    .select({ revisionId: learningLayer.currentDraftRevisionId })
    .from(learningLayer)
    .where(eq(learningLayer.id, id))
    .get();
  const review = layer?.revisionId ? await loadLayerReview(db, layer.revisionId) : null;
  if (!review) return null;
  return {
    title: review.snapshot.title,
    publicationState: review.layer.publicationState,
    review,
    change: (action, reason) => changeLayerPublication(env, db, actor, review, action, reason),
  };
}

/** Why a reviewer would not be assigned for this Review Type, or null when the item needs the review. */
function notNeeded(target: Target, reviewType: ReviewType) {
  const name = REVIEW_NAMES[reviewType].toLowerCase();
  if (target.publicationState === "archived") return "It is archived.";
  // A cultural review that only a Knowledge Holder can satisfy is recorded by an editor, not assigned.
  const needed = target.review.progress.filter(
    (entry) => entry.requirement.reviewType === reviewType && !entry.requirement.knowledgeHolder,
  );
  if (!needed.length) return `It doesn't need a ${name}.`;
  if (needed.every((entry) => entry.status === "approved")) return `The ${name} is already approved.`;
  return null;
}

async function applyTo(db: Database, actor: Actor, request: BulkRequest, target: Target) {
  if (request.action === "assign") {
    const skip = notNeeded(target, request.reviewType);
    if (skip) return { ok: false as const, error: skip };
    return assignReviewer(db, actor, target.review, request.reviewType, request.reviewerId);
  }
  return target.change(request.action, request.reason);
}

const DONE: Record<BulkRequest["action"], string> = {
  assign: "Reviewer assigned.",
  withdraw: "Withdrawn.",
  archive: "Archived.",
};

/**
 * Applies the action to each chosen item in turn, as this person, and reports what happened to
 * each, in the order they were chosen. One failing unexpectedly is reported and does not stop the rest.
 */
export async function runBulk(env: Env, db: Database, actor: Actor, request: BulkRequest): Promise<BulkOutcome[]> {
  const outcomes: BulkOutcome[] = [];
  for (const id of request.ids) {
    try {
      const target = await load(db, env, actor, request, id);
      if (!target) {
        outcomes.push({ id, title: id, ok: false, text: "It no longer exists." });
        continue;
      }
      const result = await applyTo(db, actor, request, target);
      outcomes.push({ id, title: target.title, ok: result.ok, text: result.ok ? DONE[request.action] : result.error });
    } catch (error) {
      logError("Bulk action failed on an item", { kind: request.kind, action: request.action, itemId: id, error });
      outcomes.push({ id, title: id, ok: false, text: "It could not be changed. Try again on its own page." });
    }
  }
  return outcomes;
}

/** The people an editor may assign, grouped by the Review Type each does, for the bulk form's choice. */
export async function bulkReviewerChoices(db: Database) {
  const groups = await Promise.all(
    REVIEW_TYPES.map(async (reviewType) => ({
      reviewType,
      name: REVIEW_NAMES[reviewType],
      people: (await reviewersFor(db, reviewType)).map(({ id, email }) => ({ id, email })),
    })),
  );
  return groups.filter((group) => group.people.length > 0);
}

export type ReviewerChoices = Awaited<ReturnType<typeof bulkReviewerChoices>>;
