import { and, eq } from "drizzle-orm";
import { mediaAsset } from "~db/schema";
import type { Database } from "./db.server";

/**
 * Public delivery of media library files (docs/phase-1a-defaults.md §1). Only files that passed
 * their scan are served. Images are re-encoded through Cloudflare Images at a fixed set of widths,
 * which strips their metadata (location included) and neutralises malformed image payloads; PDFs
 * are downloads that never open in the site's origin. Audio and video are delivered by their own
 * players later (Voices #25, video #16).
 *
 * Note: a media asset's own Rights Records arrive later (the library shows a placeholder); until
 * then a ready file is served to anyone with its unguessable address.
 */

/** The widths images are served at, for `srcset`. */
export const IMAGE_WIDTHS = [320, 640, 960, 1280, 1920] as const;

export const imagePath = (id: string, width: number) => `/media/images/${id}/${width}`;
export const imageSrcSet = (id: string) => IMAGE_WIDTHS.map((width) => `${imagePath(id, width)} ${width}w`).join(", ");
export const filePath = (id: string) => `/media/files/${id}`;

/** A ready media library file of one of the given types, or null. */
export function readyMedia(db: Database, id: string) {
  return db
    .select()
    .from(mediaAsset)
    .where(and(eq(mediaAsset.id, id), eq(mediaAsset.purpose, "media"), eq(mediaAsset.status, "ready")))
    .get();
}

/** An image, re-encoded as WebP at one of IMAGE_WIDTHS (never wider than the original). */
export async function transformedImage(env: Env, key: string, width: number) {
  const original = await env.MEDIA.get(key);
  if (!original) return null;
  const result = await env.IMAGES.input(original.body)
    .transform({ width, fit: "scale-down" })
    .output({ format: "image/webp", quality: 82 });
  return result.response();
}
