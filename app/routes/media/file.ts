import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { readyMedia } from "~/lib/media-delivery.server";
import { PUBLIC_CACHE_CONTROL } from "~/lib/public-cache.server";
import type { Route } from "./+types/file";

/**
 * GET /media/files/:id — a media library PDF, always as a download, sandboxed by its own content
 * security policy so it can never run in the site's origin (docs/phase-1a-defaults.md §1).
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const asset = await readyMedia(getDb(env.DB), params.id);
  if (asset?.type !== "application/pdf") throw new Response("Not found", { status: 404 });
  const file = await env.MEDIA.get(asset.destinationKey);
  if (!file) throw new Response("Not found", { status: 404 });
  const filename = asset.name.replace(/[^\w.-]+/g, "_");
  return new Response(file.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": PUBLIC_CACHE_CONTROL,
    },
  });
}
