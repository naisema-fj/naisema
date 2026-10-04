import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { mediaAsset } from "~db/schema";
import { auditInsert, recordAudit } from "./audit.server";
import { type Database, getDb } from "./db.server";
import { abortMultipart, type MediaAsset, type ScanMessage } from "./media.server";
import { readVideoFacts, type VideoFacts } from "./mp4-facts";
import { DAY_MS } from "./rights-rules";
import { checkContent, HEAD_BYTES } from "./upload-rules";
import { bucketReader, failVideo, isVideoMaster, MASTERS_PREFIX, startVideo } from "./video-assets.server";
import { ProviderError, type VideoProvider, videoProvider } from "./video-provider.server";
import { lengthProblem } from "./video-rules";

/**
 * The scan step (ADR-0010). A queued upload is read from quarantine, its type checked again,
 * and its bytes sent to ClamAV. Only a clean file is copied to its destination bucket; an
 * infected or unscannable file stays in quarantine with its reason. A video master's length is
 * read first, and one over 15 minutes is refused before it is scanned; a clean master goes to
 * VIDEO_MASTERS and is sent for processing (app/lib/video-assets.server.ts). Every step is safe to
 * repeat, because a queue message can be delivered more than once.
 */

export type ScanVerdict = { verdict: "clean" } | { verdict: "infected"; signature: string };

/** Sends a file's bytes to a virus scanner. Throws when the scanner can't give a verdict. */
export type Scanner = (file: { body: ReadableStream<Uint8Array>; size: number }) => Promise<ScanVerdict>;

export class ScannerUnavailable extends Error {}

/** ClamAV in Cloudflare Containers (containers/scanner), through the Scanner Durable Object. */
export function containerScanner(env: Env): Scanner {
  return async ({ body, size }) => {
    // A fixed length, so the container receives a Content-Length rather than a chunked body.
    const { readable, writable } = new FixedLengthStream(size);
    const sending = body.pipeTo(writable).catch(() => undefined);
    let response: Response;
    try {
      response = await env.SCANNER.getByName("upload-scanner").fetch("http://scanner/scan", {
        method: "POST",
        body: readable,
      });
    } catch (error) {
      // Stop reading from quarantine if the scanner never took the file.
      await readable.cancel().catch(() => undefined);
      throw new ScannerUnavailable(`The scanner could not be reached: ${error}`);
    } finally {
      await sending;
    }
    const result = (await response.json().catch(() => null)) as { verdict?: string; signature?: string } | null;
    if (response.ok && result?.verdict === "clean") return { verdict: "clean" };
    if (response.ok && result?.verdict === "infected") {
      return { verdict: "infected", signature: result.signature ?? "unknown" };
    }
    throw new ScannerUnavailable(`The scanner answered ${response.status}.`);
  };
}

/** Deliveries of one scan request before the upload is marked failed (wrangler.jsonc max_retries). */
export const MAX_SCAN_ATTEMPTS = 5;

const SCAN_FAILED =
  "The virus scan could not finish. Upload the file again; if it keeps failing, tell the technical owner.";

const VIDEO_SEND_FAILED =
  "The video couldn't be sent for processing. Try again; if it keeps failing, tell the technical owner.";

type Outcome = "skipped" | "clean" | "infected" | "failed";

/**
 * Moves an asset out of "scanning", only if it is still there, and audits only a move that
 * happened, so a repeated delivery changes and records nothing. A refused file's destination copy
 * is removed too, in case an earlier delivery copied it before stopping.
 */
async function settle(
  env: Env,
  db: Database,
  asset: MediaAsset,
  status: "ready" | "infected" | "failed",
  reason: string | null,
) {
  const now = new Date();
  const moved = await db
    .update(mediaAsset)
    .set({ status, statusReason: reason, scannedAt: now, updatedAt: now })
    .where(and(eq(mediaAsset.id, asset.id), eq(mediaAsset.status, "scanning")))
    .returning({ id: mediaAsset.id });
  if (!moved.length) return;
  if (status !== "ready") await destinationOf(env, asset).delete(asset.destinationKey);
  await recordAudit(db, {
    actorId: null,
    action: `media_asset.${status === "ready" ? "passed" : status}`,
    objectType: "media_asset",
    objectId: asset.id,
    details: reason ? { reason } : undefined,
  });
}

/**
 * Video masters are kept in VIDEO_MASTERS (ones scanned before it existed stay in MEDIA, under
 * their old key); the rest of the media library is in MEDIA; evidence and contributors' material
 * stay private, in EVIDENCE.
 */
const destinationOf = (env: Env, asset: MediaAsset) =>
  asset.destinationKey.startsWith(MASTERS_PREFIX)
    ? env.VIDEO_MASTERS
    : asset.purpose === "media"
      ? env.MEDIA
      : env.EVIDENCE;

/** Whether a ready upload is a master the video pipeline takes. */
const takesVideo = (asset: MediaAsset) => isVideoMaster(asset) && asset.destinationKey.startsWith(MASTERS_PREFIX);

/** Scans one queued upload and acts on the verdict. */
export async function scanUpload(
  env: Env,
  db: Database,
  assetId: string,
  scanner: Scanner,
  provider: VideoProvider = videoProvider(env),
): Promise<Outcome> {
  const asset = await db.select().from(mediaAsset).where(eq(mediaAsset.id, assetId)).get();
  if (!asset) return "skipped";
  if (asset.status === "ready") {
    // A repeat after a run that copied the file but stopped before sending a video master for
    // processing or clearing quarantine.
    if (takesVideo(asset)) await startVideo(env, db, asset, provider);
    await env.QUARANTINE.delete(asset.quarantineKey);
    return "skipped";
  }
  if (asset.status !== "scanning") return "skipped";

  const head = await env.QUARANTINE.get(asset.quarantineKey, { range: { offset: 0, length: HEAD_BYTES } });
  if (!head) {
    await settle(env, db, asset, "failed", "The uploaded file is missing. Upload it again.");
    return "failed";
  }
  const content = checkContent(asset.type, new Uint8Array(await head.arrayBuffer()));
  if (!content.ok) {
    await settle(env, db, asset, "failed", content.error);
    return "failed";
  }
  let facts: VideoFacts | undefined;
  if (takesVideo(asset)) {
    const read = await readVideoFacts(bucketReader(env.QUARANTINE, asset.quarantineKey, asset.size), asset.size);
    const problem = read.ok ? lengthProblem(read.facts.durationMs) : read.error;
    if (problem || !read.ok) {
      await settle(env, db, asset, "failed", problem);
      return "failed";
    }
    facts = read.facts;
  }

  const file = await env.QUARANTINE.get(asset.quarantineKey);
  if (!file) throw new Error("The quarantined file disappeared during the scan.");
  const result = await scanner({ body: file.body, size: file.size });
  if (result.verdict === "infected") {
    await settle(env, db, asset, "infected", `The virus scanner found ${result.signature}.`);
    return "infected";
  }

  // Copy exactly the bytes that were scanned: the same object, unchanged since (its etag).
  const clean = await env.QUARANTINE.get(asset.quarantineKey, { onlyIf: { etagMatches: file.etag } });
  if (!clean || !("body" in clean)) throw new Error("The quarantined file changed after its scan.");
  await destinationOf(env, asset).put(asset.destinationKey, clean.body, { httpMetadata: { contentType: asset.type } });
  await settle(env, db, asset, "ready", null);
  if (takesVideo(asset)) await startVideo(env, db, { ...asset, status: "ready" }, provider, facts);
  await env.QUARANTINE.delete(asset.quarantineKey);
  return "clean";
}

/**
 * The queue consumer. A scanner that can't answer (still starting, say) means a retry with a
 * growing delay; after MAX_SCAN_ATTEMPTS deliveries the upload is marked failed for staff to see.
 */
export async function handleScanBatch(
  batch: MessageBatch<ScanMessage>,
  env: Env,
  scanner: Scanner,
  provider: VideoProvider = videoProvider(env),
) {
  const db = getDb(env.DB);
  for (const message of batch.messages) {
    try {
      await scanUpload(env, db, message.body.assetId, scanner, provider);
      message.ack();
    } catch (error) {
      console.error("Upload scan failed", message.body.assetId, message.attempts, error);
      if (message.attempts >= MAX_SCAN_ATTEMPTS) {
        const asset = await db.select().from(mediaAsset).where(eq(mediaAsset.id, message.body.assetId)).get();
        if (asset) await settle(env, db, asset, "failed", SCAN_FAILED);
        // A clean master the provider never took: staff see why and can try again.
        if (asset?.status === "ready") {
          await failVideo(db, asset.id, error instanceof ProviderError ? error.message : VIDEO_SEND_FAILED);
        }
        message.ack();
      } else {
        message.retry({ delaySeconds: Math.min(60 * message.attempts, 600) });
      }
    }
  }
}

/** Quarantined failures are kept this long after their scan for staff to see, then removed (docs/phase-1a-defaults.md §1). */
export const QUARANTINE_DAYS = 30;
/** An upload left unfinished this long is abandoned. */
const ABANDONED_DAYS = 7;
/** A scan with no verdict this long was probably lost and is queued again. */
const STALLED_SCAN_MS = 60 * 60 * 1000;

/**
 * The daily job's part: remove failed and infected files 30 days after they were refused, abandon
 * uploads nobody finished, and queue again any scan that has waited too long (a lost message).
 */
export async function tidyQuarantine(env: Env, db: Database, now: Date) {
  const expired = await db
    .select()
    .from(mediaAsset)
    .where(
      and(
        inArray(mediaAsset.status, ["infected", "failed"]),
        // The clock is when it was refused, which nothing else moves (alt text, say).
        or(
          lt(mediaAsset.scannedAt, new Date(now.getTime() - QUARANTINE_DAYS * DAY_MS)),
          and(
            isNull(mediaAsset.scannedAt),
            lt(mediaAsset.updatedAt, new Date(now.getTime() - QUARANTINE_DAYS * DAY_MS)),
          ),
        ),
      ),
    );
  for (const asset of expired) {
    await env.QUARANTINE.delete(asset.quarantineKey);
    await db.batch([
      db.update(mediaAsset).set({ status: "removed", updatedAt: now }).where(eq(mediaAsset.id, asset.id)),
      auditInsert(db, { actorId: null, action: "media_asset.removed", objectType: "media_asset", objectId: asset.id }),
    ]);
  }

  const abandoned = await db
    .select()
    .from(mediaAsset)
    .where(
      and(
        eq(mediaAsset.status, "uploading"),
        lt(mediaAsset.updatedAt, new Date(now.getTime() - ABANDONED_DAYS * DAY_MS)),
      ),
    );
  for (const asset of abandoned) {
    await abortMultipart(env, asset);
    const reason = "This upload was never finished.";
    await db.batch([
      db
        .update(mediaAsset)
        .set({ status: "failed", statusReason: reason, multipartUploadId: null, scannedAt: now, updatedAt: now })
        .where(eq(mediaAsset.id, asset.id)),
      auditInsert(db, {
        actorId: null,
        action: "media_asset.failed",
        objectType: "media_asset",
        objectId: asset.id,
        details: { reason },
      }),
    ]);
  }

  const stalled = await db
    .select({ id: mediaAsset.id })
    .from(mediaAsset)
    .where(and(eq(mediaAsset.status, "scanning"), lt(mediaAsset.updatedAt, new Date(now.getTime() - STALLED_SCAN_MS))));
  for (const { id } of stalled) {
    await env.UPLOAD_SCANS.send({ assetId: id } satisfies ScanMessage);
    await db.update(mediaAsset).set({ updatedAt: now }).where(eq(mediaAsset.id, id));
  }
}
