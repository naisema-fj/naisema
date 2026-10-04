import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { mediaAsset, user, videoAsset } from "~db/schema";
import { recordAudit } from "./audit.server";
import type { Database } from "./db.server";
import type { MediaAsset } from "./media.server";
import { readVideoFacts, type VideoFacts } from "./mp4-facts";
import { ProviderError, type VideoProvider } from "./video-provider.server";
import {
  canMoveVideo,
  formatVideoLength,
  lengthProblem,
  ORIENTATION_NAMES,
  orientationOf,
  type ProviderUpdate,
  type VideoProviderName,
  type VideoState,
} from "./video-rules";

/**
 * Video Assets (ADR-0008). A video master that passes its scan is kept in the private
 * VIDEO_MASTERS bucket, and a Video Asset records it; the provider (Cloudflare Stream) is then
 * asked to copy it. The provider's reports, by webhook or when asked, only move a Video Asset's
 * state forwards (canMoveVideo), so repeated or out-of-order reports change nothing. Every move is
 * audited, and only a move that happened.
 */

export type VideoAsset = typeof videoAsset.$inferSelect;

/** Where video masters are kept in VIDEO_MASTERS; the scan copies a clean master there. */
export const MASTERS_PREFIX = "masters/";

/** A stored master's length and picture size, read from its movie header with ranged reads (mp4-facts.ts). */
export const masterFacts = (bucket: R2Bucket, key: string, size: number) =>
  readVideoFacts(async (offset, length) => {
    const available = Math.min(length, size - offset);
    if (available <= 0) return new Uint8Array();
    const object = await bucket.get(key, { range: { offset, length: available } });
    return object ? new Uint8Array(await object.arrayBuffer()) : new Uint8Array();
  }, size);

/** A provider's failure as the reason staff read, or the error again if trying later could help. */
function failureReason(error: unknown) {
  if (error instanceof ProviderError && !error.retry) return error.message;
  throw error;
}

/** Moves a Video Asset on from one of `from`, and audits the move only if it happened. */
async function moveVideo(
  db: Database,
  id: string,
  from: VideoState[],
  set: Partial<typeof videoAsset.$inferInsert> & { state: VideoState },
  audit: { actorId: string | null; details?: Record<string, unknown> },
) {
  const allowed = from.filter((state) => canMoveVideo(state, set.state));
  if (!allowed.length) return false;
  const moved = await db
    .update(videoAsset)
    .set({ ...set, updatedAt: new Date() })
    .where(and(eq(videoAsset.id, id), inArray(videoAsset.state, allowed)))
    .returning({ id: videoAsset.id });
  if (!moved.length) return false;
  await recordAudit(db, {
    actorId: audit.actorId,
    action: `video_asset.${set.state}`,
    objectType: "video_asset",
    objectId: id,
    details: audit.details,
  });
  return true;
}

export const getVideo = (db: Database, id: string) => db.select().from(videoAsset).where(eq(videoAsset.id, id)).get();

/** Fails a video that hasn't finished, with a reason staff can read. */
export const failVideo = (db: Database, id: string, reason: string, actorId: string | null = null) =>
  moveVideo(
    db,
    id,
    ["uploaded", "processing"],
    { state: "failed", stateReason: reason },
    { actorId, details: { reason } },
  );

/**
 * A provider's "ready" turned into a failure when the provider measured the video at over 15
 * minutes, which a master whose movie header understates its length could otherwise slip past.
 */
function measuredLength(update: ProviderUpdate): ProviderUpdate {
  if (update.state !== "ready" || update.durationMs === null || !lengthProblem(update.durationMs)) return update;
  return {
    ...update,
    state: "failed",
    reason: `Stream measured this video at ${formatVideoLength(update.durationMs)}. The limit is 15 minutes: trim it, or upload the part you need, and try again.`,
  };
}

/**
 * Applies a provider's report about one of its videos. Unknown videos (another environment's, as
 * one Stream account serves them all) and moves backwards are ignored.
 */
export async function applyProviderUpdate(
  db: Database,
  provider: VideoProviderName,
  providerId: string,
  update: ProviderUpdate,
  actorId: string | null = null,
): Promise<"moved" | "unchanged" | "unknown"> {
  const video = await db
    .select()
    .from(videoAsset)
    .where(and(eq(videoAsset.provider, provider), eq(videoAsset.providerId, providerId)))
    .get();
  if (!video) return "unknown";
  const checked = measuredLength(update);
  const moved = await moveVideo(
    db,
    video.id,
    [video.state],
    {
      state: checked.state,
      stateReason: checked.state === "failed" ? checked.reason : null,
      ...(checked.state === "ready" ? { readyAt: new Date() } : {}),
    },
    { actorId, details: checked.reason ? { reason: checked.reason } : undefined },
  );
  return moved ? "moved" : "unchanged";
}

/**
 * Asks the provider to copy a master that hasn't been sent yet. A refusal fails the video with
 * the provider's reason; a lost connection or server error is thrown, so the caller tries again.
 */
export async function sendForProcessing(
  db: Database,
  id: string,
  provider: VideoProvider,
  actorId: string | null = null,
  now = new Date(),
): Promise<"sent" | "failed" | "skipped"> {
  const video = await getVideo(db, id);
  if (video?.state !== "uploaded") return "skipped";
  const asset = await db.select({ name: mediaAsset.name }).from(mediaAsset).where(eq(mediaAsset.id, id)).get();
  let result: Awaited<ReturnType<VideoProvider["copy"]>>;
  try {
    result = await provider.copy(
      { assetId: id, name: asset?.name ?? id, masterKey: video.masterKey, environment: video.environment },
      now,
    );
  } catch (error) {
    await failVideo(db, id, failureReason(error), actorId);
    return "failed";
  }
  const moved = await moveVideo(
    db,
    id,
    ["uploaded"],
    { state: "processing", provider: provider.name, providerId: result.providerId, stateReason: null },
    { actorId, details: { provider: provider.name, providerId: result.providerId } },
  );
  if (!moved) {
    // Another delivery sent it first: drop this second copy rather than pay for it.
    await provider.remove(result.providerId).catch(() => undefined);
    return "skipped";
  }
  if (result.update && result.update.state !== "processing") {
    await applyProviderUpdate(db, provider.name, result.providerId, result.update);
  }
  return "sent";
}

/**
 * Records the Video Asset for a master that just passed its scan, if not already recorded, and
 * sends it for processing. Its length and picture size come from the master itself, read by the
 * scan step (`facts`) or, on a repeated delivery, read again from VIDEO_MASTERS.
 */
export async function startVideo(
  env: Env,
  db: Database,
  asset: MediaAsset,
  provider: VideoProvider,
  facts?: VideoFacts,
  now = new Date(),
) {
  if (!(await getVideo(db, asset.id))) {
    let measured = facts;
    if (!measured) {
      const result = await masterFacts(env.VIDEO_MASTERS, asset.destinationKey, asset.size);
      if (!result.ok) throw new Error(`The master's length couldn't be read again: ${result.error}`);
      measured = result.facts;
    }
    const inserted = await db
      .insert(videoAsset)
      .values({
        id: asset.id,
        ownerId: asset.uploadedBy,
        masterKey: asset.destinationKey,
        provider: provider.name,
        state: "uploaded",
        durationMs: measured.durationMs,
        width: measured.width,
        height: measured.height,
        orientation: orientationOf(measured.width, measured.height),
        environment: env.ENVIRONMENT,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: videoAsset.id });
    if (inserted.length) {
      await recordAudit(db, {
        actorId: null,
        action: "video_asset.created",
        objectType: "video_asset",
        objectId: asset.id,
        details: { durationMs: measured.durationMs, width: measured.width, height: measured.height },
      });
    }
  }
  return sendForProcessing(db, asset.id, provider, null, now);
}

/** Asks the provider where a processing video has got to, for staff and the daily job. */
export async function checkVideo(db: Database, id: string, provider: VideoProvider, actorId: string | null = null) {
  const video = await getVideo(db, id);
  if (video?.state !== "processing" || !video.providerId) return "unchanged";
  let update: ProviderUpdate | null;
  try {
    update = await provider.status(video.providerId);
  } catch (error) {
    if (error instanceof ProviderError) return "unchanged";
    throw error;
  }
  if (!update) {
    await failVideo(db, id, "Stream no longer has this video. Try again to send it again.", actorId);
    return "moved";
  }
  return applyProviderUpdate(db, video.provider, video.providerId, update, actorId);
}

/** Tries a failed video again: the provider's earlier copy is dropped and the master sent afresh. */
export async function retryVideo(db: Database, id: string, provider: VideoProvider, actorId: string, now = new Date()) {
  const video = await getVideo(db, id);
  if (video?.state !== "failed") return "skipped";
  if (video.providerId) await provider.remove(video.providerId).catch(() => undefined);
  const moved = await moveVideo(
    db,
    id,
    ["failed"],
    { state: "uploaded", providerId: null, stateReason: null },
    { actorId, details: { retry: true } },
  );
  if (!moved) return "skipped";
  try {
    return await sendForProcessing(db, id, provider, actorId, now);
  } catch {
    // Left waiting: the daily job sends it again.
    return "skipped";
  }
}

/** A report lost or not sent to this environment shows up here within an hour of the daily run. */
const STALLED_MS = 60 * 60 * 1000;

/**
 * The daily job's part: ask the provider about videos processing for over an hour (a lost
 * webhook, or one sent to another environment), and send again any master never sent.
 */
export async function refreshStalledVideos(db: Database, provider: VideoProvider, now: Date) {
  const stalled = await db
    .select({ id: videoAsset.id, state: videoAsset.state })
    .from(videoAsset)
    .where(
      and(
        inArray(videoAsset.state, ["uploaded", "processing"]),
        lt(videoAsset.updatedAt, new Date(now.getTime() - STALLED_MS)),
      ),
    );
  for (const video of stalled) {
    try {
      if (video.state === "processing") await checkVideo(db, video.id, provider);
      else await sendForProcessing(db, video.id, provider, null, now);
    } catch (error) {
      console.error("Video refresh failed", video.id, error);
    }
  }
}

/** A Video Asset with its file name and owner's name, for the staff video page. */
export function videoDetail(db: Database, id: string) {
  return db
    .select({ video: videoAsset, name: mediaAsset.name, size: mediaAsset.size, ownerName: user.name })
    .from(videoAsset)
    .innerJoin(mediaAsset, eq(mediaAsset.id, videoAsset.id))
    .innerJoin(user, eq(user.id, videoAsset.ownerId))
    .where(eq(videoAsset.id, id))
    .get();
}

/** A Video Asset that has finished processing, or undefined. */
export const readyVideo = (db: Database, id: string) =>
  db
    .select()
    .from(videoAsset)
    .where(and(eq(videoAsset.id, id), eq(videoAsset.state, "ready")))
    .get();

/** Ready Video Assets, newest first, for a Video's choice of footage. */
export async function videoChoices(db: Database) {
  const rows = await db
    .select({
      id: videoAsset.id,
      name: mediaAsset.name,
      durationMs: videoAsset.durationMs,
      orientation: videoAsset.orientation,
    })
    .from(videoAsset)
    .innerJoin(mediaAsset, eq(mediaAsset.id, videoAsset.id))
    .where(eq(videoAsset.state, "ready"))
    .orderBy(desc(videoAsset.createdAt));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    typeName: `${formatVideoLength(row.durationMs)}, ${ORIENTATION_NAMES[row.orientation].toLowerCase()}`,
  }));
}

/** Every Video Asset's state, for the media library. */
export async function videoStates(db: Database) {
  const rows = await db
    .select({ id: videoAsset.id, state: videoAsset.state })
    .from(videoAsset)
    .orderBy(desc(videoAsset.createdAt));
  return new Map(rows.map((row) => [row.id, row.state]));
}
