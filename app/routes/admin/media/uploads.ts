import { cloudflareContext } from "~/lib/cloudflare";
import { startUpload } from "~/lib/media.server";
import { requireUploader } from "~/lib/media-access.server";
import type { Route } from "./+types/uploads";

/**
 * POST { name, type, size }: starts an upload into quarantine once the file passes the allowlist
 * (docs/phase-1a-defaults.md §1). Answers { id, partSize, partCount }.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireUploader(env, request);
  if (request.method !== "POST") return Response.json({ error: "Use POST." }, { status: 405 });
  const body = (await request.json().catch(() => null)) as { name?: unknown; type?: unknown; size?: unknown } | null;
  const file = {
    name: typeof body?.name === "string" ? body.name : "",
    type: typeof body?.type === "string" ? body.type : "",
    size: typeof body?.size === "number" ? body.size : 0,
  };
  const result = await startUpload(env, db, actor.userId, file);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.value, { status: 201 });
}
