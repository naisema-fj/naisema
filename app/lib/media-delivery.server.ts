import { and, desc, eq, inArray } from "drizzle-orm";
import { mediaAsset } from "~db/schema";
import type { Database } from "./db.server";
import { DOWNLOADABLE_TYPES, downloadName, UPLOAD_TYPE_NAMES } from "./upload-rules";

/**
 * Public delivery of media library files (docs/phase-1a-defaults.md §1). Only files that passed
 * their scan are served. Images are re-encoded through Cloudflare Images at a fixed set of widths,
 * which strips their metadata (location included) and neutralises malformed image payloads; PDFs
 * are downloads that never open in the site's origin. A Resource's file (PDF or audio) is downloaded
 * through its Resource, which checks eligibility first. Other audio and video are delivered by
 * their own players later (Voices #25, video #16).
 *
 * Note: a media asset's own Rights Records arrive later (the library shows a placeholder); until
 * then a ready file is served to anyone with its unguessable address.
 */

/** The widths images are served at, for `srcset`. */
export const IMAGE_WIDTHS = [320, 640, 960, 1280, 1920] as const;

export const imagePath = (id: string, width: number) => `/media/images/${id}/${width}`;
export const filePath = (id: string) => `/media/files/${id}`;

/** A media library file that has passed its scan, or null. */
export function readyMedia(db: Database, id: string) {
  return db
    .select()
    .from(mediaAsset)
    .where(and(eq(mediaAsset.id, id), eq(mediaAsset.purpose, "media"), eq(mediaAsset.status, "ready")))
    .get();
}

/** A media library file a Resource can offer: a PDF or audio file that has passed its scan. */
const isReadyDownload = and(
  eq(mediaAsset.purpose, "media"),
  eq(mediaAsset.status, "ready"),
  inArray(mediaAsset.type, [...DOWNLOADABLE_TYPES]),
);

/** A file a Resource can offer, or undefined. */
export function readyDownload(db: Database, id: string) {
  return db
    .select()
    .from(mediaAsset)
    .where(and(eq(mediaAsset.id, id), isReadyDownload))
    .get();
}

/** The files a Resource can offer, newest first, for the form's file choice. */
export async function downloadChoices(db: Database) {
  const files = await db
    .select({ id: mediaAsset.id, name: mediaAsset.name, type: mediaAsset.type })
    .from(mediaAsset)
    .where(isReadyDownload)
    .orderBy(desc(mediaAsset.createdAt));
  return files.map((file) => ({ id: file.id, name: file.name, typeName: UPLOAD_TYPE_NAMES[file.type] }));
}

/**
 * A ready file as a download, sandboxed by its own content security policy so it can never run in
 * the site's origin (docs/phase-1a-defaults.md §1). Null if the stored object is missing.
 */
export async function fileDownload(
  env: Env,
  asset: { destinationKey: string; name: string; type: string },
  cacheControl: string,
) {
  const file = await env.MEDIA.get(asset.destinationKey);
  if (!file) return null;
  return new Response(file.body, {
    headers: {
      "Content-Type": asset.type,
      "Content-Disposition": `attachment; filename="${downloadName(asset.name)}"`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": cacheControl,
    },
  });
}

/**
 * An image, re-encoded as WebP at one of IMAGE_WIDTHS (never wider than the original). WebP output
 * carries no EXIF or other metadata, so location and camera details are dropped.
 */
export async function transformedImage(env: Env, key: string, width: number) {
  const original = await env.MEDIA.get(key);
  if (!original) return null;
  const result = await env.IMAGES.input(original.body)
    .transform({ width, fit: "scale-down" })
    .output({ format: "image/webp", quality: 82 });
  return result.response();
}
