import { eq } from "drizzle-orm";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { mediaIsPublic } from "~/lib/media.server";
import { getStaff } from "~/lib/staff.server";
import { media } from "~db/schema";
import type { Route } from "./+types/image";

const WIDTHS = [320, 640, 960, 1440];

/**
 * GET /media/images/:id/:width: an image, re-encoded by Cloudflare Images (which strips its
 * metadata, location included). Public only while a Rights Record of its own grants Publish; staff
 * on the admin host see any.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const width = Number(params.width);
  if (!WIDTHS.includes(width)) throw new Response("Not found", { status: 404 });
  const db = getDb(env.DB);
  const row = await db.query.media.findFirst({ where: eq(media.id, params.id) });
  if (row?.kind !== "image") throw new Response("Not found", { status: 404 });
  const onAdminHost = new URL(request.url).hostname === env.ADMIN_HOSTNAME;
  const allowed = onAdminHost ? Boolean(await getStaff(env, request)) : await mediaIsPublic(db, row.id);
  if (!allowed) throw new Response("Not found", { status: 404 });
  const original = await env.MEDIA.get(row.key);
  if (!original) throw new Response("Not found", { status: 404 });
  const result = await env.IMAGES.input(original.body)
    .transform({ width, fit: "scale-down" })
    .output({ format: "image/webp", quality: 82 });
  const image = result.response();
  return new Response(image.body, {
    headers: {
      "Content-Type": image.headers.get("Content-Type") ?? "image/webp",
      "Cache-Control": "private, no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
