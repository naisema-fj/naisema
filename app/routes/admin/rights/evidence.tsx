import { cloudflareContext } from "~/lib/cloudflare";
import { can } from "~/lib/permissions";
import { readEvidence } from "~/lib/rights.server";
import { requireStaff } from "~/lib/staff.server";
import type { Route } from "./+types/evidence";

/**
 * Rights evidence, downloaded by an editor. Never shown inline or cached, and sandboxed, so a file
 * can't run anything on the admin site even if its bytes misbehave (docs/phase-1a-defaults.md §1).
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireStaff(env, request);
  if (!can(actor, { action: "rightsEvidence.read" })) {
    throw new Response("Only editors can read rights evidence.", { status: 403 });
  }
  const evidence = await readEvidence(env, db, actor.userId, params.recordId);
  if (!evidence) throw new Response("Not found", { status: 404 });
  if ("unavailable" in evidence) {
    return new Response(evidence.unavailable, {
      status: 409,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
    });
  }
  const filename = evidence.name.replace(/[^\w.-]+/g, "_");
  return new Response(evidence.object.body, {
    headers: {
      "Content-Type": evidence.type,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
