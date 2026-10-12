/**
 * Backups are encrypted before they leave the Worker (ADR-0009). A backup is cut into chunks of
 * `CHUNK_BYTES`, each sealed on its own with AES-256-GCM under a fresh random 12-byte IV and
 * stored as `IV || ciphertext || tag`, so every chunk but the last is exactly `STRIDE` bytes and
 * each can be uploaded as one part of an R2 multipart upload without holding the whole backup in
 * memory. The chunk's last-or-not flag is authenticated, so a backup cut short at a chunk boundary
 * fails to decrypt rather than restoring a partial database. scripts/decrypt-backup.mjs undoes
 * this on a person's computer.
 */

/** Plain bytes per chunk: 5 MiB, the smallest part R2 accepts before the last. */
export const CHUNK_BYTES = 5 * 1024 * 1024;
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** The size of every sealed chunk but the last. */
export const STRIDE = CHUNK_BYTES + IV_BYTES + TAG_BYTES;

export class BackupKeyError extends Error {}

/** The key from its secret: 32 random bytes, base64 (`openssl rand -base64 32`). */
export async function importBackupKey(secret: string | undefined) {
  if (!secret) throw new BackupKeyError("BACKUP_ENCRYPTION_KEY isn't set, so backups can't be encrypted.");
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = Uint8Array.from(atob(secret.trim()), (char) => char.charCodeAt(0));
  } catch {
    throw new BackupKeyError("BACKUP_ENCRYPTION_KEY isn't base64.");
  }
  if (raw.length !== 32) throw new BackupKeyError("BACKUP_ENCRYPTION_KEY must be 32 bytes (openssl rand -base64 32).");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** A short label for a key, so a backup's metadata says which key sealed it without revealing it. */
export async function keyLabel(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret.trim()));
  return [...new Uint8Array(digest).slice(0, 4)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function seal(key: CryptoKey, plain: Uint8Array<ArrayBuffer>, last: boolean) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: Uint8Array.of(last ? 1 : 0) }, key, plain),
  );
  const out = new Uint8Array(IV_BYTES + sealed.length);
  out.set(iv);
  out.set(sealed, IV_BYTES);
  return out;
}

/**
 * Regroups `pieces` into chunks and seals each. Yields every sealed chunk once the next one is
 * known, so the last can be marked as the last. At least one chunk is always yielded.
 */
export async function* sealChunks(key: CryptoKey, pieces: AsyncIterable<Uint8Array>, chunkBytes = CHUNK_BYTES) {
  let buffer = new Uint8Array(chunkBytes);
  let filled = 0;
  let waiting: Uint8Array<ArrayBuffer> | null = null;
  for await (const piece of pieces) {
    let offset = 0;
    while (offset < piece.length) {
      const take = Math.min(chunkBytes - filled, piece.length - offset);
      buffer.set(piece.subarray(offset, offset + take), filled);
      filled += take;
      offset += take;
      if (filled === chunkBytes) {
        if (waiting) yield await seal(key, waiting, false);
        waiting = buffer;
        buffer = new Uint8Array(chunkBytes);
        filled = 0;
      }
    }
  }
  if (filled > 0 || !waiting) {
    if (waiting) yield await seal(key, waiting, false);
    yield await seal(key, buffer.subarray(0, filled), true);
  } else {
    yield await seal(key, waiting, true);
  }
}

/** Undoes `sealChunks`. Throws if any chunk was changed, reordered or cut off. */
export async function openChunks(key: CryptoKey, sealed: Uint8Array<ArrayBuffer>, chunkBytes = CHUNK_BYTES) {
  const stride = chunkBytes + IV_BYTES + TAG_BYTES;
  const plain: Uint8Array[] = [];
  for (let offset = 0; offset < sealed.length; offset += stride) {
    const last = offset + stride >= sealed.length;
    const chunk = sealed.subarray(offset, Math.min(offset + stride, sealed.length));
    plain.push(
      new Uint8Array(
        await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: chunk.subarray(0, IV_BYTES), additionalData: Uint8Array.of(last ? 1 : 0) },
          key,
          chunk.subarray(IV_BYTES),
        ),
      ),
    );
  }
  const out = new Uint8Array(plain.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of plain) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
