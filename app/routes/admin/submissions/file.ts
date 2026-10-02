import { cloudflareContext } from "~/lib/cloudflare";
import { requireSubmissionManager, submissionFile } from "~/lib/submissions.server";
import { downloadName } from "~/lib/upload-rules";
import type { Route } from "./+types/file";

/** A contributor's file that passed its scan, downloaded by staff from private storage. */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { db } = await requireSubmissionManager(env, request);
  const asset = await submissionFile(db, params.id, params.assetId);
  const object = asset ? await env.EVIDENCE.get(asset.destinationKey) : null;
  if (!asset || !object) throw new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": asset.type,
      "Content-Disposition": `attachment; filename="${downloadName(asset.name)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
