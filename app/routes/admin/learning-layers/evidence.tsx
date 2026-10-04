import { cloudflareContext } from "~/lib/cloudflare";
import { readApprovalEvidence } from "~/lib/layer-review.server";
import { requireStaff } from "~/lib/staff.server";
import { downloadName } from "~/lib/upload-rules";
import type { Route } from "./+types/evidence";

/**
 * The private evidence of a Knowledge Holder Approval, downloaded by an editor. Never shown inline
 * or cached, and sandboxed, like rights evidence (docs/phase-1a-defaults.md §1).
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireStaff(env, request);
  const evidence = await readApprovalEvidence(env, db, actor, params.approvalId);
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
