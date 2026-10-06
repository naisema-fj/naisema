// Imports a Learning Layer export (Staff area → Exports) into a D1 database, so it plays there as it
// did where it came from (VAC-09). Meant for an empty database, such as staging after a reset:
//
//   pnpm learning-layer:import --env staging --file naisema-learning-layer-<id>-<date>.json
//   pnpm learning-layer:import --local --file <export>.json
//
// The footage and evidence files the rows name must be copied into the target's R2 buckets too, and
// its Stream copy must be in the same Stream account (docs/handover/exports.md). Rows for the Video,
// its files and the Expression library that are already there are kept; a Learning Layer already
// there refuses the import.
//
// The tables, their order and the revision pointers come from app/lib/learning-layer-bundle.json,
// as for importLearningLayerBundle in app/lib/learning-layer-bundle.server.ts, which tests import
// into an empty database: this makes the same statements in the same order. Wrangler can't bind
// parameters, so values become SQL literals here, and table and column names are checked first.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import BUNDLE from "../app/lib/learning-layer-bundle.json" with { type: "json" };
import { executeSql, fail, requireTarget } from "./lib/staff-cli.mjs";

const SHARED = new Set(BUNDLE.tables.slice(0, BUNDLE.tables.indexOf(BUNDLE.firstOwnTable)));
const IDENTIFIER = /^[a-z][a-z0-9_]{0,62}$/;

const { values } = parseArgs({
  options: { env: { type: "string" }, local: { type: "boolean", default: false }, file: { type: "string" } },
});
const target = requireTarget(values);
if (!values.file) fail("Pass --file with a Learning Layer export.");

let bundle;
try {
  bundle = JSON.parse(readFileSync(values.file, "utf8"));
} catch (error) {
  fail(`Couldn't read ${values.file}: ${error.message}`);
}
if (bundle?.format !== BUNDLE.format) fail("This isn't a NAISEMA Learning Layer export.");
if (bundle.version !== BUNDLE.version) {
  fail(`This export is version ${bundle.version}; this script imports version ${BUNDLE.version}.`);
}
if (!Array.isArray(bundle.tables)) fail("The export has no tables.");

/** A value as an SQL literal: text quoted, nested JSON back to text, booleans as 0 or 1. */
function literal(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("The export holds a number SQL can't store.");
    return String(value);
  }
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `'${text.replaceAll("'", "''")}'`;
}

const inserts = [];
const pointerUpdates = [];
for (const entry of bundle.tables) {
  const { table, rows } = entry ?? {};
  if (!BUNDLE.tables.includes(table)) fail(`The export writes ${table}, which an import never does.`);
  const readable = (row) =>
    typeof row === "object" &&
    row !== null &&
    !Array.isArray(row) &&
    Object.keys(row).every((column) => IDENTIFIER.test(column));
  if (!Array.isArray(rows) || !rows.every(readable)) fail(`Its ${table} rows aren't readable.`);
  const pointers = BUNDLE.revisionPointers[table] ?? [];
  const verb = SHARED.has(table) ? "INSERT OR IGNORE" : "INSERT";
  for (const row of rows) {
    const columns = Object.keys(row);
    inserts.push(
      `${verb} INTO "${table}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES (${columns
        .map((column) => (pointers.includes(column) ? "NULL" : literal(row[column])))
        .join(", ")});`,
    );
    const set = pointers.filter((column) => row[column] !== null && row[column] !== undefined);
    if (set.length) {
      // Only a row just added has an empty draft pointer: a Video already there keeps its own.
      pointerUpdates.push(
        `UPDATE "${table}" SET ${set.map((column) => `"${column}" = ${literal(row[column])}`).join(", ")} WHERE id = ${literal(row.id)} AND current_draft_revision_id IS NULL;`,
      );
    }
  }
}
const withdrawals = bundle.heldAtExport
  ? [
      ["content_item", bundle.videoId],
      ["learning_layer", bundle.learningLayerId],
    ].map(
      ([table, id]) =>
        `UPDATE "${table}" SET publication_state = 'withdrawn' WHERE id = ${literal(id)} AND current_draft_revision_id IS NULL AND publication_state = 'published';`,
    )
  : [];
const audit = `INSERT INTO audit_event (id, actor_id, action, object_type, object_id, details, created_at) VALUES (${literal(randomUUID())}, NULL, 'learning_layer.imported', 'learning_layer', ${literal(bundle.learningLayerId)}, ${literal({ videoId: bundle.videoId, via: "script", heldAtExport: Boolean(bundle.heldAtExport) })}, ${Date.now()});`;

executeSql(target, [...inserts, ...withdrawals, ...pointerUpdates, audit].join("\n"));
console.log(`Imported Learning Layer ${bundle.learningLayerId} on Video ${bundle.videoId}.`);
if (bundle.heldAtExport)
  console.log("Its Video was hidden pending a Case when exported, so both were imported withdrawn.");
