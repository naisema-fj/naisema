import { cloudflareContext } from "~/lib/cloudflare";
import { MAX_BATCH_LENGTH, readProgressBatch } from "~/lib/learner-progress";
import { applyProgressEvents } from "~/lib/learner-progress.server";
import { fromThisSite, getLearner, requireOwnRecords } from "~/lib/learners.server";
import { PRIVATE_NO_STORE } from "~/lib/public-cache.server";
import type { Route } from "./+types/events";

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { "Cache-Control": PRIVATE_NO_STORE } });

/**
 * POST /account/events — a batch of the signed-in learner's queued progress events
 * (docs/phase-1a-defaults.md §8). The answer lists every ID acknowledged: applied, applied before,
 * or refused for good (malformed, or naming something the learner can't act on), so the player
 * removes them from its queue. Only then does it say they are saved. Without a learner session the
 * answer is 401 and the queue is kept.
 */
export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") return json(405, { error: "POST only" });
  if (!fromThisSite(request)) return json(403, { error: "Cross-site request refused" });
  const { env } = context.get(cloudflareContext);
  const learner = await getLearner(env, request);
  if (!learner) return json(401, { error: "Not signed in" });
  requireOwnRecords(learner, "learnerRecord.write");
  const body = await request.text();
  if (body.length > MAX_BATCH_LENGTH) return json(413, { error: "Too large" });
  let sent: unknown;
  try {
    sent = JSON.parse(body);
  } catch {
    return json(400, { error: "Not JSON" });
  }
  const batch = readProgressBatch(sent);
  if (!batch) return json(400, { error: "Not a batch of events" });
  const { refused } = await applyProgressEvents(learner.db, learner.userId, batch.events);
  return json(200, {
    acknowledged: [...batch.events.map((event) => event.id), ...batch.malformed],
    refused: [...refused, ...batch.malformed],
  });
}

/** Events are only ever sent, never read. */
export function loader() {
  return json(405, { error: "POST only" });
}
