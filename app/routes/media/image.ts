import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { IMAGE_WIDTHS, readyMedia, transformedImage } from "~/lib/media-delivery.server";
import { PUBLIC_CACHE_CONTROL } from "~/lib/public-cache.server";
import type { Route } from "./+types/image";

/** GET /media/images/:id/:width — a media library image, re-encoded through Cloudflare Images. */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const width = Number(params.width);
  if (!(IMAGE_WIDTHS as readonly number[]).includes(width)) throw new Response("Not found", { status: 404 });
  const asset = await readyMedia(getDb(env.DB), params.id);
  if (!asset?.type.startsWith("image/")) throw new Response("Not found", { status: 404 });
  const image = await transformedImage(env, asset.destinationKey, width);
  if (!image) throw new Response("Not found", { status: 404 });
  return new Response(image.body, {
    headers: {
      "Content-Type": image.headers.get("Content-Type") ?? "image/webp",
      "Cache-Control": PUBLIC_CACHE_CONTROL,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
