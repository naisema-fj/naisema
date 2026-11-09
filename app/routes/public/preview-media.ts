import { eq } from "drizzle-orm";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { serveObject } from "~/lib/media.server";
import { downloadName } from "~/lib/media-rules";
import { readPreviewToken } from "~/lib/preview.server";
import { media, revision } from "~db/schema";
import type { Route } from "./+types/preview-media";

/**
 * GET /preview/:token/media/(images|files)/:id[/:width]: a media file the previewed Revision
 * shows, and only that, while the link lasts. Images are re-encoded as on the public site.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const read = await readPreviewToken(env.PREVIEW_SECRET, params.token);
  if (!read.ok) throw new Response("Not found", { status: 404 });
  const db = getDb(env.DB);
  const rev = await db.query.revision.findFirst({ where: eq(revision.id, read.revisionId) });
  if (!rev?.mediaIds.includes(params.id)) throw new Response("Not found", { status: 404 });
  const row = await db.query.media.findFirst({ where: eq(media.id, params.id) });
  if (!row) throw new Response("Not found", { status: 404 });
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
  if (params.type === "images" && row.kind === "image") {
    const original = await env.MEDIA.get(row.key);
    if (!original) throw new Response("Not found", { status: 404 });
    const width = Math.min(1440, Math.max(320, Number(params.width) || 960));
    const result = await env.IMAGES.input(original.body)
      .transform({ width, fit: "scale-down" })
      .output({ format: "image/webp" });
    return new Response(result.response().body, { headers: { ...headers, "Content-Type": "image/webp" } });
  }
  if (params.type === "files" && row.kind !== "image") {
    const response = await serveObject(
      env,
      request,
      row.key,
      row.contentType,
      row.kind === "document" ? downloadName(row.filename) : undefined,
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  throw new Response("Not found", { status: 404 });
}
