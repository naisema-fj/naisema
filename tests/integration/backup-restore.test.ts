import { applyD1Migrations, env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { pruneBackups, runBackup } from "~/lib/backup.server";
import { importBackupKey, openChunks } from "~/lib/backup-crypto";
import { backupKey, isBackedUp } from "~/lib/backup-rules";
import { getDb } from "~/lib/db.server";
import { recordObjectDeletion } from "~/lib/deletion-ledger.server";
import { deleteLearnerAccount, sha256Hex } from "~/lib/learner-records.server";
import { finishRestore, lockForRestore, replayDeletionLedger } from "~/lib/restore.server";
import { act, createArticle, type Staff, staff } from "./support/articles";
import { recordRights } from "./support/rights";
import { ADMIN } from "./support/staff";

/**
 * Backups, the deletion ledger and restoring (#34, ADR-0009, VAC-09): a nightly encrypted dump that
 * loads into a fresh database, and a ledger that deletes again whoever a restored backup brings back.
 * The test that closes the site comes first: a Worker remembers an open site for ten seconds.
 */

const PUBLIC = "https://naisema.test";
const now = () => new Date();

/** Splits a dump into statements: on semicolons outside quotes, dropping comment lines. */
function statementsOf(dump: string) {
  const statements: string[] = [];
  let current = "";
  let quoted = false;
  for (const line of dump.split("\n")) {
    if (!quoted && (line.startsWith("--") || line.trim() === "")) continue;
    current += (current ? "\n" : "") + line;
    for (const char of line) if (char === "'") quoted = !quoted;
    if (!quoted && current.endsWith(";")) {
      statements.push(current);
      current = "";
    }
  }
  return statements;
}

async function latestBackup() {
  const { objects } = await env.BACKUPS.list({ prefix: "d1/" });
  const newest = objects
    .map((object) => object.key)
    .sort()
    .at(-1) as string;
  const sealed = new Uint8Array((await (await env.BACKUPS.get(newest))?.arrayBuffer()) as ArrayBuffer);
  const key = await importBackupKey((env as unknown as Record<string, string>).BACKUP_ENCRYPTION_KEY);
  return { name: newest, sealed, dump: new TextDecoder().decode(await openChunks(key, sealed)) };
}

/** Loads a dump into the empty second database, as a restore does after the migrations. */
async function restoreInto(db: D1Database, dump: string) {
  await applyD1Migrations(db, env.TEST_MIGRATIONS);
  await db.batch(statementsOf(dump).map((statement) => db.prepare(statement)));
}

async function addLearner(name = "Learner") {
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO user (id, name, email) VALUES (?1, ?2, ?3)").bind(id, name, `${id}@naisema.test`),
    env.DB.prepare("INSERT INTO learner_account (user_id, adult_declared_at, last_active_at) VALUES (?1, 0, 0)").bind(
      id,
    ),
  ]);
  return id;
}

const exists = async (db: D1Database, id: string) =>
  (await db.prepare("SELECT id FROM user WHERE id = ?1").bind(id).first()) !== null;

describe("closing the site for a restore", () => {
  it("turns visitors away with a 503 until an administrator replays the ledger and reopens it", async () => {
    await lockForRestore(env, now());

    const closed = await SELF.fetch(`${PUBLIC}/`);
    expect(closed.status).toBe(503);
    expect(closed.headers.get("Retry-After")).toBe("300");
    expect(closed.headers.get("Cache-Control")).toBe("no-store");
    expect((await SELF.fetch(`${PUBLIC}/health`)).status).toBe(503);
    expect((await SELF.fetch(`${PUBLIC}/account/sign-in`)).status).toBe(503);

    // Staff reach the restore page on the admin host.
    const admin = await staff("admin", { role: "administrator" });
    const page = await admin.browser.fetch(`${ADMIN}/admin/restore`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("The public site is closed for a restore.");

    const replayed = await admin.browser.fetch(`${ADMIN}/admin/restore`, { form: {} });
    expect(await replayed.text()).toContain("The public site is open.");
    expect((await SELF.fetch(`${PUBLIC}/health`)).status).toBe(200);
  });

  it("stays closed if the ledger names something the replay can't delete", async () => {
    await lockForRestore(env, now());
    await recordObjectDeletion(env.LEDGER, "mystery_table", "abc-123", now());
    const actor = await staff("admin", { role: "administrator" });

    const result = await finishRestore(env, getDb(env.DB), actor.userId);

    expect(result).toMatchObject({ reopened: false, unknown: ["mystery_table/abc-123"] });
    expect(await env.LEDGER.head("state/restore-lock")).not.toBeNull();
    await env.LEDGER.delete(["object/mystery_table/abc-123", "state/restore-lock"]);
  });

  it("is for administrators alone", async () => {
    const editor = await staff("editor", { role: "editor" });
    expect((await editor.browser.fetch(`${ADMIN}/admin/restore`)).status).toBe(403);
    expect((await editor.browser.fetch(`${ADMIN}/admin/restore`, { form: {} })).status).toBe(403);
  });
});

describe("the nightly backup", () => {
  it("is encrypted, holds the data and not the sessions, and loads into a fresh database with search working", async () => {
    const editor: Staff = await staff("editor", { role: "editor" });
    const term = `w${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
    const article = await createArticle(editor, {
      flag: [],
      languageVariety: "",
      title: `O'Brien's ${term}\nsecond line`,
    });
    await recordRights(editor.browser, article.id);
    await act(editor, article.id, 1, { intent: "submit" });
    await act(editor, article.id, 1, { intent: "publish" });

    const taken = new Date("2026-10-12T14:20:05Z");
    const { name, bytes } = await runBackup(env, taken);

    expect(name).toBe(backupKey(taken));
    const { sealed, dump } = await latestBackup();
    expect(sealed.length).toBe(bytes);
    expect(new TextDecoder().decode(sealed.subarray(0, 200))).not.toContain("INSERT");
    const stored = await env.BACKUPS.head(name);
    expect(stored?.customMetadata).toMatchObject({ format: "naisema-backup-v1", environment: env.ENVIRONMENT });
    expect(dump).toContain('INSERT OR REPLACE INTO "user"');
    expect(dump).toContain("O''Brien''s");
    expect(dump).not.toContain('INTO "session"');
    expect(dump).not.toContain("search_fts");

    await restoreInto(env.IMPORT_DB, dump);

    expect((await env.IMPORT_DB.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
    const copied = async (db: D1Database, table: string) =>
      (await db.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>())?.n;
    for (const table of ["user", "content_item", "revision", "rights_record", "audit_event", "search_entry"]) {
      expect(await copied(env.IMPORT_DB, table), table).toBe(await copied(env.DB, table));
    }
    const title = await env.IMPORT_DB.prepare("SELECT title FROM search_entry WHERE content_item_id = ?1")
      .bind(article.id)
      .first<{ title: string }>();
    expect(title?.title).toBe(`O'Brien's ${term}\nsecond line`);
    // The full-text index, which a backup can't hold, refilled as the entries loaded.
    const found = await env.IMPORT_DB.prepare("SELECT rowid FROM search_fts WHERE search_fts MATCH ?1")
      .bind(`${term}*`)
      .all();
    expect(found.results).toHaveLength(1);
  });

  it("leaves out nothing that a table it keeps depends on", async () => {
    const { results: tables } = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all<{
      name: string;
    }>();
    const kept = tables.map((table) => table.name).filter(isBackedUp);
    const missing: string[] = [];
    for (const table of kept) {
      const { results } = await env.DB.prepare(`PRAGMA foreign_key_list("${table}")`).all<{ table: string }>();
      for (const { table: parent } of results) if (!kept.includes(parent)) missing.push(`${table} -> ${parent}`);
    }
    expect(missing).toEqual([]);
  });

  it("is refused without a valid key, leaving nothing half-written", async () => {
    const before = (await env.BACKUPS.list({ prefix: "d1/" })).objects.length;

    await expect(runBackup({ ...env, BACKUP_ENCRYPTION_KEY: undefined } as unknown as Env, now())).rejects.toThrow(
      "BACKUP_ENCRYPTION_KEY isn't set",
    );

    expect((await env.BACKUPS.list({ prefix: "d1/" })).objects).toHaveLength(before);
  });

  it("keeps 35 days of backups and never removes the newest", async () => {
    for (const at of ["2026-08-01T14:20", "2026-09-30T14:20", "2026-10-11T14:20"])
      await env.BACKUPS.put(backupKey(new Date(`${at}:00Z`)), "x");

    const removed = await pruneBackups(env.BACKUPS, new Date("2026-10-12T14:20:00Z"));

    expect(removed).toContain("d1/2026-08-01T1420Z.sql.enc");
    expect(removed).not.toContain("d1/2026-09-30T1420Z.sql.enc");
    expect(await env.BACKUPS.head("d1/2026-10-11T1420Z.sql.enc")).not.toBeNull();
    expect(await env.BACKUPS.head("d1/2026-08-01T1420Z.sql.enc")).toBeNull();
  });
});

describe("the deletion ledger", () => {
  it("keeps a deleted learner deleted after a backup from before the deletion is restored", async () => {
    const deleted = await addLearner("Asked to be deleted");
    const kept = await addLearner("Stays");
    await runBackup(env, new Date("2026-10-12T14:21:00Z"));
    const { dump } = await latestBackup();

    await deleteLearnerAccount(env, getDb(env.DB), deleted, "learner.deleted");
    expect(await exists(env.DB, deleted)).toBe(false);

    // The restored database brings the learner back...
    await restoreInto(env.IMPORT_DB, dump);
    expect(await exists(env.IMPORT_DB, deleted)).toBe(true);
    // ...until the ledger, which the restore didn't touch, is replayed.
    const result = await replayDeletionLedger(env, getDb(env.IMPORT_DB));

    expect(result.learners).toBeGreaterThanOrEqual(1);
    expect(await exists(env.IMPORT_DB, deleted)).toBe(false);
    expect(await exists(env.IMPORT_DB, kept)).toBe(true);
    const audited = await env.IMPORT_DB.prepare(
      "SELECT details FROM audit_event WHERE action = 'learner_account.deleted' AND object_id = ?1",
    )
      .bind(await sha256Hex(deleted))
      .all<{ details: string }>();
    expect(audited.results.map((row) => JSON.parse(row.details).reason)).toContain("Deleted again after a restore");
    // Replaying again changes nothing.
    expect(await replayDeletionLedger(env, getDb(env.IMPORT_DB))).toMatchObject({ learners: 0 });
  });

  it("never deletes a staff account, even one whose hash is in the ledger", async () => {
    const id = await addLearner("Became staff");
    await env.DB.prepare(
      "INSERT INTO role_assignment (id, user_id, role, granted_by, granted_at) VALUES (?1, ?2, 'editor', 'test', 0)",
    )
      .bind(crypto.randomUUID(), id)
      .run();
    await env.LEDGER.put(`learner/${await sha256Hex(id)}`, JSON.stringify({ reason: "learner.deleted" }));

    await replayDeletionLedger(env, getDb(env.DB));

    expect(await exists(env.DB, id)).toBe(true);
  });

  it("deletes a record named by type and ID again, and is only ever added to", async () => {
    const notice = await env.DB.prepare("SELECT id FROM notice LIMIT 1").first<{ id: string }>();
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO consent_record (id, purpose, notice_id, email, source_form, given_at) VALUES (?1, 'newsletter', ?2, 'a@naisema.test', 'newsletter', 0)",
    )
      .bind(id, notice?.id)
      .run();
    await recordObjectDeletion(env.LEDGER, "consent_record", id, now());
    // Recording the same deletion again leaves the first entry as it was.
    const first = await (await env.LEDGER.get(`object/consent_record/${id}`))?.text();
    await recordObjectDeletion(env.LEDGER, "consent_record", id, new Date("2030-01-01T00:00:00Z"));
    expect(await (await env.LEDGER.get(`object/consent_record/${id}`))?.text()).toBe(first);

    const result = await replayDeletionLedger(env, getDb(env.DB));

    expect(result.objects).toBeGreaterThanOrEqual(1);
    expect(await env.DB.prepare("SELECT id FROM consent_record WHERE id = ?1").bind(id).first()).toBeNull();
    await expect(recordObjectDeletion(env.LEDGER, "../x", "y", now())).rejects.toThrow();
  });

  it("writes the ledger before deleting, so a ledger that can't be written deletes nothing", async () => {
    const id = await addLearner();
    const broken = { ...env, LEDGER: { put: () => Promise.reject(new Error("R2 unavailable")) } } as unknown as Env;

    await expect(deleteLearnerAccount(broken, getDb(env.DB), id, "learner.deleted")).rejects.toThrow("R2 unavailable");

    expect(await exists(env.DB, id)).toBe(true);
  });
});
