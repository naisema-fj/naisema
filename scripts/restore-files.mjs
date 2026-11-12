// Puts a backup's files back into an environment's R2 bucket:
// `node scripts/restore-files.mjs <local|staging|production> <folder>`, where <folder> is what
// `scripts/backup.mjs` wrote (decrypted, as the runbook's "Backups and restoring" says). Each file
// goes back under its own key with its own type, so the restored database's media rows and Rights
// Records find them. It overwrites a file already there with the same key, and touches no other.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { wrangler } from "./wrangler.mjs";

const BUCKETS = {
  local: "naisema-dev-media",
  staging: "naisema-staging-media",
  production: "naisema-production-media",
};
const [target, folder] = process.argv.slice(2);
if (!Object.hasOwn(BUCKETS, target) || !folder || !existsSync(join(folder, "manifest.json"))) {
  console.error("Usage: node scripts/restore-files.mjs <local|staging|production> <backup folder with manifest.json>");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(join(folder, "manifest.json"), "utf8"));
if (manifest.environment !== target) {
  console.warn(`This backup is of ${manifest.environment}, and is being restored into ${target}.`);
}
for (const { key, contentType } of manifest.files) {
  if (!/^(media|evidence)\/[\w-]+$/.test(key)) throw new Error(`Refusing an unexpected key: ${key}`);
  wrangler([
    "r2",
    "object",
    "put",
    `${BUCKETS[target]}/${key}`,
    target === "local" ? "--local" : "--remote",
    "--file",
    join(folder, "files", key),
    "--content-type",
    contentType,
  ]);
}
console.log(`Restored ${manifest.files.length} files into ${BUCKETS[target]}.`);
