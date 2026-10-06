import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Staff } from "./support/articles";
import { act, approvedLayer, layerRow, save } from "./support/layers";
import { recordRights } from "./support/rights";

const PUBLIC = "https://naisema.test";
const visit = (path: string, init?: RequestInit) => SELF.fetch(`${PUBLIC}${path}`, { redirect: "manual", ...init });

/** Publishes the Video's current draft, as an editor, from its revision page. */
async function publishVideo(editor: Staff, videoId: string) {
  const { number } = (await env.DB.prepare(
    "SELECT r.number FROM content_item c JOIN revision r ON r.id = c.current_draft_revision_id WHERE c.id = ?1",
  )
    .bind(videoId)
    .first<{ number: number }>()) as { number: number };
  for (const intent of ["submit", "publish"]) {
    const response = await editor.browser.fetch(`/admin/articles/${videoId}/revisions/${number}`, { form: { intent } });
    expect(response.status, await response.clone().text()).toBe(302);
  }
}

const videoPath = async (videoId: string) => {
  const row = await env.DB.prepare("SELECT primary_area AS area, slug FROM content_item WHERE id = ?1")
    .bind(videoId)
    .first<{ area: string; slug: string }>();
  return `/${row?.area}/${row?.slug}`;
};

/** A published Video with a published Learning Layer on it, and their public addresses. */
async function publishedLayer(change: Record<string, string> = {}) {
  const layer = await approvedLayer();
  let { number } = layer;
  if (Object.keys(change).length) {
    // An Excerpt or other change before publishing: save, submit and approve again.
    ({ number } = await save(layer.educator, layer.layerId, change));
    if (change.clip === "excerpt") {
      expect((await recordRights(layer.editor.browser, layer.videoId, { uses: ["excerpt"] })).status).toBe(302);
    }
    await act(layer.educator, layer.layerId, number, { intent: "submit" });
    await act(layer.reviewer, layer.layerId, number, {
      intent: "decide",
      reviewType: "language",
      decision: "approved",
    });
  }
  expect((await act(layer.editor, layer.layerId, number, { intent: "publish" })).status).toBe(302);
  await publishVideo(layer.editor, layer.videoId);
  const story = await videoPath(layer.videoId);
  return { ...layer, number, story, player: `${story}/language/${layer.layerId}` };
}

describe("a Video's public page", () => {
  it("plays the story, lists the Learning Layers that are public, and is never cached", async () => {
    const { story, player, videoId } = await publishedLayer();
    const page = await visit(story);
    expect(page.status).toBe(200);
    expect(page.headers.get("Cache-Control")).toBe("private, no-store");
    expect(page.headers.get("Content-Security-Policy")).toContain("media-src 'self' blob:");
    const html = await page.text();
    expect(html).toContain(`/videos/${videoId}/stream`);
    expect(html).toContain("Explore the language");
    expect(html).toContain(`href="${player}"`);
    // It hydrates, for its player; an Article's page still doesn't.
    expect(html).toMatch(/<script[^>]+nonce=/);
  });

  it("doesn't list a Learning Layer that isn't published", async () => {
    const layer = await approvedLayer();
    await publishVideo(layer.editor, layer.videoId);
    const html = await (await visit(await videoPath(layer.videoId))).text();
    expect(html).not.toContain(`/language/${layer.layerId}`);
    expect((await visit(`${await videoPath(layer.videoId)}/language/${layer.layerId}`)).status).toBe(404);
  });
});

describe("the learner player", () => {
  it("opens without an account, with native caption tracks, the transcript and word meanings", async () => {
    const { player, story, layerId } = await publishedLayer();
    const page = await visit(`${player}?stage=support`);
    expect(page.status).toBe(200);
    expect(page.headers.get("Cache-Control")).toBe("private, no-store");
    const html = await page.text();
    expect(html).toContain(`src="/language/${layerId}/captions/fijian"`);
    expect(html).toContain(`src="/language/${layerId}/captions/english"`);
    expect(html).toContain("Bula vinaka");
    expect(html).toContain(`href="${story}"`);
    expect(html).toContain("Normal");
    expect(html).toContain("Slowest (0.5×)");
  });

  it("generates captions from the published Segments, in the video's time for an Excerpt", async () => {
    const { layerId } = await publishedLayer({ clip: "excerpt", sourceStart: "0:10", sourceEnd: "0:20" });
    const fijian = await visit(`/language/${layerId}/captions/fijian`);
    expect(fijian.headers.get("Content-Type")).toBe("text/vtt; charset=utf-8");
    const vtt = await fijian.text();
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("00:00:11.000 --> 00:00:13.000");
    expect(vtt).toContain("Bula vinaka");
    expect(await (await visit(`/language/${layerId}/captions/english`)).text()).toContain("Hello");
    expect((await visit(`/language/${layerId}/captions/french`)).status).toBe(404);
  });

  it("stops serving the player, captions and playback once the Video or the Learning Layer is withdrawn", async () => {
    const { editor, videoId, layerId, number, player } = await publishedLayer();
    const playback = await visit(`/videos/${videoId}/playback`);
    expect(playback.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await playback.json()).toMatchObject({
      src: expect.stringMatching(`^/videos/${videoId}/stream\\?v=`),
      hls: false,
    });
    const range = await visit(`/videos/${videoId}/stream`, { headers: { Range: "bytes=0-99" } });
    expect(range.status).toBe(206);
    await range.arrayBuffer();

    // Withdrawing the Learning Layer leaves the Video.
    expect((await act(editor, layerId, number, { intent: "withdraw" })).status).toBe(302);
    expect((await layerRow(layerId))?.state).toBe("withdrawn");
    expect((await visit(player)).status).toBe(404);
    expect((await visit(`/language/${layerId}/captions/fijian`)).status).toBe(404);
    expect((await visit(`/videos/${videoId}/playback`)).status).toBe(200);

    // Withdrawing the Video stops its playback too.
    const { number: videoNumber } = (await env.DB.prepare(
      "SELECT r.number FROM content_item c JOIN revision r ON r.id = c.current_published_revision_id WHERE c.id = ?1",
    )
      .bind(videoId)
      .first<{ number: number }>()) as { number: number };
    await editor.browser.fetch(`/admin/articles/${videoId}/revisions/${videoNumber}`, { form: { intent: "withdraw" } });
    expect((await visit(`/videos/${videoId}/playback`)).status).toBe(404);
    expect((await visit(`/videos/${videoId}/stream`)).status).toBe(404);
  });

  it("hides every Learning Layer when only its Video is withdrawn", async () => {
    const { editor, videoId, layerId, player, story } = await publishedLayer();
    const { number } = (await env.DB.prepare(
      "SELECT r.number FROM content_item c JOIN revision r ON r.id = c.current_published_revision_id WHERE c.id = ?1",
    )
      .bind(videoId)
      .first<{ number: number }>()) as { number: number };
    const withdrawn = await editor.browser.fetch(`/admin/articles/${videoId}/revisions/${number}`, {
      form: { intent: "withdraw" },
    });
    expect(withdrawn.status).toBe(302);
    expect((await layerRow(layerId))?.state).toBe("published");
    expect((await visit(story)).status).toBe(410);
    expect((await visit(player)).status).toBe(410);
    expect((await visit(`/language/${layerId}/captions/fijian`)).status).toBe(404);
  });

  it("takes a Learning Layer down once its teaching rights go, leaving the Video playing", async () => {
    const { editor, videoId, layerId, player, story } = await publishedLayer();
    const { results } = await env.DB.prepare(
      "SELECT id, permitted_uses AS uses FROM rights_record WHERE subject_id = ?1",
    )
      .bind(videoId)
      .all<{ id: string; uses: string }>();
    const teaching = results.find((record) => record.uses.includes("translate"));
    await editor.browser.fetch(`/admin/articles/${videoId}/rights`, {
      form: { intent: "withdraw", recordId: teaching?.id as string, reason: "No longer for teaching." },
    });
    expect((await visit(player)).status).toBe(404);
    const page = await (await visit(story)).text();
    expect(page).not.toContain(`/language/${layerId}`);
    expect((await visit(`/videos/${videoId}/playback`)).status).toBe(200);
  });
});

describe("the immersion route", () => {
  const post = (path: string, body: unknown) =>
    visit(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  it("starts at watching naturally, with no English anywhere on the page, until a stage gives it", async () => {
    const { player, layerId } = await publishedLayer();
    for (const path of [player, `${player}?stage=watch`, `${player}?stage=listen-again`, `${player}?stage=captions`]) {
      const page = await visit(path);
      expect(page.status, path).toBe(200);
      const html = await page.text();
      expect(html, path).toContain("Bula vinaka");
      expect(html, path).not.toContain("Hello");
      expect(html, path).not.toContain(`/language/${layerId}/captions/english`);
      // Nor the Activities, whose answers are English.
      expect(html, path).not.toContain("She greets her friend Sera.");
    }
    const support = await (await visit(`${player}?stage=support`)).text();
    expect(support).toContain("Hello");
    expect(support).toContain(`/language/${layerId}/captions/english`);
    // An unknown stage is the start of the route.
    expect(await (await visit(`${player}?stage=nonsense`)).text()).not.toContain("Hello");
  });

  it("offers each Activity in its stage", async () => {
    const { player } = await publishedLayer();
    const respond = await (await visit(`${player}?stage=respond`)).text();
    expect(respond).toContain("Who is Mere greeting?");
    expect(await (await visit(`${player}?stage=practise`)).text()).not.toContain("Who is Mere greeting?");
  });

  it("gives one line's English when asked, and only while the Learning Layer is public", async () => {
    const { editor, layerId, number } = await publishedLayer();
    const segmentId = JSON.parse((await layerRow(layerId))?.snapshot as string).segments[0].id;
    const response = await visit(`/language/${layerId}/english/${segmentId}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ english: "Hello" });
    expect((await visit(`/language/${layerId}/english/${crypto.randomUUID()}`)).status).toBe(404);

    expect((await act(editor, layerId, number, { intent: "withdraw" })).status).toBe(302);
    expect((await visit(`/language/${layerId}/english/${segmentId}`)).status).toBe(404);
  });

  it("records learning events by the Learning Layer's own IDs only, refusing anything else", async () => {
    const { layerId, editor, number } = await publishedLayer();
    const snapshot = JSON.parse((await layerRow(layerId))?.snapshot as string);
    const segmentId = snapshot.segments[0].id;
    const activityId = snapshot.activities[0].id;
    const events = `/language/${layerId}/events`;
    for (const event of [
      { name: "segment_replayed", segmentId },
      { name: "support_toggled", support: "english-captions" },
      { name: "activity_attempted", activityId },
      { name: "feedback_viewed", activityId },
      { name: "learning_completed" },
    ]) {
      const response = await post(events, event);
      expect(response.status, JSON.stringify(event)).toBe(204);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }
    for (const event of [
      { name: "segment_replayed", segmentId: crypto.randomUUID() },
      { name: "activity_attempted", activityId: segmentId },
      { name: "support_toggled", support: "my name is Mere" },
      { name: "learner_profiled", learnerId: "someone" },
      "not an event",
    ]) {
      expect((await post(events, event)).status, JSON.stringify(event)).toBe(400);
    }
    expect((await visit(events)).status).toBe(405);

    expect((await act(editor, layerId, number, { intent: "withdraw" })).status).toBe(302);
    expect((await post(events, { name: "learning_completed" })).status).toBe(404);
  });
});
