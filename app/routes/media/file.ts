import { eq } from "drizzle-orm";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { mediaIsPublic, serveObject } from "~/lib/media.server";
import { downloadName } from "~/lib/media-rules";
import { getStaff } from "~/lib/staff.server";
import { media } from "~db/schema";
import type { Route } from "./+types/file";

/**
 * GET /media/files/:id: audio and video, streamed with byte ranges so players can seek, and
 * documents as downloads. Public only while a Rights Record of its own grants Publish, asked on
 * every request; staff on the admin host see any.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const db = getDb(env.DB);
  const row = await db.query.media.findFirst({ where: eq(media.id, params.id) });
  if (!row || row.kind === "image") throw new Response("Not found", { status: 404 });
  const onAdminHost = new URL(request.url).hostname === env.ADMIN_HOSTNAME;
  const allowed = onAdminHost ? Boolean(await getStaff(env, request)) : await mediaIsPublic(db, row.id);
  if (!allowed) throw new Response("Not found", { status: 404 });
  return serveObject(
    env,
    request,
    row.key,
    row.contentType,
    row.kind === "document" ? downloadName(row.filename) : undefined,
  );
}
