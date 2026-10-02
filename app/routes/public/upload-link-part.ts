import { cloudflareContext } from "~/lib/cloudflare";
import { PART_SIZE, uploadPart } from "~/lib/media.server";
import { readLimitedBytes, UploadTooLarge } from "~/lib/upload-limit.server";
import { requireLinkUpload } from "~/lib/upload-link-access.server";
import type { Route } from "./+types/upload-link-part";

/** PUT the bytes of one part of a contributor's upload. */
export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, link } = await requireLinkUpload(env, params.token, params.id);
  if (request.method !== "PUT") return Response.json({ error: "Use PUT." }, { status: 405 });
  let bytes: Uint8Array;
  try {
    bytes = await readLimitedBytes(request, PART_SIZE);
  } catch (error) {
    if (!(error instanceof UploadTooLarge)) throw error;
    return Response.json({ error: "That part is too large." }, { status: 413 });
  }
  const result = await uploadPart(env, db, link.issuedBy, params.id, Number(params.number), bytes);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.value);
}
