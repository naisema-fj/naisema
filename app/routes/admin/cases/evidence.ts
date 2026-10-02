import { readCaseEvidence, requireCaseTeam } from "~/lib/cases.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { downloadName } from "~/lib/upload-rules";
import type { Route } from "./+types/evidence";

/**
 * A Case's restricted evidence, downloaded by its case team. Never shown inline or cached, and
 * sandboxed, like Rights Record evidence; every download is audited.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireCaseTeam(env, request, params.id);
  const evidence = await readCaseEvidence(env, db, actor, params.id, params.assetId);
  if (!evidence) throw new Response("Not found", { status: 404 });
  if ("unavailable" in evidence) {
    return new Response(evidence.unavailable, {
      status: 409,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
    });
  }
  return new Response(evidence.object.body, {
    headers: {
      "Content-Type": evidence.type,
      "Content-Disposition": `attachment; filename="${downloadName(evidence.name)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
