import { cloudflareContext } from "~/lib/cloudflare";
import { completeUpload, uploadStatus } from "~/lib/media.server";
import { requireUploader } from "~/lib/media-access.server";
import type { Route } from "./+types/upload";

/** GET: where the upload has got to ({ status, partSize, partCount, received }), for resuming. */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireUploader(env, request);
  const status = await uploadStatus(db, actor.userId, params.id);
  if (!status) return Response.json({ error: "That upload doesn't exist." }, { status: 404 });
  return Response.json(status, { headers: { "Cache-Control": "no-store" } });
}

/** POST: every part has arrived; assemble the file in quarantine and queue its scan. */
export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireUploader(env, request);
  if (request.method !== "POST") return Response.json({ error: "Use POST." }, { status: 405 });
  const result = await completeUpload(env, db, actor.userId, params.id);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ id: result.value.id, status: "scanning" });
}
