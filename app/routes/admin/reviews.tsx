import { TableScroll } from "~/components/table-scroll";
import { cloudflareContext } from "~/lib/cloudflare";
import { layerReviewQueue } from "~/lib/layer-review.server";
import { can, type ReviewType } from "~/lib/permissions";
import { contentReviewQueue } from "~/lib/review.server";
import { REVIEW_NAMES } from "~/lib/review-names";
import { requireStaff } from "~/lib/staff.server";
import type { Route } from "./+types/reviews";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Your reviews · NAISEMA staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db, actor } = await requireStaff(context.get(cloudflareContext).env, request);
  if (!can(actor, { action: "reviewQueue.view" })) {
    throw new Response("Only reviewers have a review queue.", { status: 403 });
  }
  const [items, layers] = await Promise.all([contentReviewQueue(db, actor.userId), layerReviewQueue(db, actor.userId)]);
  return {
    queue: [
      ...items.map((entry) => ({
        ...entry,
        key: `item-${entry.id}`,
        kind: "Content Item",
        href: `/admin/articles/${entry.id}/revisions/${entry.number}`,
      })),
      ...layers.map((entry) => ({
        ...entry,
        key: `layer-${entry.id}`,
        kind: "Learning Layer",
        href: `/admin/learning-layers/${entry.id}/revisions/${entry.number}`,
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
        <>
          <p>
            {loaderData.queue.length === 1
              ? "One revision is waiting for your review."
              : `${loaderData.queue.length} revisions are waiting for your review.`}
          </p>
          <TableScroll label="Revisions waiting for your review">
            <table>
              <caption className="visually-hidden">Revisions waiting for your review</caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Revision</th>
                  <th scope="col">Your review</th>
                </tr>
              </thead>
              <tbody>
                {loaderData.queue.map((entry) => (
                  <tr key={`${entry.key}-${entry.number}`}>
                    <th scope="row">
                      <a href={entry.href}>{entry.title}</a>
                    </th>
                    <td>{entry.kind}</td>
                    <td>Revision {entry.number}</td>
                    <td>{entry.reviewTypes.map((type) => REVIEW_NAMES[type as ReviewType]).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </>
      ) : (
        <p>Nothing is waiting for your review.</p>
      )}
    </main>
  );
}
