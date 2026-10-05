import { cloudflareContext } from "~/lib/cloudflare";
import { exportLearnerData } from "~/lib/learner-progress.server";
import { requireLearner, requireOwnRecords } from "~/lib/learners.server";
import { PRIVATE_NO_STORE } from "~/lib/public-cache.server";
import type { Route } from "./+types/export";

/** GET /account/export — everything the learner's account holds, as a JSON file to keep (DATA-01). */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const learner = await requireLearner(env, request);
  requireOwnRecords(learner, "learnerRecord.export");
  const exported = await exportLearnerData(learner.db, learner.userId);
  return new Response(JSON.stringify(exported, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="na-isema-learning-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": PRIVATE_NO_STORE,
    },
  });
}
