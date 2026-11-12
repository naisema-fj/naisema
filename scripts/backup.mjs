// Copies one environment out of Cloudflare: `node scripts/backup.mjs <local|staging|production> <folder>`.
// The folder gets the database as SQL (`database.sql`), every file the database names in the R2
// bucket, media and Rights Record evidence alike (`files/<key>`), and `manifest.json`, listing each
// file's key and type so `scripts/restore-files.mjs` can put them back. Wrangler can't list a
// bucket, so the files are the ones the `media` and `rights_record` tables point to.
//
// The weekly GitHub Action runs it, then encrypts the folder (.github/workflows/backup.yml). The
// folder holds personal data (staff addresses, form submissions, signed permissions): never leave
// it unencrypted anywhere but your own computer, and never put it in the repository.
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { wrangler, wranglerOutput } from "./wrangler.mjs";

const BUCKETS = {
  local: "naisema-dev-media",
  staging: "naisema-staging-media",
  production: "naisema-production-media",
};
const [target, folder] = process.argv.slice(2);
if (!Object.hasOwn(BUCKETS, target) || !folder) {
  console.error("Usage: node scripts/backup.mjs <local|staging|production> <folder>");
  process.exit(1);
}
const where = target === "local" ? ["--local"] : ["--remote", "--env", target];

/** Rows from a read-only query, as objects. */
function query(sql) {
  const output = wranglerOutput(["d1", "execute", "DB", ...where, "--json", "--command", sql]);
  return JSON.parse(output.slice(output.indexOf("[")))[0].results;
}

/** Evidence has no stored type in the database, so it is read from the file's first bytes. */
function sniff(path) {
  const head = readFileSync(path).subarray(0, 12);
  const text = head.toString("latin1");
  if (text.startsWith("%PDF-")) return "application/pdf";
  if (head[0] === 0xff && head[1] === 0xd8) return "image/jpeg";
  if (text.startsWith("\x89PNG")) return "image/png";
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP") return "image/webp";
  return "application/octet-stream";
}

mkdirSync(join(folder, "files"), { recursive: true });
wrangler(["d1", "export", "DB", ...where, "--output", join(folder, "database.sql")]);

const wanted = [
  ...query("SELECT key, content_type FROM media").map((row) => ({ key: row.key, contentType: row.content_type })),
  ...query("SELECT DISTINCT evidence_key AS key FROM rights_record WHERE evidence_key IS NOT NULL").map((row) => ({
    key: row.key,
    contentType: null,
  })),
];

const files = [];
const missing = [];
for (const { key, contentType } of wanted) {
  // Keys are written by the app as media/<id> or evidence/<id>; anything else isn't copied.
  if (!/^(media|evidence)\/[\w-]+$/.test(key)) {
    missing.push({ key, why: "not a key the app writes" });
    continue;
  }
  const path = join(folder, "files", key);
  mkdirSync(dirname(path), { recursive: true });
  try {
    wrangler(["r2", "object", "get", `${BUCKETS[target]}/${key}`, ...where.slice(0, 1), "--file", path]);
  } catch {
    // One lost file mustn't stop the rest of the backup; it is named in the manifest instead.
    missing.push({ key, why: "not in the bucket" });
    continue;
  }
  files.push({ key, contentType: contentType ?? sniff(path), bytes: statSync(path).size });
}

writeFileSync(
  join(folder, "manifest.json"),
  `${JSON.stringify({ environment: target, exportedAt: new Date().toISOString(), files, missing }, null, 2)}\n`,
);
console.log(`Backed up the database and ${files.length} files to ${folder}.`);
if (missing.length) {
  console.warn(`::warning::Some files the database names couldn't be copied (${missing.length}); see manifest.json.`);
}
