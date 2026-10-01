import { and, eq, inArray, lt } from "drizzle-orm";
import { mediaAsset } from "~db/schema";
import { auditInsert } from "./audit.server";
import { type Database, getDb } from "./db.server";
import type { MediaAsset, ScanMessage } from "./media.server";
import { DAY_MS } from "./rights-rules";
import { checkContent, type UploadType } from "./upload-rules";

/**
 * The scan step (ADR-0010). A queued upload is read from quarantine, its type checked again,
 * and its bytes sent to ClamAV. Only a clean file is copied to its destination bucket; an
 * infected or unscannable file stays in quarantine with its reason. Every step is safe to repeat,
 * because a queue message can be delivered more than once.
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
    const sending = body.pipeTo(writable);
    const response = await env.SCANNER.getByName("upload-scanner").fetch("http://scanner/scan", {
      method: "POST",
      body: readable,
    });
    await sending.catch(() => undefined);
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

type Outcome = "skipped" | "clean" | "infected" | "refused";

/** Moves an asset out of "scanning", only if it is still there, so a repeated delivery changes nothing. */
function settle(db: Database, asset: MediaAsset, status: "ready" | "infected" | "failed", reason: string | null) {
  return [
    db
      .update(mediaAsset)
      .set({ status, statusReason: reason, scannedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(mediaAsset.id, asset.id), eq(mediaAsset.status, "scanning"))),
    auditInsert(db, {
      actorId: null,
      action: `media_asset.${status === "ready" ? "passed" : status}`,
      objectType: "media_asset",
      objectId: asset.id,
      details: reason ? { reason } : undefined,
    }),
  ] as const;
}

/** Scans one queued upload and acts on the verdict. */
export async function scanUpload(env: Env, db: Database, assetId: string, scanner: Scanner): Promise<Outcome> {
  const asset = await db.select().from(mediaAsset).where(eq(mediaAsset.id, assetId)).get();
  if (!asset) return "skipped";
  if (asset.status === "ready") {
    // A repeat after a run that copied the file but stopped before clearing quarantine.
    await env.QUARANTINE.delete(asset.quarantineKey);
    return "skipped";
  }
  if (asset.status !== "scanning") return "skipped";

  const head = await env.QUARANTINE.get(asset.quarantineKey, { range: { offset: 0, length: 16 } });
  if (!head) {
    await db.batch(settle(db, asset, "failed", "The uploaded file is missing. Upload it again."));
    return "refused";
  }
  const content = checkContent(asset.type as UploadType, new Uint8Array(await head.arrayBuffer()));
  if (!content.ok) {
    await db.batch(settle(db, asset, "failed", content.error));
    return "refused";
  }

  const file = await env.QUARANTINE.get(asset.quarantineKey);
  if (!file) throw new Error("The quarantined file disappeared during the scan.");
  const result = await scanner({ body: file.body, size: file.size });
  if (result.verdict === "infected") {
    await db.batch(settle(db, asset, "infected", `The virus scanner found ${result.signature}.`));
    return "infected";
  }

  const clean = await env.QUARANTINE.get(asset.quarantineKey);
  if (!clean) throw new Error("The quarantined file disappeared after its scan.");
  const destination = asset.purpose === "evidence" ? env.EVIDENCE : env.MEDIA;
  await destination.put(asset.destinationKey, clean.body, { httpMetadata: { contentType: asset.type } });
  await db.batch(settle(db, asset, "ready", null));
  await env.QUARANTINE.delete(asset.quarantineKey);
  return "clean";
}

/**
 * The queue consumer. A scanner that can't answer (still starting, say) means a retry with a
 * growing delay; after MAX_SCAN_ATTEMPTS deliveries the upload is marked failed for staff to see.
 */
export async function handleScanBatch(batch: MessageBatch<ScanMessage>, env: Env, scanner: Scanner) {
  const db = getDb(env.DB);
  for (const message of batch.messages) {
    try {
      await scanUpload(env, db, message.body.assetId, scanner);
      message.ack();
    } catch (error) {
      console.error("Upload scan failed", message.body.assetId, message.attempts, error);
      if (message.attempts >= MAX_SCAN_ATTEMPTS) {
        const asset = await db.select().from(mediaAsset).where(eq(mediaAsset.id, message.body.assetId)).get();
        if (asset) await db.batch(settle(db, asset, "failed", SCAN_FAILED));
        message.ack();
      } else {
        message.retry({ delaySeconds: Math.min(60 * message.attempts, 600) });
      }
    }
  }
}

/** Quarantined failures are kept this long for staff to see, then removed (docs/phase-1a-defaults.md §1). */
export const QUARANTINE_DAYS = 30;
/** An upload left unfinished this long is abandoned. */
const ABANDONED_DAYS = 7;
/** A scan with no verdict this long was probably lost and is queued again. */
const STALLED_SCAN_MS = 60 * 60 * 1000;

/**
 * The daily job's part: remove failed and infected files after 30 days, abandon uploads nobody
 * finished, and queue again any scan that has waited too long (a lost queue message).
 */
export async function tidyQuarantine(env: Env, db: Database, now: Date) {
  const expired = await db
    .select()
    .from(mediaAsset)
    .where(
      and(
        inArray(mediaAsset.status, ["infected", "failed"]),
        lt(mediaAsset.updatedAt, new Date(now.getTime() - QUARANTINE_DAYS * DAY_MS)),
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
    if (asset.multipartUploadId) {
      await env.QUARANTINE.resumeMultipartUpload(asset.quarantineKey, asset.multipartUploadId)
        .abort()
        .catch(() => undefined);
    }
    await db
      .update(mediaAsset)
      .set({
        status: "failed",
        statusReason: "This upload was never finished.",
        multipartUploadId: null,
        updatedAt: now,
      })
      .where(eq(mediaAsset.id, asset.id));
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
