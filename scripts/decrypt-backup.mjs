// Decrypts a NAISEMA database backup on a person's computer (docs/handover/runbook.md, restoring).
//
//   BACKUP_ENCRYPTION_KEY=<the key> node scripts/decrypt-backup.mjs <backup.sql.enc> <backup.sql>
//
// The format is described in app/lib/backup-crypto.ts: chunks of 5 MiB, each sealed on its own with
// AES-256-GCM as IV (12 bytes) || ciphertext || tag (16 bytes), with the last chunk marked as such.

import { webcrypto } from "node:crypto";
import { closeSync, fstatSync, openSync, readSync, writeSync } from "node:fs";

const CHUNK_BYTES = 5 * 1024 * 1024;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export async function importKey(secret) {
  const raw = Buffer.from((secret ?? "").trim(), "base64");
  if (raw.length !== 32) throw new Error("The key must be 32 bytes, base64 (BACKUP_ENCRYPTION_KEY).");
  return webcrypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
}

/** Opens one sealed chunk (IV || ciphertext || tag). `last` is whether it ends the backup. */
export async function openChunk(key, sealed, last) {
  return new Uint8Array(
    await webcrypto.subtle.decrypt(
      { name: "AES-GCM", iv: sealed.subarray(0, IV_BYTES), additionalData: Uint8Array.of(last ? 1 : 0) },
      key,
      sealed.subarray(IV_BYTES),
    ),
  );
}

export async function decryptBackup(inputPath, outputPath, secret, chunkBytes = CHUNK_BYTES) {
  const key = await importKey(secret);
  const stride = chunkBytes + IV_BYTES + TAG_BYTES;
  const input = openSync(inputPath, "r");
  const output = openSync(outputPath, "w");
  try {
    const size = fstatSync(input).size;
    if (size < IV_BYTES + TAG_BYTES) throw new Error("This isn't a NAISEMA backup: it is too short.");
    const buffer = Buffer.alloc(stride);
    for (let offset = 0; offset < size; offset += stride) {
      const length = Math.min(stride, size - offset);
      readSync(input, buffer, 0, length, offset);
      const last = offset + stride >= size;
      let plain;
      try {
        plain = await openChunk(key, buffer.subarray(0, length), last);
      } catch {
        throw new Error(
          `Chunk ${offset / stride + 1} wouldn't decrypt: wrong key, or the backup is damaged or cut short.`,
        );
      }
      writeSync(output, plain);
    }
  } finally {
    closeSync(input);
    closeSync(output);
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error("Usage: BACKUP_ENCRYPTION_KEY=<key> node scripts/decrypt-backup.mjs <backup.sql.enc> <backup.sql>");
    process.exit(2);
  }
  decryptBackup(input, output, process.env.BACKUP_ENCRYPTION_KEY).then(
    () => console.log(`Wrote ${output}`),
    (error) => {
      console.error(error.message);
      process.exit(1);
    },
  );
}
