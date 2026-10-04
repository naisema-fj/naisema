import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { fileDownload, publishableMedia } from "~/lib/media-delivery.server";
import { PUBLIC_CACHE_CONTROL } from "~/lib/public-cache.server";
import type { Route } from "./+types/file";

/**
 * GET /media/files/:id — a media library PDF, always as a download, sandboxed by its own content
 * security policy so it can never run in the site's origin (docs/phase-1a-defaults.md §1), while a
 * current Rights Record of its own grants Publish.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const asset = await publishableMedia(getDb(env.DB), params.id);
  if (asset?.type !== "application/pdf") throw new Response("Not found", { status: 404 });
  const response = await fileDownload(env, asset, PUBLIC_CACHE_CONTROL);
  if (!response) throw new Response("Not found", { status: 404 });
  return response;
}
