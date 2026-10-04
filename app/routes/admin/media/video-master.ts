import { eq } from "drizzle-orm";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireUploader } from "~/lib/media-access.server";
import { rangedResponse } from "~/lib/media-delivery.server";
import { getVideo } from "~/lib/video-assets.server";
import { localPlaybackAllowed } from "~/lib/video-provider.server";
import { mediaAsset } from "~db/schema";
import type { Route } from "./+types/video-master";

/**
 * GET /admin/media/:id/video/master?token= — the local stand-in's "playback" in development and
 * tests: the master itself, with byte ranges, for staff holding an unexpired token for this video.
 * Where Stream plays videos, masters are never served.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  if (env.VIDEO_PROVIDER !== "local") throw new Response("Not found", { status: 404 });
  const { db } = await requireUploader(env, request);
  const token = new URL(request.url).searchParams.get("token");
  if (!(await localPlaybackAllowed(env, params.id, token))) {
    throw new Response("This preview link has expired. Reload the video's page.", { status: 403 });
  }
  const video = await getVideo(db, params.id);
  const asset = video && (await db.select().from(mediaAsset).where(eq(mediaAsset.id, video.id)).get());
  const response =
    video?.state === "ready" && asset
      ? await rangedResponse(
          env.VIDEO_MASTERS,
          request,
          { id: video.id, destinationKey: video.masterKey, size: asset.size, type: asset.type },
          "private, no-store",
        )
      : null;
  if (!response) throw new Response("Not found", { status: 404 });
  return response;
}
