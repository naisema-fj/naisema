import { describe, expect, it } from "vitest";
import { importBackupKey, openChunks, sealChunks } from "~/lib/backup-crypto";
import { backupKey, backupTime, expiredBackups, insertStatement, isBackedUp, sqlLiteral } from "~/lib/backup-rules";

const SECRET = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

async function* pieces(...parts: Uint8Array[]) {
  for (const part of parts) yield part;
}

async function collect(chunks: AsyncIterable<Uint8Array>) {
  const all: Uint8Array[] = [];
  for await (const chunk of chunks) all.push(chunk);
  return all;
}

const join = (parts: Uint8Array[]) => Uint8Array.from(parts.flatMap((part) => [...part]));

describe("backup encryption", () => {
  it("seals in equal chunks, marks the last, and opens to the same bytes", async () => {
    const key = await importBackupKey(SECRET);
    const plain = Uint8Array.from({ length: 25 }, (_, index) => index);

    const sealed = await collect(sealChunks(key, pieces(plain.subarray(0, 7), plain.subarray(7)), 10));

    expect(sealed.map((chunk) => chunk.length)).toEqual([38, 38, 33]);
    expect([...(await openChunks(key, join(sealed), 10))]).toEqual([...plain]);
  });

  it("seals an exact multiple of the chunk size, and nothing at all, as valid backups", async () => {
    const key = await importBackupKey(SECRET);
    const exact = Uint8Array.from({ length: 20 }, (_, index) => index);

    const sealed = join(await collect(sealChunks(key, pieces(exact), 10)));
    const empty = join(await collect(sealChunks(key, pieces(), 10)));

    expect([...(await openChunks(key, sealed, 10))]).toEqual([...exact]);
    expect(sealed.length).toBe(76);
    expect((await openChunks(key, empty, 10)).length).toBe(0);
  });

  it("refuses a backup cut short, changed, or opened with another key", async () => {
    const key = await importBackupKey(SECRET);
    const sealed = await collect(sealChunks(key, pieces(new Uint8Array(25).fill(1)), 10));

    await expect(openChunks(key, join(sealed.slice(0, 2)), 10)).rejects.toThrow();
    const changed = join(sealed);
    changed[20] ^= 1;
    await expect(openChunks(key, changed, 10)).rejects.toThrow();
    const other = await importBackupKey(btoa(String.fromCharCode(...new Uint8Array(32).fill(9))));
    await expect(openChunks(other, join(sealed), 10)).rejects.toThrow();
  });

  it("explains a key that is missing or the wrong size", async () => {
    await expect(importBackupKey(undefined)).rejects.toThrow("isn't set");
    await expect(importBackupKey(btoa("short"))).rejects.toThrow("32 bytes");
    await expect(importBackupKey("not base64!")).rejects.toThrow("isn't base64");
  });
});

describe("backup names and retention", () => {
  it("names a backup for the minute it started and reads the time back", () => {
    const at = new Date("2026-10-12T14:20:31Z");
    expect(backupKey(at)).toBe("d1/2026-10-12T1420Z.sql.enc");
    expect(backupTime(backupKey(at))).toEqual(new Date("2026-10-12T14:20:00Z"));
    expect(backupTime("d1/readme.txt")).toBeNull();
  });

  it("deletes backups older than 35 days, but never the newest", () => {
    const now = new Date("2026-10-12T14:20:00Z");
    const keys = [
      "d1/2026-10-12T1420Z.sql.enc",
      "d1/2026-09-08T1420Z.sql.enc", // 34 days
      "d1/2026-09-06T1420Z.sql.enc", // 36 days
      "d1/2026-08-01T1420Z.sql.enc",
      "d1/notes.txt",
    ];
    expect(expiredBackups(keys, now)).toEqual(["d1/2026-09-06T1420Z.sql.enc", "d1/2026-08-01T1420Z.sql.enc"]);
    // Backups stopped long ago: the latest one stays.
    expect(expiredBackups(keys, new Date("2027-03-01T00:00:00Z"))).toEqual(keys.slice(1, 4));
  });
});

describe("backup contents", () => {
  it("leaves out sessions, sign-in links, migrations bookkeeping and the search index", () => {
    for (const table of [
      "session",
      "verification",
      "d1_migrations",
      "sqlite_sequence",
      "_cf_KV",
      "search_fts",
      "search_fts_data",
    ])
      expect(isBackedUp(table), table).toBe(false);
    for (const table of ["user", "search_entry", "audit_event"]) expect(isBackedUp(table), table).toBe(true);
  });

  it("writes values as SQL", () => {
    expect(sqlLiteral("it's")).toBe("'it''s'");
    expect(sqlLiteral(null)).toBe("NULL");
    expect(sqlLiteral(12)).toBe("12");
    expect(sqlLiteral([0, 255])).toBe("X'00ff'");
    expect(insertStatement("a", { x: 1, 'y"z': "q" })).toBe(
      `INSERT OR REPLACE INTO "a" ("x", "y""z") VALUES (1, 'q');\n`,
    );
  });
});

describe("scripts/decrypt-backup.mjs", () => {
  it("opens the chunks the Worker seals, and refuses a wrong key or a chunk marked wrongly", async () => {
    // @ts-expect-error a plain Node script, with no types
    const { importKey, openChunk } = await import("../../scripts/decrypt-backup.mjs");
    const key = await importBackupKey(SECRET);
    const plain = Uint8Array.from({ length: 25 }, (_, index) => index);
    const [first, second, third] = await collect(sealChunks(key, pieces(plain), 10));

    const opened = [
      await openChunk(await importKey(SECRET), first, false),
      await openChunk(await importKey(SECRET), second, false),
      await openChunk(await importKey(SECRET), third, true),
    ];

    expect([...join(opened)]).toEqual([...plain]);
    await expect(openChunk(await importKey(SECRET), third, false)).rejects.toThrow();
    await expect(
      openChunk(await importKey(btoa(String.fromCharCode(...new Uint8Array(32).fill(9)))), first, false),
    ).rejects.toThrow();
    await expect(importKey("short")).rejects.toThrow("32 bytes");
  });
});
