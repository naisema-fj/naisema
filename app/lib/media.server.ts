import { and, asc, desc, eq } from "drizzle-orm";
import { mediaAsset, mediaUploadPart } from "~db/schema";
import { auditInsert } from "./audit.server";
import type { Database } from "./db.server";
import {
  checkContent,
  checkDeclared,
  HEAD_BYTES,
  storedName,
  type UploadPurpose,
  type UploadType,
} from "./upload-rules";
import { isVideoMaster, MASTERS_PREFIX } from "./video-assets.server";

/**
 * Uploads (docs/phase-1a-defaults.md §1, ADR-0010). A file is checked against the allowlist, and
 * its first bytes against its type, before anything is stored. It then arrives in parts, a
 * resumable R2 multipart upload into the private quarantine bucket, and once complete is queued
 * for a ClamAV scan (app/lib/scan.server.ts). Nothing else reads quarantine.
 */

/** Every part but the last is exactly this size; R2 needs at least 5 MiB. */
export const PART_SIZE = 10 * 1024 * 1024;

export type MediaAsset = typeof mediaAsset.$inferSelect;

export const partCount = (size: number) => Math.max(1, Math.ceil(size / PART_SIZE));
const expectedPartSize = (size: number, partNumber: number) =>
  partNumber < partCount(size) ? PART_SIZE : size - PART_SIZE * (partCount(size) - 1);

const quarantineKey = (id: string) => `uploads/${id}`;
/** Where a clean file is copied: a video master into VIDEO_MASTERS (MASTERS_PREFIX), the rest by purpose. */
const destinationKey = (purpose: UploadPurpose, id: string, type: UploadType) =>
  isVideoMaster({ purpose, type }) ? `${MASTERS_PREFIX}${id}` : `${purpose}/${id}`;

export type UploadResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const refuse = (status: number, error: string): UploadResult<never> => ({ ok: false, status, error });

/** The scan request a finished upload sends; the consumer only trusts the asset's own row. */
export type ScanMessage = { assetId: string };

/** Abandons an R2 multipart upload; one that is already gone needs nothing more. */
export function abortMultipart(env: Env, asset: Pick<MediaAsset, "quarantineKey" | "multipartUploadId">) {
  if (!asset.multipartUploadId) return Promise.resolve();
  return env.QUARANTINE.resumeMultipartUpload(asset.quarantineKey, asset.multipartUploadId)
    .abort()
    .catch(() => undefined);
}

/**
 * Starts an upload once its name, declared type and size pass the allowlist and its first bytes
 * (sent with the request) match its type, so a refused file is never stored at all.
 */
export async function startUpload(
  env: Env,
  db: Database,
  uploadedBy: string,
  file: { name: string; type: string; size: number; head: Uint8Array },
  purpose: UploadPurpose = "media",
): Promise<UploadResult<{ id: string; partSize: number; partCount: number }>> {
  const declared = checkDeclared(file, purpose);
  if (!declared.ok) return refuse(400, declared.error);
  const content = checkContent(declared.type, file.head.subarray(0, HEAD_BYTES));
  if (!content.ok) return refuse(400, content.error);
  const id = crypto.randomUUID();
  const upload = await env.QUARANTINE.createMultipartUpload(quarantineKey(id), {
    httpMetadata: { contentType: declared.type },
  });
  const now = new Date();
  await db.batch([
    db.insert(mediaAsset).values({
      id,
      purpose,
      type: declared.type,
      name: storedName(file.name),
      size: file.size,
      status: "uploading",
      quarantineKey: quarantineKey(id),
      multipartUploadId: upload.uploadId,
      destinationKey: destinationKey(purpose, id, declared.type),
      uploadedBy,
      createdAt: now,
      updatedAt: now,
    }),
    auditInsert(db, {
      actorId: uploadedBy,
      action: "media_asset.upload_started",
      objectType: "media_asset",
      objectId: id,
      details: { purpose, type: declared.type, size: file.size },
    }),
  ]);
  return { ok: true, value: { id, partSize: PART_SIZE, partCount: partCount(file.size) } };
}

/** The uploader's own asset that is still arriving, or why it can't take more parts. */
async function uploadingAsset(db: Database, uploadedBy: string, assetId: string) {
  const asset = await db.select().from(mediaAsset).where(eq(mediaAsset.id, assetId)).get();
  if (!asset || asset.uploadedBy !== uploadedBy) return refuse(404, "That upload doesn't exist.");
  if (asset.status !== "uploading" || !asset.multipartUploadId) {
    return refuse(409, asset.statusReason ?? "That upload has already finished.");
  }
  return { ok: true as const, value: { ...asset, multipartUploadId: asset.multipartUploadId } };
}

/** Refuses an upload with a reason staff can read, abandoning what was received. */
async function failUpload(env: Env, db: Database, asset: MediaAsset, reason: string, actorId: string) {
  await abortMultipart(env, asset);
  const now = new Date();
  await db.batch([
    db
      .update(mediaAsset)
      .set({ status: "failed", statusReason: reason, multipartUploadId: null, scannedAt: now, updatedAt: now })
      .where(eq(mediaAsset.id, asset.id)),
    db.delete(mediaUploadPart).where(eq(mediaUploadPart.assetId, asset.id)),
    auditInsert(db, {
      actorId,
      action: "media_asset.failed",
      objectType: "media_asset",
      objectId: asset.id,
      details: { reason },
    }),
  ]);
}

/**
 * Receives one part. The first part's leading bytes are checked again, as they actually arrived,
 * before the rest of the file is accepted.
 */
export async function uploadPart(
  env: Env,
  db: Database,
  uploadedBy: string,
  assetId: string,
  partNumber: number,
  bytes: Uint8Array,
): Promise<UploadResult<{ partNumber: number }>> {
  const found = await uploadingAsset(db, uploadedBy, assetId);
  if (!found.ok) return found;
  const asset = found.value;
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > partCount(asset.size)) {
    return refuse(400, "That part doesn't belong to this upload.");
  }
  if (bytes.byteLength !== expectedPartSize(asset.size, partNumber)) {
    return refuse(400, "That part is the wrong size. Start the upload again.");
  }
  if (partNumber === 1) {
    const content = checkContent(asset.type, bytes.subarray(0, HEAD_BYTES));
    if (!content.ok) {
      await failUpload(env, db, asset, content.error, uploadedBy);
      return refuse(400, content.error);
    }
  }
  const part = await env.QUARANTINE.resumeMultipartUpload(asset.quarantineKey, asset.multipartUploadId).uploadPart(
    partNumber,
    bytes,
  );
  await db.batch([
    db
      .insert(mediaUploadPart)
      .values({ assetId, partNumber, etag: part.etag, size: bytes.byteLength })
      .onConflictDoUpdate({
        target: [mediaUploadPart.assetId, mediaUploadPart.partNumber],
        set: { etag: part.etag, size: bytes.byteLength },
      }),
    db.update(mediaAsset).set({ updatedAt: new Date() }).where(eq(mediaAsset.id, assetId)),
  ]);
  return { ok: true, value: { partNumber } };
}

/** Where an upload has got to, so the uploader's browser can resume it with the missing parts. */
export async function uploadStatus(db: Database, uploadedBy: string, assetId: string) {
  const asset = await db.select().from(mediaAsset).where(eq(mediaAsset.id, assetId)).get();
  if (!asset || asset.uploadedBy !== uploadedBy) return null;
  const parts = await db
    .select({ partNumber: mediaUploadPart.partNumber })
    .from(mediaUploadPart)
    .where(eq(mediaUploadPart.assetId, assetId))
    .orderBy(asc(mediaUploadPart.partNumber));
  return {
    id: asset.id,
    status: asset.status,
    statusReason: asset.statusReason,
    partSize: PART_SIZE,
    partCount: partCount(asset.size),
    received: parts.map((part) => part.partNumber),
  };
}

/** Assembles a fully received upload in quarantine and queues it for a scan. */
export async function completeUpload(
  env: Env,
  db: Database,
  uploadedBy: string,
  assetId: string,
): Promise<UploadResult<{ id: string }>> {
  const found = await uploadingAsset(db, uploadedBy, assetId);
  if (!found.ok) return found;
  const asset = found.value;
  const parts = await db
    .select()
    .from(mediaUploadPart)
    .where(eq(mediaUploadPart.assetId, assetId))
    .orderBy(asc(mediaUploadPart.partNumber));
  const total = parts.reduce((sum, part) => sum + part.size, 0);
  if (parts.length !== partCount(asset.size) || total !== asset.size) {
    return refuse(409, "Some of the file hasn't arrived yet. Resume the upload to send the rest.");
  }
  try {
    await env.QUARANTINE.resumeMultipartUpload(asset.quarantineKey, asset.multipartUploadId).complete(
      parts.map((part) => ({ partNumber: part.partNumber, etag: part.etag })),
    );
  } catch (error) {
    // A retry after an earlier completion whose follow-up failed: the file is already assembled.
    const assembled = await env.QUARANTINE.head(asset.quarantineKey);
    if (assembled?.size !== asset.size) throw error;
  }
  await queueScan(env, db, asset.id, uploadedBy);
  return { ok: true, value: { id: asset.id } };
}

/**
 * Stores a small file in quarantine in one go, as Rights Record evidence arrives with its form,
 * and queues it for a scan. The caller has already checked it with checkDeclared/checkContent.
 */
export async function quarantineFile(
  env: Env,
  db: Database,
  uploadedBy: string,
  file: { name: string; type: UploadType; bytes: Uint8Array },
  purpose: UploadPurpose,
): Promise<{ id: string; destinationKey: string }> {
  const id = crypto.randomUUID();
  await env.QUARANTINE.put(quarantineKey(id), file.bytes, { httpMetadata: { contentType: file.type } });
  const now = new Date();
  await db.insert(mediaAsset).values({
    id,
    purpose,
    type: file.type,
    name: storedName(file.name),
    size: file.bytes.byteLength,
    status: "uploading",
    quarantineKey: quarantineKey(id),
    destinationKey: destinationKey(purpose, id, file.type),
    uploadedBy,
    createdAt: now,
    updatedAt: now,
  });
  await queueScan(env, db, id, uploadedBy);
  return { id, destinationKey: destinationKey(purpose, id, file.type) };
}

/** Marks an asset as waiting for its scan and sends the scan request. */
async function queueScan(env: Env, db: Database, assetId: string, actorId: string) {
  await db.batch([
    db
      .update(mediaAsset)
      .set({ status: "scanning", multipartUploadId: null, updatedAt: new Date() })
      .where(eq(mediaAsset.id, assetId)),
    db.delete(mediaUploadPart).where(eq(mediaUploadPart.assetId, assetId)),
    auditInsert(db, {
      actorId,
      action: "media_asset.uploaded",
      objectType: "media_asset",
      objectId: assetId,
    }),
  ]);
  // If this send is lost, the daily job queues the scan again (tidyQuarantine).
  await env.UPLOAD_SCANS.send({ assetId } satisfies ScanMessage);
}

/** The media library: every media upload, newest first, whatever its state. */
export function listMedia(db: Database) {
  return db.select().from(mediaAsset).where(eq(mediaAsset.purpose, "media")).orderBy(desc(mediaAsset.createdAt));
}

/** Sets a ready image's alt text, which describes it for people who can't see it. */
export async function setAltText(db: Database, actorId: string, assetId: string, altText: string) {
  const text = altText.trim().slice(0, 500);
  const asset = await db
    .select({ id: mediaAsset.id })
    .from(mediaAsset)
    .where(and(eq(mediaAsset.id, assetId), eq(mediaAsset.purpose, "media"), eq(mediaAsset.status, "ready")))
    .get();
  if (!asset) return false;
  await db.batch([
    db.update(mediaAsset).set({ altText: text, updatedAt: new Date() }).where(eq(mediaAsset.id, assetId)),
    auditInsert(db, {
      actorId,
      action: "media_asset.alt_text_set",
      objectType: "media_asset",
      objectId: assetId,
    }),
  ]);
  return true;
}

/** A media library file's name, for staff pages that show which file an item uses. */
export async function mediaName(db: Database, id: string | null) {
  if (!id) return null;
  const row = await db.select({ name: mediaAsset.name }).from(mediaAsset).where(eq(mediaAsset.id, id)).get();
  return row?.name ?? null;
}
