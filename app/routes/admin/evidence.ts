import { eq } from "drizzle-orm";
import { rightsRecord } from "~db/schema";
import { audit } from "~/lib/audit.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { serveObject } from "~/lib/media.server";
import { requireStaff } from "~/lib/staff.server";
import type { Route } from "./+types/evidence";

/** GET /admin/rights/evidence/:recordId: a Rights Record's evidence, for editors only, as a download; every read is audited. */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireStaff(env, request, "rights.manage");
  const db = getDb(env.DB);
  const record = await db.query.rightsRecord.findFirst({ where: eq(rightsRecord.id, params.recordId) });
  if (!record?.evidenceKey) throw new Response("Not found", { status: 404 });
  const head = await env.MEDIA.head(record.evidenceKey);
  if (!head) throw new Response("Not found", { status: 404 });
  await audit(db, actor.email, "evidence.read", { type: record.subjectType, id: record.subjectId }, { record: record.id });
  const response = await serveObject(env, request, record.evidenceKey, head.httpMetadata?.contentType ?? "application/octet-stream", "evidence");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
