import { cloudflareContext } from "~/lib/cloudflare";
import { layerReviewQueue } from "~/lib/layer-review.server";
import { can, type ReviewType } from "~/lib/permissions";
import { reviewQueue } from "~/lib/review.server";
import { REVIEW_NAMES } from "~/lib/review-names";
import { requireStaff } from "~/lib/staff.server";
import type { Route } from "./+types/reviews";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Your reviews · Na iSema staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db, actor } = await requireStaff(context.get(cloudflareContext).env, request);
  if (!can(actor, { action: "reviewQueue.view" })) {
    throw new Response("Only reviewers have a review queue.", { status: 403 });
  }
  const [items, layers] = await Promise.all([reviewQueue(db, actor.userId), layerReviewQueue(db, actor.userId)]);
  return {
    queue: [
      ...items.map((entry) => ({
        ...entry,
        key: `item-${entry.contentItemId}`,
        href: `/admin/articles/${entry.contentItemId}/revisions/${entry.number}`,
      })),
      ...layers.map((entry) => ({
        ...entry,
        key: `layer-${entry.learningLayerId}`,
        title: `${entry.title} (Learning Layer)`,
        href: `/admin/learning-layers/${entry.learningLayerId}/revisions/${entry.number}`,
      })),
    ],
  };
}

export default function Reviews({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Your reviews</h1>
      {loaderData.queue.length ? (
        <ul>
          {loaderData.queue.map((entry) => (
            <li key={`${entry.key}-${entry.number}`}>
              <a href={entry.href}>{entry.title}</a>, revision {entry.number}:{" "}
              {entry.reviewTypes.map((type) => REVIEW_NAMES[type as ReviewType]).join(", ")}
            </li>
          ))}
        </ul>
      ) : (
        <p>Nothing is waiting for your review.</p>
      )}
    </main>
  );
}
