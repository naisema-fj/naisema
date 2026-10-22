// Writes docs/handover/data-dictionary.md from the Drizzle schema (db/schema.ts), so it can't drift
// from the database.
//
//   pnpm docs:data-dictionary          rewrite the file
//   pnpm docs:data-dictionary --check  fail if the committed file is out of date (CI runs this)
//
// Structure (types, nullability, defaults, references) comes from Drizzle itself; purposes come from
// the doc comments above each table and column in the schema. Node strips the TypeScript types.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import * as schema from "../db/schema.ts";

const root = new URL("../", import.meta.url);
const schemaSource = readFileSync(new URL("db/schema.ts", root), "utf8");
const outputPath = fileURLToPath(new URL("docs/handover/data-dictionary.md", root));

/** Doc comments from the schema source: a table's by its SQL name, a column's by table and property key. */
function readComments(source) {
  const tableDocs = new Map();
  const columnDocs = new Map();
  let pending = [];
  let table = null;
  let inBlock = false;
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (inBlock) {
      pending.push(
        trimmed
          .replace(/^\*\/?\s?/, "")
          .replace(/\*\/$/, "")
          .trim(),
      );
      if (trimmed.endsWith("*/")) inBlock = false;
      continue;
    }
    if (trimmed.startsWith("/**")) {
      const text = trimmed
        .replace(/^\/\*\*\s?/, "")
        .replace(/\*\/$/, "")
        .trim();
      pending = [text];
      inBlock = !trimmed.endsWith("*/");
      continue;
    }
    if (trimmed.startsWith("//") && !trimmed.startsWith("// ---")) {
      if (table) pending.push(trimmed.replace(/^\/\/\s?/, ""));
      continue;
    }
    const open = trimmed.match(/^export const (\w+) = sqliteTable\(\s*(?:"(\w+)")?/);
    if (open) {
      table = open[1];
      if (pending.length) tableDocs.set(table, clean(pending));
      pending = [];
      continue;
    }
    const column = line.match(/^ {2,4}(\w+): /);
    if (column && table && pending.length) columnDocs.set(`${table}.${column[1]}`, clean(pending));
    pending = [];
  }
  return { tableDocs, columnDocs };
}

const clean = (lines) => lines.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
const cell = (text) => text.replaceAll("|", "\\|");
const tableName = (table) => getTableConfig(table).name;

const { tableDocs, columnDocs } = readComments(schemaSource);
const tables = Object.entries(schema).filter(([, value]) => isTable(value));

function isTable(value) {
  try {
    return getTableConfig(value).columns.length > 0;
  } catch {
    return false;
  }
}

function describeDefault(column) {
  if (!column.hasDefault) return "";
  const value = column.default;
  if (value === undefined) return "set by the database";
  if (value && typeof value === "object") return "set by the database";
  return `\`${JSON.stringify(value)}\``;
}

const lines = [
  "# Data dictionary",
  "",
  "Every table and column in the NAISEMA database. This file is generated from `db/schema.ts` by `pnpm docs:data-dictionary`; do not edit it by hand. CI fails if it is out of date. To change a description, change the comment above the table or column in the schema.",
  "",
  'Types are SQLite\'s. Dates are stored as integer milliseconds since 1970 (UTC). Columns marked "JSON" hold JSON text. The full-text search table `search_fts` is created by a migration (`migrations/0006_search.sql`) rather than the schema, so it is not listed here.',
  "",
  `${tables.length} tables.`,
  "",
  "## Tables",
  "",
  ...tables.map(([, table]) => `- [\`${tableName(table)}\`](#${tableName(table)})`),
  "",
];

for (const [key, table] of tables) {
  const config = getTableConfig(table);
  const references = new Map();
  for (const foreignKey of config.foreignKeys) {
    const { columns, foreignTable, foreignColumns } = foreignKey.reference();
    columns.forEach((column, index) => {
      references.set(column.name, `${tableName(foreignTable)}.${foreignColumns[index].name}`);
    });
  }
  const propertyOf = new Map(Object.entries(table).map(([property, column]) => [column?.name, property]));
  lines.push(`## ${config.name}`, "");
  if (tableDocs.get(key)) lines.push(tableDocs.get(key), "");
  lines.push(
    "| Column | Type | Can be empty | Default | References | Purpose |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const column of config.columns) {
    const kind = column.columnType === "SQLiteTextJson" ? "text (JSON)" : column.getSQLType();
    const purpose = columnDocs.get(`${key}.${propertyOf.get(column.name)}`) ?? "";
    const flags = [column.primary ? "primary key" : "", column.isUnique ? "unique" : ""].filter(Boolean);
    lines.push(
      `| \`${column.name}\` | ${kind}${flags.length ? ` (${flags.join(", ")})` : ""} | ${column.notNull ? "no" : "yes"} | ${cell(describeDefault(column))} | ${references.has(column.name) ? `\`${references.get(column.name)}\`` : ""} | ${cell(purpose)} |`,
    );
  }
  lines.push("");
}

const output = `${lines.join("\n").trimEnd()}\n`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(outputPath, "utf8");
  } catch {}
  if (current !== output) {
    console.error(
      "docs/handover/data-dictionary.md is out of date with db/schema.ts. Run `pnpm docs:data-dictionary` and commit the result.",
    );
    process.exit(1);
  }
  console.log("Data dictionary is up to date.");
} else {
  writeFileSync(outputPath, output);
  console.log(`Wrote ${outputPath} (${tables.length} tables).`);
}
