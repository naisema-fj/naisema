import { applyD1Migrations, env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { importLearningLayerBundle } from "~/lib/learning-layer-bundle.server";
import { publicLayer } from "~/lib/visibility.server";
import { toWebVtt } from "~/lib/webvtt";
import { approvedLayer, layerRow, publishChange, publishVideo, save } from "./support/layers";
import { auditActionsAbout } from "./support/staff";

/**
 * A Learning Layer exported whole and imported into an empty database plays there exactly as it
 * does here (VCMS-06, VAC-09): same Revision, Segments, tokens, Annotations, Expressions,
 * Activities, approvals and footage, and the same captions.
 */

const PUBLIC = "https://naisema.test";

beforeAll(async () => {
  await applyD1Migrations(env.IMPORT_DB, env.TEST_MIGRATIONS);
});

const snapshotOf = async (revisionId: string) =>
  JSON.parse(
    (
      (await env.DB.prepare("SELECT snapshot FROM learning_layer_revision WHERE id = ?1")
        .bind(revisionId)
        .first<{ snapshot: string }>()) as { snapshot: string }
    ).snapshot,
  );

/** A published Video with a published Learning Layer on it that annotates a word with a new Expression. */
async function annotatedLayer() {
  const layer = await approvedLayer();
  const draft = await snapshotOf((await layerRow(layer.layerId))?.revisionId as string);
  const segment = draft.segments[0];
  const temporary = crypto.randomUUID();
  await publishChange(layer, {
    annotations: JSON.stringify([
      {
        id: crypto.randomUUID(),
        segmentId: segment.id,
        startTokenId: segment.tokens[0].id,
        endTokenId: segment.tokens[0].id,
        expressionId: temporary,
        contextualMeaning: "hello",
        grammarNote: "",
        inVocabulary: true,
      },
    ]),
    newExpressions: JSON.stringify([
      {
        id: temporary,
        headword: "bula",
        generalMeaning: "life, health",
        grammarNote: "",
        pronunciation: "mbula",
        idiom: false,
        literalMeaning: "",
      },
    ]),
  });
  await publishVideo(layer.editor, layer.videoId);
  return layer;
}

const exportLayer = async (layer: Pick<Awaited<ReturnType<typeof annotatedLayer>>, "editor" | "layerId">) => {
  const response = await layer.editor.browser.fetch("/admin/exports/download", {
    form: { kind: "learningLayer", learningLayerId: layer.layerId },
  });
  expect(response.status, await response.clone().text()).toBe(200);
  return response.json<{
    format: string;
    version: number;
    captions: Record<string, { fijian: string; english: string }>;
    tables: { table: string; rows: Record<string, unknown>[] }[];
  }>();
};

describe("a Learning Layer export", () => {
  it("holds every Revision with its stable IDs, captions as WebVTT, its approvals and footage, and is audited", async () => {
    const layer = await annotatedLayer();
    const bundle = await exportLayer(layer);

    expect(bundle).toMatchObject({ format: "naisema.learning-layer", version: 1 });
    const rows = (table: string) => bundle.tables.find((entry) => entry.table === table)?.rows ?? [];
    const revisions = rows("learning_layer_revision");
    // Created, filled in, then annotated: three Revisions, the last one published.
    expect(revisions.map((row) => row.number)).toEqual([1, 2, 3]);
    const published = await snapshotOf((await publicLayer(getDb(env.DB), layer.layerId))?.revisionId as string);
    expect(revisions[2].snapshot).toEqual(published);
    expect(rows("expression").map((row) => row.headword)).toEqual(["bula"]);
    expect(rows("learning_layer_approval").map((row) => row.decision)).toEqual(["approved", "approved"]);
    expect(rows("video_asset").map((row) => row.id)).toEqual([layer.assetId]);
    expect(rows("rights_record")).toHaveLength(3);
    expect(bundle.captions[String(revisions[2].id)].fijian).toContain("Bula vinaka");
    // Staff come as an ID and name only.
    expect(JSON.stringify(rows("user"))).not.toContain("@naisema.test");
    expect(await auditActionsAbout(layer.layerId)).toContain("export.downloaded");
  });

  it("imports into an empty database and plays there identically", async () => {
    const layer = await annotatedLayer();
    const bundle = await exportLayer(layer);

    expect(await importLearningLayerBundle(env.IMPORT_DB, bundle)).toEqual({ ok: true });

    const here = await publicLayer(getDb(env.DB), layer.layerId);
    const there = await publicLayer(getDb(env.IMPORT_DB), layer.layerId);
    expect(here).not.toBeNull();
    expect(there).toEqual(here);
    // The captions the player asks for here, and the ones the imported Segments make there.
    const captions = await (await SELF.fetch(`${PUBLIC}/language/${layer.layerId}/captions/fijian`)).text();
    expect(toWebVtt(there?.snapshot.segments ?? [], "fijian")).toBe(captions);
    expect(bundle.captions[here?.revisionId as string].fijian).toBe(captions);
    expect(
      await env.IMPORT_DB.prepare("SELECT action FROM audit_event WHERE object_id = ?1")
        .bind(layer.layerId)
        .first<{ action: string }>(),
    ).toEqual({ action: "learning_layer.imported" });
  });

  it("leaves the Video already there as it is when a second Learning Layer on it is imported", async () => {
    const layer = await annotatedLayer();
    expect(await importLearningLayerBundle(env.IMPORT_DB, await exportLayer(layer))).toEqual({ ok: true });
    // Since then, the Video was taken down in the database imported into.
    await env.IMPORT_DB.prepare(
      "UPDATE content_item SET publication_state = 'withdrawn', current_published_revision_id = NULL WHERE id = ?1",
    )
      .bind(layer.videoId)
      .run();
    const created = await layer.educator.browser.fetch(`/admin/videos/${layer.videoId}/learning-layers`, {
      form: { intent: "create", title: "Numbers", level: "beginner", clip: "whole" },
    });
    const secondId = created.headers.get("Location")?.split("/").at(-1) as string;
    await save(layer.educator, secondId);

    expect(
      await importLearningLayerBundle(env.IMPORT_DB, await exportLayer({ editor: layer.editor, layerId: secondId })),
    ).toEqual({ ok: true });
    expect(
      await env.IMPORT_DB.prepare(
        "SELECT publication_state AS state, current_published_revision_id AS published FROM content_item WHERE id = ?1",
      )
        .bind(layer.videoId)
        .first(),
    ).toEqual({ state: "withdrawn", published: null });
    expect(await env.IMPORT_DB.prepare("SELECT id FROM learning_layer WHERE id = ?1").bind(secondId).first()).toEqual({
      id: secondId,
    });
  });

  it("refuses to import over a Learning Layer already there, writing nothing", async () => {
    const layer = await annotatedLayer();
    const bundle = await exportLayer(layer);
    expect(await importLearningLayerBundle(env.IMPORT_DB, bundle)).toEqual({ ok: true });
    const count = () =>
      env.IMPORT_DB.prepare("SELECT count(*) AS n FROM learning_layer_revision").first<{ n: number }>();
    const before = await count();

    const again = await importLearningLayerBundle(env.IMPORT_DB, bundle);
    expect(again.ok).toBe(false);
    expect(await count()).toEqual(before);
  });

  it("refuses anything that isn't a Learning Layer export it can read", async () => {
    expect(await importLearningLayerBundle(env.IMPORT_DB, { format: "naisema.content", version: 1 })).toMatchObject({
      ok: false,
    });
    const role = { format: "naisema.learning-layer", version: 1, tables: [{ table: "role_assignment", rows: [] }] };
    expect(await importLearningLayerBundle(env.IMPORT_DB, role)).toMatchObject({ ok: false });
    const broken = { format: "naisema.learning-layer", version: 1, tables: [{ table: "user", rows: [null] }] };
    expect(await importLearningLayerBundle(env.IMPORT_DB, broken)).toMatchObject({ ok: false });
  });
});
