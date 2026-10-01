import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { mediaAsset, mediaUploadPart } from "~db/schema";
import { auditInsert } from "./audit.server";
import type { Database } from "./db.server";
import { checkContent, checkDeclared, type UploadPurpose, type UploadType } from "./upload-rules";

/**
 * Uploads (docs/phase-1a-defaults.md §1, ADR-0010). A file is checked against the allowlist
 * before anything is sent, then arrives in parts, a resumable R2 multipart upload into the private
 * quarantine bucket. Its first part must match its type. Once complete it is queued for a ClamAV
 * scan (app/lib/scan.server.ts); nothing else reads quarantine.
 */

/** Every part but the last is exactly this size; R2 needs at least 5 MiB. */
export const PART_SIZE = 10 * 1024 * 1024;

/** How many leading bytes the content check reads. */
const HEAD_BYTES = 16;

export type MediaAsset = typeof mediaAsset.$inferSelect;
export type MediaStatus = "uploading" | "scanning" | "ready" | "infected" | "failed" | "removed";

export const partCount = (size: number) => Math.max(1, Math.ceil(size / PART_SIZE));
const expectedPartSize = (size: number, partNumber: number) =>
  partNumber < partCount(size) ? PART_SIZE : size - PART_SIZE * (partCount(size) - 1);

const destinationKey = (purpose: UploadPurpose, id: string) => `${purpose}/${id}`;

export type UploadResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const refuse = (status: number, error: string): UploadResult<never> => ({ ok: false, status, error });

/** The scan request a finished upload sends; the consumer only trusts the asset's own row. */
export type ScanMessage = { assetId: string };

/** Starts an upload after checking its name, declared type and size against the allowlist. */
export async function startUpload(
  env: Env,
  db: Database,
  uploadedBy: string,
  file: { name: string; type: string; size: number },
  purpose: UploadPurpose = "media",
): Promise<UploadResult<{ id: string; partSize: number; partCount: number }>> {
  const declared = checkDeclared(file, purpose);
  if (!declared.ok) return refuse(400, declared.error);
  const id = crypto.randomUUID();
  const quarantineKey = `uploads/${id}`;
  const upload = await env.QUARANTINE.createMultipartUpload(quarantineKey, {
    httpMetadata: { contentType: declared.type },
  });
  const now = new Date();
  await db.batch([
    db.insert(mediaAsset).values({
      id,
      purpose,
      type: declared.type,
      name: file.name.slice(0, 200),
      size: file.size,
      status: "uploading",
      quarantineKey,
      multipartUploadId: upload.uploadId,
      destinationKey: destinationKey(purpose, id),
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

/** Marks an upload failed with a reason staff can read, abandoning what was received. */
async function failUpload(env: Env, db: Database, asset: MediaAsset, reason: string, actorId: string) {
  if (asset.multipartUploadId) {
    await env.QUARANTINE.resumeMultipartUpload(asset.quarantineKey, asset.multipartUploadId)
      .abort()
      .catch(() => undefined);
  }
  await db.batch([
    db
      .update(mediaAsset)
      .set({ status: "failed", statusReason: reason, multipartUploadId: null, updatedAt: new Date() })
      .where(eq(mediaAsset.id, asset.id)),
    db.delete(mediaUploadPart).where(eq(mediaUploadPart.assetId, asset.id)),
    auditInsert(db, {
      actorId,
      action: "media_asset.refused",
      objectType: "media_asset",
      objectId: asset.id,
      details: { reason },
    }),
  ]);
}

/**
 * Receives one part. The first part's leading bytes must match the file's type, so a renamed
 * executable is refused before the rest of it is accepted.
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
    const content = checkContent(asset.type as UploadType, bytes.subarray(0, HEAD_BYTES));
    if (!content.ok) {
      await failUpload(env, db, asset, content.error, uploadedBy);
      return refuse(400, content.error);
    }
  }
  const part = await env.QUARANTINE.resumeMultipartUpload(asset.quarantineKey, asset.multipartUploadId).uploadPart(
    partNumber,
    bytes,
  );
  await db
    .insert(mediaUploadPart)
    .values({ assetId, partNumber, etag: part.etag, size: bytes.byteLength })
    .onConflictDoUpdate({
      target: [mediaUploadPart.assetId, mediaUploadPart.partNumber],
      set: { etag: part.etag, size: bytes.byteLength },
    });
  await db.update(mediaAsset).set({ updatedAt: new Date() }).where(eq(mediaAsset.id, assetId));
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
    status: asset.status as MediaStatus,
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
  await env.QUARANTINE.resumeMultipartUpload(asset.quarantineKey, asset.multipartUploadId).complete(
    parts.map((part) => ({ partNumber: part.partNumber, etag: part.etag })),
  );
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
): Promise<string> {
  const id = crypto.randomUUID();
  const quarantineKey = `uploads/${id}`;
  await env.QUARANTINE.put(quarantineKey, file.bytes, { httpMetadata: { contentType: file.type } });
  const now = new Date();
  await db.insert(mediaAsset).values({
    id,
    purpose,
    type: file.type,
    name: file.name.slice(0, 200),
    size: file.bytes.byteLength,
    status: "uploading",
    quarantineKey,
    destinationKey: destinationKey(purpose, id),
    uploadedBy,
    createdAt: now,
    updatedAt: now,
  });
  await queueScan(env, db, id, uploadedBy);
  return id;
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
  // If this send is lost, the daily job queues the scan again (requeueStalledScans).
  await env.UPLOAD_SCANS.send({ assetId } satisfies ScanMessage);
}

/** The media library: every media upload, newest first, whatever its state. */
export function listMedia(db: Database) {
  return db.select().from(mediaAsset).where(eq(mediaAsset.purpose, "media")).orderBy(desc(mediaAsset.createdAt));
}

/** Sets an image's alt text, which describes it for people who can't see it. */
export async function setAltText(db: Database, actorId: string, assetId: string, altText: string) {
  const text = altText.trim().slice(0, 500);
  const asset = await db
    .select({ id: mediaAsset.id })
    .from(mediaAsset)
    .where(and(eq(mediaAsset.id, assetId), eq(mediaAsset.purpose, "media")))
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

/** Assets by id, for showing evidence scan states beside Rights Records. */
export function assetsById(db: Database, ids: string[]) {
  return ids.length ? db.select().from(mediaAsset).where(inArray(mediaAsset.id, ids)) : Promise.resolve([]);
}
