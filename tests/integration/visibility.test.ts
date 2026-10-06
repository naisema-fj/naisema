import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { isLayerEligible, publicFootage, publicItem, publicLayer } from "~/lib/visibility.server";
import { act, authoredLayer, layerRow, publishedLayer } from "./support/layers";

/** The visibility module through its own interface (ADR-0007): what is public, and why not. */

const publishedVideoRevision = async (videoId: string) =>
  (
    (await env.DB.prepare(
      "SELECT r.number FROM content_item c JOIN revision r ON r.id = c.current_published_revision_id WHERE c.id = ?1",
    )
      .bind(videoId)
      .first<{ number: number }>()) as { number: number }
  ).number;

describe("public visibility", () => {
  it("finds a Learning Layer public only while its Video is, with the Video's footage", async () => {
    const { editor, videoId, layerId } = await publishedLayer();
    const db = getDb(env.DB);

    const layer = await publicLayer(db, layerId);
    expect(layer?.video.item.id).toBe(videoId);
    expect(layer?.video.asset.state).toBe("ready");
    expect((await publicItem(db, videoId))?.item.id).toBe(videoId);
    expect((await publicFootage(db, videoId))?.asset.id).toBe(layer?.video.asset.id);

    // Withdrawing the Video takes the Learning Layer with it, though the layer itself is still eligible.
    const number = await publishedVideoRevision(videoId);
    await editor.browser.fetch(`/admin/articles/${videoId}/revisions/${number}`, { form: { intent: "withdraw" } });
    expect(await publicItem(db, videoId)).toBeNull();
    expect(await publicLayer(db, layerId)).toBeNull();
    const { publishedId } = (await layerRow(layerId)) as { publishedId: string };
    expect((await isLayerEligible(db, publishedId)).eligible).toBe(true);
  }, 20_000);

  it("knows nothing of an item or Learning Layer that doesn't exist", async () => {
    const db = getDb(env.DB);
    expect(await publicItem(db, crypto.randomUUID())).toBeNull();
    expect(await publicLayer(db, crypto.randomUUID())).toBeNull();
    expect(await isLayerEligible(db, crypto.randomUUID())).toEqual({
      eligible: false,
      reasons: [{ kind: "missing", text: "That revision doesn't exist." }],
    });
  });

  it("says why not by kind, so callers never read the wording", async () => {
    const { educator, layerId, number } = await authoredLayer();
    const db = getDb(env.DB);
    const { revisionId } = (await layerRow(layerId)) as { revisionId: string };

    const draft = await isLayerEligible(db, revisionId);
    expect(draft.eligible).toBe(false);
    const kinds = draft.eligible ? [] : draft.reasons.map((reason) => reason.kind);
    expect(kinds).toContain("unsubmitted");
    expect(kinds).toContain("review");
    expect(kinds).toContain("rights");

    await act(educator, layerId, number, { intent: "submit" });
    const submitted = await isLayerEligible(db, revisionId);
    expect(submitted.eligible ? [] : submitted.reasons.map((reason) => reason.kind)).not.toContain("unsubmitted");
  }, 20_000);
});
