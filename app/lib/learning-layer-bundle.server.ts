import type { ArticleSnapshot } from "./article-fields";
import type { Database } from "./db.server";
import type { LearningLayerSnapshot } from "./learning-layer-fields";
import { mediaAssetIdsIn } from "./media-in-use";
import { toWebVtt } from "./webvtt";

/**
 * A complete Learning Layer, exported so it can be rebuilt in an empty database (VCMS-06, VAC-09):
 * its rows, and the rows of everything it needs to be public there, table by table in the order
 * they can be inserted. IDs are kept, so Segments, tokens, Annotations, Expressions, Activities and
 * approvals keep theirs, and so do the files the rows point at (masters, evidence, Stream's copy).
 *
 * Rows are the database's own (column names and values as stored: times in milliseconds since
 * 1970, booleans as 0 or 1), with JSON columns parsed so the file reads as one JSON document.
 * Staff are carried only as an ID and name, with an address that can't receive mail, and Review
 * Links without their token. docs/handover/exports.md describes the format;
 * scripts/import-learning-layer.mjs imports it with Wrangler, `importLearningLayerBundle` in a Worker.
 */

export const BUNDLE_FORMAT = "naisema.learning-layer";
export const BUNDLE_VERSION = 1;

/** Tables a bundle may write, in the order they are inserted (each after the tables it points at). */
export const BUNDLE_TABLES = [
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
] as const;
type BundleTable = (typeof BUNDLE_TABLES)[number];

/**
 * A Content Item and a Learning Layer point at their Revisions, which point back: these columns
 * are inserted empty and set once the Revisions are in.
 */
export const REVISION_POINTERS: Partial<Record<BundleTable, string[]>> = {
  content_item: ["current_draft_revision_id", "current_published_revision_id"],
  learning_layer: ["current_draft_revision_id", "current_published_revision_id"],
};

/**
 * Tables the Learning Layer shares with others on its Video, or with the library: a row already in
 * the database is kept, so a second Learning Layer on the same Video imports beside the first.
 * Everything before the Learning Layer's own rows.
 */
export const SHARED_TABLES: readonly BundleTable[] = BUNDLE_TABLES.slice(0, BUNDLE_TABLES.indexOf("learning_layer"));

const JSON_COLUMNS = new Set(["snapshot", "fingerprints", "details", "permitted_uses", "fields"]);

type Row = Record<string, unknown>;

export type LearningLayerBundle = {
  format: typeof BUNDLE_FORMAT;
  version: typeof BUNDLE_VERSION;
  learningLayerId: string;
  videoId: string;
  /**
   * The Video was hidden pending a Case when exported. The hold, which belongs to the Case, isn't
   * exported, so an import brings the Video and the Learning Layer in withdrawn.
   */
  heldAtExport: boolean;
  /** Each Learning Layer Revision's captions as WebVTT, in the video's time: derived, never imported. */
  captions: Record<string, { fijian: string; english: string }>;
  tables: { table: BundleTable; rows: Row[] }[];
};

/** The bundle for one Learning Layer, or null when there is none by that ID. */
export async function learningLayerBundle(
  db: Database,
  learningLayerId: string,
): Promise<Omit<LearningLayerBundle, "format" | "version"> | null> {
  const client = db.$client;
  const select = async (query: string, ...params: unknown[]) =>
    (
      (
        await client
          .prepare(query)
          .bind(...params)
          .all<Row>()
      ).results ?? []
    ).map(readable);
  /** Rows whose column is one of the values, in one JSON parameter however many there are. */
  const among = (table: string, column: string, values: unknown[], order = "rowid") =>
    select(
      `SELECT * FROM ${table} WHERE ${column} IN (SELECT value FROM json_each(?1)) ORDER BY ${order}`,
      JSON.stringify([...new Set(values.filter((value) => value !== null && value !== undefined))]),
    );

  const [layer] = await select("SELECT * FROM learning_layer WHERE id = ?1", learningLayerId);
  if (!layer) return null;
  const videoId = String(layer.content_item_id);
  const contentItems = await select("SELECT * FROM content_item WHERE id = ?1", videoId);
  const revisions = await select("SELECT * FROM revision WHERE content_item_id = ?1 ORDER BY number", videoId);
  const revisionIds = revisions.map((row) => row.id);
  const layerRevisions = await select(
    "SELECT * FROM learning_layer_revision WHERE learning_layer_id = ?1 ORDER BY number",
    learningLayerId,
  );
  const layerRevisionIds = layerRevisions.map((row) => row.id);
  const layerSnapshots = layerRevisions.map((row) => row.snapshot as LearningLayerSnapshot);

  // The files the Video's Revisions show (its footage, images in its body), each with its own rights.
  const mediaIds = revisions.flatMap((row) => mediaAssetIdsIn(row.snapshot as ArticleSnapshot));
  const rights = await select(
    `SELECT * FROM rights_record
      WHERE (subject_type = 'content_item' AND subject_id = ?1)
         OR (subject_type = 'media_asset' AND subject_id IN (SELECT value FROM json_each(?2)))
      ORDER BY created_at`,
    videoId,
    JSON.stringify(mediaIds),
  );
  const rightsContributors = await among(
    "rights_record_contributor",
    "rights_record_id",
    rights.map((row) => row.id),
  );
  const reviewLinks = (await among("review_link", "revision_id", layerRevisionIds, "created_at")).map(
    (row): Row => ({
      ...row,
      // Never the token's hash: an imported link can't be opened, and its rows still say who saw what.
      token_hash: `exported:${row.id}`,
    }),
  );
  const layerApprovals = await among("learning_layer_approval", "revision_id", layerRevisionIds, "decided_at");
  const evidenceIds = [...rights, ...layerApprovals].map((row) => row.evidence_asset_id);
  const mediaAssets = await among("media_asset", "id", [...mediaIds, ...evidenceIds], "created_at");
  const videoAssets = await among("video_asset", "id", mediaIds, "created_at");
  const videoEducators = await select("SELECT * FROM video_educator WHERE content_item_id = ?1", videoId);
  const layerEducators = await select(
    "SELECT * FROM learning_layer_educator WHERE learning_layer_id = ?1",
    learningLayerId,
  );
  const expressionIds = layerSnapshots.flatMap((snapshot) => [
    ...Object.keys(snapshot.expressions ?? {}),
    ...(snapshot.annotations ?? []).map((annotation) => annotation.expressionId),
  ]);
  // Staff, by ID and name only, wherever a row must point at a user.
  const staffIds = [
    ...mediaAssets.map((row) => row.uploaded_by),
    ...videoAssets.map((row) => row.owner_id),
    ...videoEducators.map((row) => row.user_id),
    ...layerEducators.map((row) => row.user_id),
  ];
  const staff = (await among("user", "id", staffIds, "created_at")).map((row) => ({
    id: row.id,
    name: row.name,
    email: `${row.id}@exported.invalid`,
    email_verified: 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
  const [hold] = await select("SELECT id FROM content_hold WHERE content_item_id = ?1 AND lifted_at IS NULL", videoId);

  const tables: Record<BundleTable, Row[]> = {
    user: staff,
    media_asset: mediaAssets,
    video_asset: videoAssets,
    contributor: await among(
      "contributor",
      "id",
      rightsContributors.map((row) => row.contributor_id),
    ),
    content_item: contentItems,
    revision: revisions,
    revision_submission: await among("revision_submission", "revision_id", revisionIds),
    review_assignment: await select("SELECT * FROM review_assignment WHERE content_item_id = ?1", videoId),
    review_approval: await among("review_approval", "revision_id", revisionIds, "decided_at"),
    rights_record: rights,
    rights_record_contributor: rightsContributors,
    video_educator: videoEducators,
    expression: await among("expression", "id", expressionIds),
    learning_layer: [layer],
    learning_layer_revision: layerRevisions,
    learning_layer_educator: layerEducators,
    learning_layer_submission: await among("learning_layer_submission", "revision_id", layerRevisionIds),
    learning_layer_review_assignment: await select(
      "SELECT * FROM learning_layer_review_assignment WHERE learning_layer_id = ?1",
      learningLayerId,
    ),
    review_link: reviewLinks,
    review_link_access: await among(
      "review_link_access",
      "review_link_id",
      reviewLinks.map((row) => row.id),
      "accessed_at",
    ),
    learning_layer_approval: layerApprovals,
  };
  return {
    learningLayerId,
    videoId,
    heldAtExport: Boolean(hold),
    captions: Object.fromEntries(
      layerRevisions.map((row, index) => {
        const { segments, excerpt } = layerSnapshots[index];
        const offsetMs = excerpt?.sourceStartMs ?? 0;
        return [
          String(row.id),
          { fijian: toWebVtt(segments, "fijian", { offsetMs }), english: toWebVtt(segments, "english", { offsetMs }) },
        ];
      }),
    ),
    tables: BUNDLE_TABLES.map((table) => ({ table, rows: tables[table] })),
  };
}

/** A row as exported: JSON columns parsed, so the file nests them rather than holding strings. */
const readable = (row: Row): Row =>
  Object.fromEntries(
    Object.entries(row).map(([column, value]) => [
      column,
      JSON_COLUMNS.has(column) && typeof value === "string" ? JSON.parse(value) : value,
    ]),
  );

export type ImportResult = { ok: true } | { ok: false; error: string };

/**
 * Imports a bundle into a D1 database in one transaction: shared rows already there are kept, and
 * a Learning Layer already there refuses the whole import. Only the tables a bundle may write are
 * written, with column names checked, whatever the file says.
 */
export async function importLearningLayerBundle(d1: D1Database, input: unknown): Promise<ImportResult> {
  const bundle = readBundle(input);
  if (!bundle.ok) return bundle;
  const statements = bundleStatements(bundle.bundle).map(({ sql, params }) => d1.prepare(sql).bind(...params));
  try {
    await d1.batch(statements);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `The import was refused and nothing was written: ${(error as Error).message}` };
  }
}

/** The bundle, if the input is one this code can import. */
export function readBundle(input: unknown): { ok: true; bundle: LearningLayerBundle } | { ok: false; error: string } {
  const bundle = input as Partial<LearningLayerBundle> | null;
  if (bundle?.format !== BUNDLE_FORMAT) return { ok: false, error: "This isn't a NAISEMA Learning Layer export." };
  if (bundle.version !== BUNDLE_VERSION) {
    return {
      ok: false,
      error: `This export is version ${bundle.version}; this code imports version ${BUNDLE_VERSION}.`,
    };
  }
  if (!Array.isArray(bundle.tables)) return { ok: false, error: "The export has no tables." };
  for (const { table, rows } of bundle.tables) {
    if (!(BUNDLE_TABLES as readonly string[]).includes(table))
      return { ok: false, error: `It writes ${table}, which an import never does.` };
    if (!Array.isArray(rows) || rows.some((row) => Object.keys(row).some((column) => !IDENTIFIER.test(column)))) {
      return { ok: false, error: `Its ${table} rows aren't readable.` };
    }
  }
  return { ok: true, bundle: bundle as LearningLayerBundle };
}

const IDENTIFIER = /^[a-z][a-z0-9_]{0,62}$/;

/**
 * The statements an import runs, with values as parameters: inserts in table order (revision
 * pointers left empty), then the pointers, then, for a Video held at export, the withdrawal.
 */
export function bundleStatements(bundle: LearningLayerBundle) {
  const statements: { sql: string; params: unknown[] }[] = [];
  const pointerUpdates: typeof statements = [];
  for (const { table, rows } of bundle.tables) {
    const pointers = REVISION_POINTERS[table] ?? [];
    const verb = SHARED_TABLES.includes(table) ? "INSERT OR IGNORE" : "INSERT";
    for (const row of rows) {
      const columns = Object.keys(row);
      statements.push({
        sql: `${verb} INTO "${table}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES (${columns.map((_, index) => `?${index + 1}`).join(", ")})`,
        params: columns.map((column) => (pointers.includes(column) ? null : storable(row[column]))),
      });
      const set = pointers.filter((column) => row[column] !== null && row[column] !== undefined);
      if (set.length) {
        pointerUpdates.push({
          sql: `UPDATE "${table}" SET ${set.map((column, index) => `"${column}" = ?${index + 1}`).join(", ")} WHERE id = ?${set.length + 1}`,
          params: [...set.map((column) => row[column]), row.id],
        });
      }
    }
  }
  statements.push(...pointerUpdates);
  if (bundle.heldAtExport) {
    for (const [table, id] of [
      ["content_item", bundle.videoId],
      ["learning_layer", bundle.learningLayerId],
    ]) {
      statements.push({
        sql: `UPDATE "${table}" SET publication_state = 'withdrawn' WHERE id = ?1 AND publication_state = 'published'`,
        params: [id],
      });
    }
  }
  return statements;
}

/** A value as D1 stores it: nested JSON back to text. */
const storable = (value: unknown) => (value !== null && typeof value === "object" ? JSON.stringify(value) : value);
