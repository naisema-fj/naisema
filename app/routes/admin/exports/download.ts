import { cloudflareContext } from "~/lib/cloudflare";
import { runExport } from "~/lib/exports.server";
import { EXPORT_KINDS, type ExportKind } from "~/lib/permissions";
import { PRIVATE_NO_STORE } from "~/lib/public-cache.server";
import { requireStaff } from "~/lib/staff.server";
import type { Route } from "./+types/download";

const isExportKind = (value: string): value is ExportKind => (EXPORT_KINDS as readonly string[]).includes(value);

/**
 * POST /admin/exports/download — one bulk export as a JSON file (app/lib/exports.server.ts). A post,
 * not a link, because every export is audited; never cached.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const { db, actor } = await requireStaff(context.get(cloudflareContext).env, request);
  const form = await request.formData();
  const kind = String(form.get("kind") ?? "");
  if (!isExportKind(kind)) throw new Response("There is no such export.", { status: 400 });
  const result = await runExport(db, actor, {
    kind,
    purpose: String(form.get("purpose") ?? ""),
    learningLayerId: String(form.get("learningLayerId") ?? ""),
  });
  if (!result.ok) {
    return new Response(result.error, {
      status: result.status,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": PRIVATE_NO_STORE },
    });
  }
  return new Response(JSON.stringify(result.document, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": PRIVATE_NO_STORE,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
