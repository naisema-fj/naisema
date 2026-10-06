import type { ArticleSnapshot } from "./article-fields";
import { getArticle } from "./articles.server";
import { recordAudit } from "./audit.server";
import { can } from "./permissions";
import { assignedReviewerIds, CONTENT_ITEM_REVIEW, loadReview } from "./review.server";
import { getRevision } from "./revisions.server";
import { requireStaff } from "./staff.server";

/** Editors, and the reviewers assigned to the item, may open its revisions (revision.view). */
export async function requireRevision(request: Request, env: Env, params: { id: string; number: string }) {
  const staff = await requireStaff(env, request);
  const article = await getArticle(staff.db, params.id);
  if (!article) throw new Response("Not found", { status: 404 });
  const assigned = await assignedReviewerIds(CONTENT_ITEM_REVIEW, staff.db, article.id);
  if (!can(staff.actor, { action: "revision.view", revision: { assignedReviewerIds: assigned } })) {
    // Refused like a Learning Layer's revisions are: audited.
    await recordAudit(staff.db, {
      actorId: staff.actor.userId,
      action: "revision.view_refused",
      objectType: "content_item",
      objectId: article.id,
    });
    throw new Response("Only editors and this item's reviewers can open its revisions.", { status: 403 });
  }
  const revision = await getRevision<ArticleSnapshot>(staff.db, article.id, Number(params.number));
  const review = revision && (await loadReview(staff.db, revision.id));
  if (!revision || !review) throw new Response("Not found", { status: 404 });
  return { ...staff, article, revision, review };
}
