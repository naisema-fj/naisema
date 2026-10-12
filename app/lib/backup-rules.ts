/**
 * The rules of the nightly backup (ADR-0009, docs/handover/runbook.md, backups): how each file is
 * named, how long it is kept, what goes into it and how a value is written as SQL. The Worker's
 * part (reading D1, encrypting, writing to R2) is in app/lib/backup.server.ts.
 */

/** Nightly backups are kept this long (docs/decision-log.md, data policy). */
export const BACKUP_KEEP_DAYS = 35;
const DAY_MS = 86_400_000;

/** Where in the BACKUPS bucket the D1 backups go. */
export const BACKUP_PREFIX = "d1/";

/** `d1/2026-10-12T1420Z.sql.enc`: sorts by time, and names the minute it started. */
export function backupKey(at: Date) {
  return `${BACKUP_PREFIX}${at.toISOString().slice(0, 16).replace(":", "")}Z.sql.enc`;
}

/** When a backup was taken, from its name; null for anything else in the bucket. */
export function backupTime(key: string) {
  const match = /^d1\/(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})Z\.sql\.enc$/.exec(key);
  if (!match) return null;
  const at = new Date(`${match[1]}T${match[2]}:${match[3]}:00Z`);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * The backups to delete: those older than 35 days. The newest backup is never deleted, so a run of
 * failed backups can't empty the bucket before anyone notices.
 */
export function expiredBackups(keys: string[], now: Date) {
  const dated = keys
    .flatMap((key) => {
      const at = backupTime(key);
      return at ? [{ key, at }] : [];
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  const cutoff = now.getTime() - BACKUP_KEEP_DAYS * DAY_MS;
  return dated
    .slice(1)
    .filter(({ at }) => at.getTime() < cutoff)
    .map(({ key }) => key);
}

/**
 * Tables left out of the backup. The backup holds data only: a restore applies the migrations to
 * an empty database first, then loads the data, so the full-text index (which D1 can't export) is
 * rebuilt by its own triggers as `search_entry` fills. Sessions (and the staff sign-in state kept
 * with them) and unused sign-in links are left out too, so a restore signs everyone out rather than reviving access.
 */
const LEFT_OUT = new Set(["d1_migrations", "session", "staff_session", "verification"]);

export function isBackedUp(table: string) {
  return (
    !LEFT_OUT.has(table) && !table.startsWith("sqlite_") && !table.startsWith("_cf_") && !table.startsWith("search_fts")
  );
}

/** A value as it is written in an INSERT statement. */
export function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
  if (value instanceof ArrayBuffer || Array.isArray(value)) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : Uint8Array.from(value as number[]);
    return `X'${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}'`;
  }
  throw new Error(`Can't write a ${typeof value} as SQL`);
}

export const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`;

/**
 * A row as a statement. `INSERT OR REPLACE`, because the database a backup is loaded into was just
 * migrated, and some migrations add rows of their own (such as the consent notices): the backup's
 * version of those rows wins.
 */
export function insertStatement(table: string, row: Record<string, unknown>) {
  const columns = Object.keys(row);
  return `INSERT OR REPLACE INTO ${quoted(table)} (${columns.map(quoted).join(", ")}) VALUES (${columns.map((column) => sqlLiteral(row[column])).join(", ")});\n`;
}
