import { eq } from "drizzle-orm";
import { mediaAsset } from "~db/schema";
import { recordAudit } from "./audit.server";
import type { Database } from "./db.server";
import type { EvidenceFile } from "./evidence-file";
import { quarantineFile } from "./media.server";

/**
 * Private evidence files (Rights Records, Knowledge Holder Approvals): each goes into quarantine
 * and is scanned like every upload (ADR-0010), then kept in the EVIDENCE bucket for editors only.
 */

/** Puts an evidence file into quarantine for its scan; it reaches the EVIDENCE bucket once clean. */
export const storeEvidence = (env: Env, db: Database, uploadedBy: string, file: EvidenceFile) =>
  quarantineFile(env, db, uploadedBy, file, "evidence");

/**
 * Refuses evidence whose record couldn't be written, wherever its scan has got to, including a
 * copy already passed to the EVIDENCE bucket. A failed clean-up never hides why the record wasn't written.
 */
export async function discardEvidence(
  env: Env,
  db: Database,
  actorId: string,
  evidence: { id: string; destinationKey: string },
  reason: string,
) {
  await Promise.all([
    db
      .update(mediaAsset)
      .set({ status: "failed", statusReason: reason, scannedAt: new Date(), updatedAt: new Date() })
      .where(eq(mediaAsset.id, evidence.id)),
    env.EVIDENCE.delete(evidence.destinationKey),
    recordAudit(db, {
      actorId,
      action: "media_asset.failed",
      objectType: "media_asset",
      objectId: evidence.id,
      details: { reason },
    }),
  ]).catch(() => undefined);
}

/**
 * An evidence file from the EVIDENCE bucket once its scan has passed, or why it can't be read yet.
 * Evidence stored before the scan pipeline has no upload behind it (`assetId` null).
 */
export async function scannedEvidence(
  env: Env,
  db: Database,
  assetId: string | null,
  key: string,
): Promise<{ unavailable: string } | { object: R2ObjectBody } | null> {
  if (assetId) {
    const asset = await db.select().from(mediaAsset).where(eq(mediaAsset.id, assetId)).get();
    if (asset?.status !== "ready") {
      return {
        unavailable: asset?.statusReason ?? "This evidence is still being scanned for viruses. Try again shortly.",
      };
    }
  }
  const object = await env.EVIDENCE.get(key);
  return object ? { object } : null;
}
