import { cloudflareContext } from "~/lib/cloudflare";
import { completeUpload, uploadStatus } from "~/lib/media.server";
import { requireLinkUpload } from "~/lib/upload-link-access.server";
import type { Route } from "./+types/upload-link-file";

/** GET: where a contributor's upload has got to, for resuming. */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, link } = await requireLinkUpload(env, params.token, params.id);
  const status = await uploadStatus(db, link.issuedBy, params.id);
  if (!status) return Response.json({ error: "That upload doesn't exist." }, { status: 404 });
  return Response.json(status, { headers: { "Cache-Control": "no-store" } });
}

/** POST: every part has arrived; assemble the file in quarantine and queue its scan. */
export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, link } = await requireLinkUpload(env, params.token, params.id);
  if (request.method !== "POST") return Response.json({ error: "Use POST." }, { status: 405 });
  const result = await completeUpload(env, db, link.issuedBy, params.id);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ id: result.value.id, status: "scanning" });
}
