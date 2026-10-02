import { cloudflareContext } from "~/lib/cloudflare";
import { startUpload } from "~/lib/media.server";
import { decodeHead } from "~/lib/upload-head";
import { requireUploadLink } from "~/lib/upload-link-access.server";
import { uploadLinkFile } from "~db/schema";
import type { Route } from "./+types/upload-link-files";

/**
 * POST { name, type, size, head }: starts a contributor's upload into quarantine through their
 * upload link, checked like any upload (docs/phase-1a-defaults.md §1). Answers { id, partSize, partCount }.
 */
export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, link } = await requireUploadLink(env, params.token);
  if (request.method !== "POST") return Response.json({ error: "Use POST." }, { status: 405 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const file = {
    name: typeof body?.name === "string" ? body.name : "",
    type: typeof body?.type === "string" ? body.type : "",
    size: typeof body?.size === "number" ? body.size : 0,
    head: decodeHead(body?.head),
  };
  const result = await startUpload(env, db, link.issuedBy, file, "submission");
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  await db.insert(uploadLinkFile).values({ assetId: result.value.id, linkId: link.id });
  return Response.json(result.value, { status: 201 });
}
