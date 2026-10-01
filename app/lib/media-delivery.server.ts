import { and, desc, eq, inArray } from "drizzle-orm";
import { mediaAsset } from "~db/schema";
import { parseRange } from "./byte-range";
import type { Database } from "./db.server";
import {
  DOWNLOADABLE_TYPES,
  downloadName,
  EPISODE_AUDIO_TYPES,
  UPLOAD_TYPE_NAMES,
  type UploadType,
} from "./upload-rules";

/**
 * Public delivery of media library files (docs/phase-1a-defaults.md §1). Only files that passed
 * their scan are served. Images are re-encoded through Cloudflare Images at a fixed set of widths,
 * which strips their metadata (location included) and neutralises malformed image payloads; PDFs
 * are downloads that never open in the site's origin. A Resource's file (PDF or audio) is downloaded
 * through its Resource, and an Episode's audio is streamed through its Episode, each checking
 * eligibility first. Video is delivered by its own player later (#16).
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

/** A media library file of one of these types that has passed its scan. */
const isReadyOf = (types: readonly UploadType[]) =>
  and(eq(mediaAsset.purpose, "media"), eq(mediaAsset.status, "ready"), inArray(mediaAsset.type, [...types]));

function readyOf(db: Database, id: string, types: readonly UploadType[]) {
  return db
    .select()
    .from(mediaAsset)
    .where(and(eq(mediaAsset.id, id), isReadyOf(types)))
    .get();
}

/** Ready files of these types, newest first, for a form's file choice. */
async function choicesOf(db: Database, types: readonly UploadType[]) {
  const files = await db
    .select({ id: mediaAsset.id, name: mediaAsset.name, type: mediaAsset.type })
    .from(mediaAsset)
    .where(isReadyOf(types))
    .orderBy(desc(mediaAsset.createdAt));
  return files.map((file) => ({ id: file.id, name: file.name, typeName: UPLOAD_TYPE_NAMES[file.type] }));
}

/** A file a Resource can offer (a PDF or audio file that has passed its scan), or undefined. */
export const readyDownload = (db: Database, id: string) => readyOf(db, id, DOWNLOADABLE_TYPES);
export const downloadChoices = (db: Database) => choicesOf(db, DOWNLOADABLE_TYPES);

/** The audio an Episode can play (an MP3 or M4A that has passed its scan), or undefined. */
export const readyEpisodeAudio = (db: Database, id: string) => readyOf(db, id, EPISODE_AUDIO_TYPES);
export const episodeAudioChoices = (db: Database) => choicesOf(db, EPISODE_AUDIO_TYPES);

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
 * Audio for a native `<audio>` player, with byte ranges so it starts at once and can seek. The
 * caller has already decided the visitor may hear it. A media library file never changes once
 * scanned, so its ID is its validator: an `If-Range` naming another version gets the whole file.
 */
export async function audioResponse(
  env: Env,
  request: Request,
  asset: { id: string; destinationKey: string; size: number; type: string },
  cacheControl: string,
) {
  const etag = `"${asset.id}"`;
  const ifRange = request.headers.get("If-Range");
  const headers = new Headers({
    ETag: etag,
    "Content-Type": asset.type,
    "Content-Disposition": "inline",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl,
  });
  const range = ifRange && ifRange !== etag ? null : parseRange(request.headers.get("Range"), asset.size);
  if (range === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${asset.size}`);
    return new Response(null, { status: 416, headers });
  }
  const file = await env.MEDIA.get(asset.destinationKey, range ? { range } : {});
  if (!file) return null;
  if (!range) {
    headers.set("Content-Length", String(asset.size));
    return new Response(file.body, { headers });
  }
  headers.set("Content-Length", String(range.length));
  headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${asset.size}`);
  return new Response(file.body, { status: 206, headers });
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
