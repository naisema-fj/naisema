import { and, eq } from "drizzle-orm";
import { learningLayerRevision } from "~db/schema";
import { recordAudit } from "./audit.server";
import { loadLayerReview } from "./layer-review.server";
import { can } from "./permissions";
import { requireStaff } from "./staff.server";

/**
 * The staff gate for one Learning Layer Revision's review page: editors, the Educators assigned
 * to the Learning Layer, and the reviewers assigned to it may open it; anyone else is refused, and
 * the refusal audited.
 */
export async function requireLayerRevision(request: Request, env: Env, params: { id: string; number: string }) {
  const staff = await requireStaff(env, request);
  const row = await staff.db
    .select({ id: learningLayerRevision.id })
    .from(learningLayerRevision)
    .where(
      and(
        eq(learningLayerRevision.learningLayerId, params.id),
        eq(learningLayerRevision.number, Number(params.number) || 0),
      ),
    )
    .get();
  const review = row && (await loadLayerReview(staff.db, row.id));
  if (!review) throw new Response("Not found", { status: 404 });
  const { educatorIds } = review;
  const reviewerIds = review.assignments.map((assignment) => assignment.reviewerId);
  const allowed =
    can(staff.actor, { action: "learningLayer.author", learningLayer: { assignedEducatorIds: educatorIds } }) ||
    can(staff.actor, { action: "revision.view", revision: { assignedReviewerIds: reviewerIds } });
  if (!allowed) {
    await recordAudit(staff.db, {
      actorId: staff.actor.userId,
      action: "learning_layer.authoring_refused",
      objectType: "learning_layer",
      objectId: review.layer.id,
    });
    throw new Response("Only editors, and this Learning Layer's Educators and reviewers, can open its revisions.", {
      status: 403,
    });
  }
  return { ...staff, review, educatorIds };
}
