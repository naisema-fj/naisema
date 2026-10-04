import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { isEligible } from "~/lib/publication.server";
import { post, type Staff, staff, topic } from "./support/articles";
import { readyVideoAsset } from "./support/video";

/** A Video Content Item showing a ready Video Asset of this length. */
async function video(editor: Staff, seconds = 60) {
  const assetId = await readyVideoAsset(editor, { seconds, width: 720, height: 1280 });
  const topicId = await topic(editor);
  const response = await post(
    editor,
    "/admin/articles/new?type=video",
    new URLSearchParams({
      title: "Talanoa at the market",
      summary: "Two friends meet at the Suva market.",
      primaryArea: "learn",
      credit: "Filmed by Sera",
      body: JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Bula." }] }],
      }),
      topicId,
      videoAssetId: assetId,
    }),
  );
  expect(response.status, await response.clone().text()).toBe(302);
  return { id: response.headers.get("Location")?.split("/").at(-1) as string, assetId };
}

const assignToVideo = (editor: Staff, videoId: string, educator: Staff) =>
  editor.browser.fetch(`/admin/videos/${videoId}/learning-layers`, {
    form: { intent: "assign", educatorId: educator.userId },
  });

/** Adds a Learning Layer to a Video as this person; returns its ID, or the refusal. */
async function addLayer(who: Staff, videoId: string, fields: Record<string, string> = {}) {
  const response = await who.browser.fetch(`/admin/videos/${videoId}/learning-layers`, {
    form: { intent: "create", title: "Greetings", level: "beginner", clip: "whole", ...fields },
  });
  return { response, id: response.headers.get("Location")?.split("/").at(-1) ?? null };
}

const layer = (id: string) =>
  env.DB.prepare(
    `SELECT l.language_variety AS languageVariety, r.id AS revisionId, r.number, r.snapshot
     FROM learning_layer l JOIN learning_layer_revision r ON r.id = l.current_draft_revision_id WHERE l.id = ?1`,
  )
    .bind(id)
    .first<{ languageVariety: string; revisionId: string; number: number; snapshot: string }>();

const segment = (fields: Record<string, unknown>) => ({
  speaker: "",
  fijian: "Bula vinaka.",
  english: "Hello.",
  overlapIntended: false,
  draft: false,
  ...fields,
});

/** Saves a Learning Layer from the editor as this person, on top of its current draft unless told otherwise. */
async function save(who: Staff, layerId: string, segments: unknown[], fields: Record<string, string> = {}) {
  const current = await layer(layerId);
  return who.browser.fetch(`/admin/learning-layers/${layerId}`, {
    form: {
      intent: "save",
      baseRevisionId: current?.revisionId ?? "",
      title: "Greetings",
      level: "beginner",
      clip: "whole",
      sourceStart: "",
      sourceEnd: "",
      segments: JSON.stringify(segments),
      ...fields,
    },
  });
}

describe("Video Content Items", () => {
  it("show a Video Asset that has finished processing, and can't be published until the learner player exists", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id, assetId } = await video(editor);

    const html = await (await editor.browser.fetch(`/admin/articles/${id}`)).text();
    expect(html).toContain("Learning Layers and Educators");
    const revision = await env.DB.prepare(
      "SELECT r.id, r.snapshot FROM content_item c JOIN revision r ON r.id = c.current_draft_revision_id WHERE c.id = ?1",
    )
      .bind(id)
      .first<{ id: string; snapshot: string }>();
    expect(JSON.parse(revision?.snapshot ?? "{}").video).toEqual({ videoAssetId: assetId });
    const eligibility = await isEligible(getDb(env.DB), revision?.id as string);
    expect(eligibility.eligible).toBe(false);
    if (!eligibility.eligible) {
      expect(eligibility.reasons).toContain(
        "Videos can't be published yet: their public page comes with the learner player.",
      );
      // The footage needs a Rights Record of its own, like any media library file.
      expect(eligibility.reasons).toContain("The file talanoa.mp4 has no current Rights Record granting Publish.");
    }
  });

  it("refuse footage that hasn't finished processing", async () => {
    const editor = await staff("editor", { role: "editor" });
    const topicId = await topic(editor);
    const response = await post(
      editor,
      "/admin/articles/new?type=video",
      new URLSearchParams({
        title: "No footage",
        summary: "S",
        primaryArea: "learn",
        credit: "C",
        body: JSON.stringify({ type: "doc", content: [] }),
        topicId,
        videoAssetId: crypto.randomUUID(),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Choose a video that has finished processing.");
  });
});

describe("a Video's footage", () => {
  it("can't change once Learning Layers are timed to it", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id: videoId } = await video(editor);
    const other = await readyVideoAsset(editor, { seconds: 20 });
    await addLayer(editor, videoId);
    const current = await env.DB.prepare(
      "SELECT r.id, r.snapshot FROM content_item c JOIN revision r ON r.id = c.current_draft_revision_id WHERE c.id = ?1",
    )
      .bind(videoId)
      .first<{ id: string; snapshot: string }>();
    const snapshot = JSON.parse(current?.snapshot ?? "{}");

    const refused = await post(
      editor,
      `/admin/articles/${videoId}`,
      new URLSearchParams({
        baseRevisionId: current?.id ?? "",
        title: snapshot.title,
        summary: snapshot.summary,
        credit: snapshot.credit,
        body: JSON.stringify(snapshot.body),
        topicId: snapshot.topicIds[0],
        videoAssetId: other,
      }),
    );

    expect(refused.status).toBe(400);
    expect(await refused.text()).toContain("Learning Layers timed to its current footage");
  });
});

describe("adding Learning Layers", () => {
  it("is for editors and the Educators assigned to the Video, who are then assigned to what they add", async () => {
    const editor = await staff("editor", { role: "editor" });
    const assigned = await staff("educator", { role: "educator" });
    const other = await staff("other-educator", { role: "educator" });
    const { id: videoId } = await video(editor);
    expect((await assignToVideo(editor, videoId, assigned)).status).toBe(302);

    const added = await addLayer(assigned, videoId, { clip: "excerpt", sourceStart: "0:10", sourceEnd: "0:40" });
    expect(added.response.status).toBe(302);
    const row = await layer(added.id as string);
    expect(row?.languageVariety).toBe("standard-fijian");
    expect(JSON.parse(row?.snapshot ?? "{}")).toEqual({
      title: "Greetings",
      level: "beginner",
      excerpt: { sourceStartMs: 10_000, sourceEndMs: 40_000 },
      segments: [],
    });
    expect((await assigned.browser.fetch(`/admin/learning-layers/${added.id}`)).status).toBe(200);

    expect((await other.browser.fetch(`/admin/videos/${videoId}/learning-layers`)).status).toBe(403);
    expect((await addLayer(other, videoId)).response.status).toBe(403);
    expect((await addLayer(editor, videoId)).response.status).toBe(302);
  });

  it("says what is wrong with an Excerpt outside the video", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id: videoId } = await video(editor, 30);

    const refused = await addLayer(editor, videoId, { clip: "excerpt", sourceStart: "0:10", sourceEnd: "0:45" });

    expect(refused.response.status).toBe(400);
    expect(await refused.response.text()).toContain("The out time is after the video ends.");
  });

  it("lets only editors assign Educators", async () => {
    const editor = await staff("editor", { role: "editor" });
    const educator = await staff("educator", { role: "educator" });
    const notAnEducator = await staff("reviewer", { role: "reviewer", reviewType: "editorial" });
    const { id: videoId } = await video(editor);
    await assignToVideo(editor, videoId, educator);

    const byEducator = await educator.browser.fetch(`/admin/videos/${videoId}/learning-layers`, {
      form: { intent: "assign", educatorId: educator.userId },
    });
    expect(byEducator.status).toBe(400);
    const reviewerAssigned = await assignToVideo(editor, videoId, notAnEducator);
    expect(await reviewerAssigned.text()).toContain("Choose someone who is an Educator.");
  });
});

describe("authoring a Learning Layer", () => {
  async function authoredLayer() {
    const editor = await staff("editor", { role: "editor" });
    const educator = await staff("educator", { role: "educator" });
    const { id: videoId } = await video(editor, 30);
    await assignToVideo(editor, videoId, educator);
    const { id } = await addLayer(educator, videoId);
    return { editor, educator, videoId, layerId: id as string };
  }

  it("saves each change as a write-once Revision, keeping Segment IDs from one to the next", async () => {
    const { educator, layerId } = await authoredLayer();
    const first = crypto.randomUUID();

    const saved = await save(educator, layerId, [
      segment({ id: first, startMs: 0, endMs: 2_000, speaker: "Mere" }),
      segment({ startMs: 2_000, endMs: 4_000, fijian: "Vinaka.", english: "" }),
    ]);
    expect(saved.status, await saved.clone().text()).toBe(302);
    expect(saved.headers.get("Location")).toBe(`/admin/learning-layers/${layerId}?saved=2`);
    const second = JSON.parse((await layer(layerId))?.snapshot ?? "{}");
    expect(second.segments).toHaveLength(2);
    expect(second.segments[0]).toMatchObject({ id: first, speaker: "Mere" });

    const retimed = second.segments.map((item: { startMs: number; endMs: number }) => ({
      ...item,
      startMs: item.startMs + 100,
      endMs: item.endMs + 100,
    }));
    expect((await save(educator, layerId, retimed)).status).toBe(302);
    const third = await layer(layerId);
    expect(third?.number).toBe(3);
    expect(JSON.parse(third?.snapshot ?? "{}").segments.map((item: { id: string }) => item.id)).toEqual(
      second.segments.map((item: { id: string }) => item.id),
    );

    await expect(
      env.DB.prepare("UPDATE learning_layer_revision SET number = 99 WHERE id = ?1").bind(third?.revisionId).run(),
    ).rejects.toThrow(/immutable/);
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_event WHERE action = 'learning_layer_revision.saved' AND details LIKE ?1",
    )
      .bind(`%${layerId}%`)
      .first<{ count: number }>();
    expect(audit?.count).toBe(2);
  });

  it("refuses Segments that fail validation, naming the Segment and field", async () => {
    const { educator, layerId } = await authoredLayer();

    const refused = await save(educator, layerId, [
      segment({ startMs: 0, endMs: 3_000 }),
      segment({ startMs: 2_000, endMs: 31_000 }),
    ]);

    expect(refused.status).toBe(400);
    const text = await refused.text();
    expect(text).toContain("Segment 2 ends after the clip, which ends at 0:30.000.");
    expect(text).toContain("Segment 2 overlaps Segment 1. Mark the overlap as intentional, or change the times.");
    expect((await layer(layerId))?.number).toBe(1);
  });

  it("refuses a save made from an outdated Revision", async () => {
    const { editor, educator, layerId } = await authoredLayer();
    const stale = (await layer(layerId))?.revisionId as string;
    expect((await save(editor, layerId, [segment({ startMs: 0, endMs: 1_000 })])).status).toBe(302);

    const refused = await save(educator, layerId, [segment({ startMs: 0, endMs: 2_000 })], { baseRevisionId: stale });

    expect(refused.status).toBe(400);
    expect(await refused.text()).toContain("Someone else saved this Learning Layer while you were editing.");
  });

  it("can't be opened, saved or exported by an Educator who isn't assigned to it (VAC-05)", async () => {
    const { layerId } = await authoredLayer();
    const other = await staff("other-educator", { role: "educator" });
    const reviewer = await staff("reviewer", {
      role: "reviewer",
      reviewType: "language",
      languageVariety: "standard-fijian",
    });

    expect((await other.browser.fetch(`/admin/learning-layers/${layerId}`)).status).toBe(403);
    expect((await save(other, layerId, [segment({ startMs: 0, endMs: 1_000 })])).status).toBe(403);
    expect((await other.browser.fetch(`/admin/learning-layers/${layerId}/webvtt/fijian`)).status).toBe(403);
    expect((await reviewer.browser.fetch(`/admin/learning-layers/${layerId}`)).status).toBe(403);
    expect((await layer(layerId))?.number).toBe(1);
    const refusals = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_event WHERE action = 'learning_layer.authoring_refused' AND object_id = ?1 AND actor_id = ?2",
    )
      .bind(layerId, other.userId)
      .first<{ count: number }>();
    expect(refusals?.count).toBe(3);
  });

  it("is listed only for the Educators assigned to it", async () => {
    const { educator, layerId } = await authoredLayer();
    const other = await staff("other-educator", { role: "educator" });

    expect(await (await educator.browser.fetch("/admin/learning-layers")).text()).toContain(
      `/admin/learning-layers/${layerId}`,
    );
    expect(await (await other.browser.fetch("/admin/learning-layers")).text()).not.toContain(layerId);
  });

  it("opens the timeline editor with a preview through a short-lived signed address", async () => {
    const { educator, layerId } = await authoredLayer();

    const page = await educator.browser.fetch(`/admin/learning-layers/${layerId}`);

    expect(page.headers.get("Cache-Control")).toBe("private, no-store");
    expect(page.headers.get("Content-Security-Policy")).toContain("media-src 'self' blob:");
    const html = await page.text();
    expect(html).toContain("Save a new revision");
    expect(html).toMatch(/\/admin\/media\/[0-9a-f-]+\/video\/master\?token=/);
  });

  it("exports the saved Segments as WebVTT in Fijian or English, with Segment IDs as cue IDs", async () => {
    const { educator, layerId } = await authoredLayer();
    const id = crypto.randomUUID();
    await save(educator, layerId, [
      segment({ id, startMs: 1_000, endMs: 2_500, speaker: "Mere", fijian: "Bula", english: "Hello" }),
    ]);

    const fijian = await educator.browser.fetch(`/admin/learning-layers/${layerId}/webvtt/fijian`);
    expect(fijian.headers.get("Content-Type")).toBe("text/vtt; charset=utf-8");
    expect(fijian.headers.get("Content-Disposition")).toContain("Greetings-fj.vtt");
    expect(await fijian.text()).toBe(`WEBVTT\n\n${id}\n00:00:01.000 --> 00:00:02.500\n<v Mere>Bula\n`);
    expect(await (await educator.browser.fetch(`/admin/learning-layers/${layerId}/webvtt/english`)).text()).toContain(
      "<v Mere>Hello",
    );
    expect((await educator.browser.fetch(`/admin/learning-layers/${layerId}/webvtt/klingon`)).status).toBe(404);
  });
});
