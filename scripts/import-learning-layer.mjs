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
// This mirrors bundleStatements in app/lib/learning-layer-bundle.server.ts, which tests import into
// an empty database: keep the tables and their order the same in both. Wrangler can't bind
// parameters, so values become SQL literals here, and table and column names are checked first.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { executeSql, fail, requireTarget } from "./lib/staff-cli.mjs";

const FORMAT = "naisema.learning-layer";
const VERSION = 1;
const TABLES = [
  "user",
  "media_asset",
  "video_asset",
  "contributor",
  "content_item",
  "revision",
  "revision_submission",
  "review_assignment",
  "review_approval",
  "rights_record",
  "rights_record_contributor",
  "video_educator",
  "expression",
  "learning_layer",
  "learning_layer_revision",
  "learning_layer_educator",
  "learning_layer_submission",
  "learning_layer_review_assignment",
  "review_link",
  "review_link_access",
  "learning_layer_approval",
];
const SHARED = new Set(TABLES.slice(0, TABLES.indexOf("learning_layer")));
const POINTERS = {
  content_item: ["current_draft_revision_id", "current_published_revision_id"],
  learning_layer: ["current_draft_revision_id", "current_published_revision_id"],
};
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
if (bundle?.format !== FORMAT) fail("This isn't a NAISEMA Learning Layer export.");
if (bundle.version !== VERSION)
  fail(`This export is version ${bundle.version}; this script imports version ${VERSION}.`);
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
for (const { table, rows } of bundle.tables) {
  if (!TABLES.includes(table)) fail(`The export writes ${table}, which an import never does.`);
  const pointers = POINTERS[table] ?? [];
  for (const row of rows) {
    const columns = Object.keys(row);
    if (!columns.every((column) => IDENTIFIER.test(column))) fail(`A ${table} row has a column that isn't a name.`);
    const verb = SHARED.has(table) ? "INSERT OR IGNORE" : "INSERT";
    inserts.push(
      `${verb} INTO "${table}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES (${columns
        .map((column) => (pointers.includes(column) ? "NULL" : literal(row[column])))
        .join(", ")});`,
    );
    const set = pointers.filter((column) => row[column] !== null && row[column] !== undefined);
    if (set.length) {
      pointerUpdates.push(
        `UPDATE "${table}" SET ${set.map((column) => `"${column}" = ${literal(row[column])}`).join(", ")} WHERE id = ${literal(row.id)};`,
      );
    }
  }
}
const withdrawals = bundle.heldAtExport
  ? [
      `UPDATE "content_item" SET publication_state = 'withdrawn' WHERE id = ${literal(bundle.videoId)} AND publication_state = 'published';`,
      `UPDATE "learning_layer" SET publication_state = 'withdrawn' WHERE id = ${literal(bundle.learningLayerId)} AND publication_state = 'published';`,
    ]
  : [];

executeSql(target, [...inserts, ...pointerUpdates, ...withdrawals].join("\n"));
console.log(`Imported Learning Layer ${bundle.learningLayerId} on Video ${bundle.videoId}.`);
if (bundle.heldAtExport)
  console.log("Its Video was hidden pending a Case when exported, so both were imported withdrawn.");
