import { importBackupKey, keyLabel, sealChunks } from "./backup-crypto";
import { BACKUP_PREFIX, backupKey, expiredBackups, insertStatement, isBackedUp, quoted } from "./backup-rules";
import { logInfo } from "./log.server";
import { listAll } from "./r2-list.server";
import { optionalSecret } from "./secrets.server";

/**
 * The nightly D1 backup (ADR-0009, TECH-04; docs/handover/runbook.md, backups). Beside D1 Time
 * Travel, the Worker writes the database's data as SQL, encrypts it (app/lib/backup-crypto.ts) and
 * stores it in the private BACKUPS bucket, deleting backups older than 35 days.
 *
 * D1's own export can't be used: it refuses a database with a full-text (FTS5) table. This dump
 * holds data only (backup-rules.ts says which tables); a restore migrates an empty database and
 * loads the dump into it, and the full-text index refills through its triggers.
 */

const PAGE_ROWS = 500;

async function tablesToDump(d1: D1Database) {
  const { results } = await d1.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all<{
    name: string;
  }>();
  return results.map((row) => row.name).filter(isBackedUp);
}

async function lastMigration(d1: D1Database) {
  const row = await d1
    .prepare("SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1")
    .first<{ name: string }>()
    .catch(() => null);
  return row?.name ?? "unknown";
}

/**
 * The dump, as SQL text in pieces. A table is read a page at a time by row number, so memory stays
 * small however large the database grows. The site stays live meanwhile, so the dump isn't one
 * instant: Time Travel is the exact point-in-time copy.
 */
export async function* dumpDatabase(d1: D1Database, now: Date, environment: string) {
  const tables = await tablesToDump(d1);
  yield [
    `-- NAISEMA data backup (${environment}), started ${now.toISOString()}.`,
    `-- Taken at migration ${await lastMigration(d1)}. Load into a database migrated to that point; see docs/handover/runbook.md.`,
    "PRAGMA defer_foreign_keys = TRUE;",
    "",
  ].join("\n");
  for (const table of tables) {
    yield `\n-- ${table}\n`;
    let after = 0;
    for (;;) {
      const { results } = await d1
        .prepare(`SELECT rowid AS __rowid, * FROM ${quoted(table)} WHERE rowid > ?1 ORDER BY rowid LIMIT ${PAGE_ROWS}`)
        .bind(after)
        .all<Record<string, unknown>>();
      if (results.length === 0) break;
      let text = "";
      for (const { __rowid, ...row } of results) {
        text += insertStatement(table, row);
        after = __rowid as number;
      }
      yield text;
      if (results.length < PAGE_ROWS) break;
    }
  }
}

async function* encoded(texts: AsyncIterable<string>) {
  const encoder = new TextEncoder();
  for await (const text of texts) yield encoder.encode(text);
}

/** Takes one backup, then removes those past their 35 days. Throws if the backup can't be completed. */
export async function runBackup(env: Env, now: Date) {
  const secret = optionalSecret(env, "BACKUP_ENCRYPTION_KEY");
  const key = await importBackupKey(secret);
  const name = backupKey(now);
  const upload = await env.BACKUPS.createMultipartUpload(name, {
    customMetadata: {
      format: "naisema-backup-v1",
      environment: env.ENVIRONMENT,
      keyLabel: await keyLabel(secret as string),
    },
  });
  const parts: R2UploadedPart[] = [];
  let bytes = 0;
  try {
    for await (const chunk of sealChunks(key, encoded(dumpDatabase(env.DB, now, env.ENVIRONMENT)))) {
      parts.push(await upload.uploadPart(parts.length + 1, chunk));
      bytes += chunk.length;
    }
    await upload.complete(parts);
  } catch (error) {
    await upload.abort().catch(() => {});
    throw error;
  }
  const stored = await env.BACKUPS.head(name);
  if (stored?.size !== bytes) {
    throw new Error(`The backup ${name} is ${stored?.size ?? "missing"} bytes in storage, not the ${bytes} sent.`);
  }
  const removed = await pruneBackups(env.BACKUPS, now);
  logInfo("Backup taken", { name, bytes, parts: parts.length, removed: removed.length });
  return { name, bytes, removed };
}

/** Deletes backups older than 35 days, never the newest. */
export async function pruneBackups(bucket: R2Bucket, now: Date) {
  const expired = expiredBackups(
    (await listAll(bucket, BACKUP_PREFIX)).map((object) => object.key),
    now,
  );
  if (expired.length) await bucket.delete(expired);
  return expired;
}

/** The backups held, newest first, for the staff restore page. */
export async function listBackups(bucket: R2Bucket) {
  const found = (await listAll(bucket, BACKUP_PREFIX)).map(({ key, size, uploaded }) => ({ key, size, uploaded }));
  return found.sort((a, b) => b.key.localeCompare(a.key));
}
