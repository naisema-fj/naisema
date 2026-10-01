import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { DAY_MS } from "~/lib/rights-rules";
import {
  handleScanBatch,
  MAX_SCAN_ATTEMPTS,
  type Scanner,
  ScannerUnavailable,
  scanUpload,
  tidyQuarantine,
} from "~/lib/scan.server";
import { staff } from "./support/articles";
import { completeUpload, sendPart, startUpload } from "./support/media";

/** The EICAR test file, decoded here so no copy of it sits in the repository. */
const EICAR = atob("WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=");

/**
 * EICAR inside a PDF stream object: a file that passes the type check and that the real ClamAV
 * reports as Eicar-Signature (scripts/scanner-smoke.sh checks exactly this payload).
 */
const EICAR_IN_PDF = `1 0 obj\n<< /Length 68 >>\nstream\n${EICAR}\nendstream\nendobj\n%%EOF\n`;

/**
 * Stands in for ClamAV, which tests can't run: it reports the EICAR string when it appears, and
 * passes everything else.
 */
const eicarScanner: Scanner = async ({ body }) => {
  const text = await new Response(body).text();
  return text.includes(EICAR) ? { verdict: "infected", signature: "Eicar-Test-Signature" } : { verdict: "clean" };
};

const unavailableScanner: Scanner = async ({ body }) => {
  await body.cancel();
  throw new ScannerUnavailable("The scanner answered 503.");
};

/** A PDF uploaded and waiting for its scan. */
async function uploadedPdf(content: string) {
  const editor = await staff("editor", { role: "editor" });
  const bytes = new TextEncoder().encode(`%PDF-1.7\n${content}`);
  const { id } = (await (
    await startUpload(editor.browser, { name: "file.pdf", type: "application/pdf", size: bytes.length, head: bytes })
  ).json()) as { id: string };
  await sendPart(editor.browser, id, 1, bytes);
  expect((await completeUpload(editor.browser, id)).status).toBe(200);
  return id;
}

async function asset(id: string) {
  return env.DB.prepare(
    "SELECT status, status_reason AS reason, quarantine_key AS quarantineKey, destination_key AS destinationKey, updated_at AS updatedAt FROM media_asset WHERE id = ?1",
  )
    .bind(id)
    .first<{
      status: string;
      reason: string | null;
      quarantineKey: string;
      destinationKey: string;
      updatedAt: number;
    }>();
}

/** A one-message batch as the queue would deliver it, recording what the consumer did with it. */
function delivery(assetId: string, attempts = 1) {
  const outcome = { acked: false, retried: false };
  const message = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    body: { assetId },
    attempts,
    ack: () => {
      outcome.acked = true;
    },
    retry: () => {
      outcome.retried = true;
    },
  };
  const batch = { queue: "upload-scans", messages: [message], ackAll: () => {}, retryAll: () => {} };
  return { batch: batch as unknown as MessageBatch<{ assetId: string }>, outcome };
}

describe("scanning quarantined uploads", () => {
  it("copies a clean file to the media bucket, marks it ready and clears quarantine", async () => {
    const id = await uploadedPdf("A guide to the village.");

    expect(await scanUpload(env, getDb(env.DB), id, eicarScanner)).toBe("clean");

    const row = await asset(id);
    expect(row?.status).toBe("ready");
    expect(await (await env.MEDIA.get(row?.destinationKey as string))?.text()).toContain("A guide to the village.");
    expect(await env.QUARANTINE.head(row?.quarantineKey as string)).toBeNull();
  });

  it("rejects the EICAR test file: it stays in quarantine, with the signature shown to staff", async () => {
    const id = await uploadedPdf(EICAR_IN_PDF);

    expect(await scanUpload(env, getDb(env.DB), id, eicarScanner)).toBe("infected");

    const row = await asset(id);
    expect(row?.status).toBe("infected");
    expect(row?.reason).toContain("Eicar-Test-Signature");
    expect(await env.QUARANTINE.head(row?.quarantineKey as string)).not.toBeNull();
    expect(await env.MEDIA.head(row?.destinationKey as string)).toBeNull();
  });

  it("removes a copy left in the media bucket by an earlier delivery when the file is refused", async () => {
    const id = await uploadedPdf(EICAR_IN_PDF);
    const row = await asset(id);
    // An earlier delivery copied the file, then stopped before recording the verdict.
    await env.MEDIA.put(row?.destinationKey as string, "copied before the run stopped");

    expect(await scanUpload(env, getDb(env.DB), id, eicarScanner)).toBe("infected");

    expect(await env.MEDIA.head(row?.destinationKey as string)).toBeNull();
  });

  it("records each verdict once, however often it is delivered", async () => {
    const id = await uploadedPdf("Clean.");
    const db = getDb(env.DB);
    await scanUpload(env, db, id, eicarScanner);
    await scanUpload(env, db, id, eicarScanner);
    const last = delivery(id, MAX_SCAN_ATTEMPTS);
    await handleScanBatch(last.batch, env, async () => {
      throw new ScannerUnavailable("down");
    });

    const { results } = await env.DB.prepare(
      "SELECT action FROM audit_event WHERE object_id = ?1 AND action IN ('media_asset.passed', 'media_asset.failed')",
    )
      .bind(id)
      .all<{ action: string }>();
    expect(results.map((row) => row.action)).toEqual(["media_asset.passed"]);
  });

  it("is safe to repeat: a second delivery of the same scan changes nothing", async () => {
    const clean = await uploadedPdf("Clean.");
    const infected = await uploadedPdf(EICAR_IN_PDF);
    const db = getDb(env.DB);
    await scanUpload(env, db, clean, eicarScanner);
    await scanUpload(env, db, infected, eicarScanner);

    expect(await scanUpload(env, db, clean, eicarScanner)).toBe("skipped");
    expect(await scanUpload(env, db, infected, eicarScanner)).toBe("skipped");
    expect((await asset(clean))?.status).toBe("ready");
    expect((await asset(infected))?.status).toBe("infected");
  });

  it("retries while the scanner can't answer, then marks the upload failed", async () => {
    const id = await uploadedPdf("Clean.");

    const first = delivery(id, 1);
    await handleScanBatch(first.batch, env, unavailableScanner);
    expect(first.outcome).toEqual({ acked: false, retried: true });
    expect((await asset(id))?.status).toBe("scanning");

    const last = delivery(id, MAX_SCAN_ATTEMPTS);
    await handleScanBatch(last.batch, env, unavailableScanner);
    expect(last.outcome.acked).toBe(true);
    const row = await asset(id);
    expect(row?.status).toBe("failed");
    expect(row?.reason).toContain("virus scan could not finish");
  });

  it("removes failed and infected files 30 days on, and queues lost scans again", async () => {
    const infected = await uploadedPdf(EICAR_IN_PDF);
    const db = getDb(env.DB);
    await scanUpload(env, db, infected, eicarScanner);
    const waiting = await uploadedPdf("Still waiting.");
    const updatedAt = (await asset(infected))?.updatedAt as number;

    await tidyQuarantine(env, db, new Date(updatedAt + 29 * DAY_MS));
    expect((await asset(infected))?.status).toBe("infected");

    await tidyQuarantine(env, db, new Date(updatedAt + 31 * DAY_MS));
    const row = await asset(infected);
    expect(row?.status).toBe("removed");
    expect(await env.QUARANTINE.head(row?.quarantineKey as string)).toBeNull();
    // The waiting scan was stalled for that long, so it was queued again and its clock reset.
    expect((await asset(waiting))?.updatedAt).toBe(updatedAt + 31 * DAY_MS);
  });
});
