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
      annotations: [],
      notes: [],
      expressions: {},
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

describe("Annotations, Expressions and notes", () => {
  type Saved = {
    segments: { id: string; fijian: string; tokens: { id: string; text: string }[] }[];
    annotations: { id: string; expressionId: string; startTokenId: string; endTokenId: string }[];
    notes: { id: string; attribution: string }[];
    expressions: Record<string, { headword: string; generalMeaning: string }>;
  };
  const snapshotOf = async (layerId: string) => JSON.parse((await layer(layerId))?.snapshot ?? "{}") as Saved;

  /** A Learning Layer with one Segment, "Ni sa bula vinaka", saved so its words have token IDs. */
  async function layerWithWords() {
    const editor = await staff("editor", { role: "editor" });
    const educator = await staff("educator", { role: "educator" });
    const { id: videoId } = await video(editor, 30);
    await assignToVideo(editor, videoId, educator);
    const { id } = await addLayer(educator, videoId);
    const layerId = id as string;
    const segmentId = crypto.randomUUID();
    await save(educator, layerId, [
      segment({ id: segmentId, startMs: 1_000, endMs: 3_000, fijian: "Ni sa bula vinaka" }),
    ]);
    const saved = await snapshotOf(layerId);
    return { editor, educator, videoId, layerId, segment: saved.segments[0] };
  }

  const annotationOn = (segmentId: string, startTokenId: string, endTokenId: string, expressionId: string) => ({
    id: crypto.randomUUID(),
    segmentId,
    startTokenId,
    endTokenId,
    expressionId,
    contextualMeaning: "Hello (said to one person)",
    grammarNote: "",
    inVocabulary: true,
  });

  const newExpression = (id: string, fields: Record<string, unknown> = {}) => ({
    id,
    headword: "ni sa bula",
    generalMeaning: "hello",
    grammarNote: "A greeting.",
    pronunciation: "nee sah mbula",
    idiom: false,
    literalMeaning: "",
    ...fields,
  });

  it("adds a new Expression to the library and keeps a copy of it with the Annotation", async () => {
    const { educator, layerId, segment: words } = await layerWithWords();
    const temporary = crypto.randomUUID();
    const tokens = words.tokens;

    const saved = await save(
      educator,
      layerId,
      [{ ...words, startMs: 1_000, endMs: 3_000, english: "", speaker: "" }],
      {
        annotations: JSON.stringify([annotationOn(words.id, tokens[0].id, tokens[2].id, temporary)]),
        newExpressions: JSON.stringify([newExpression(temporary)]),
      },
    );

    expect(saved.status, await saved.clone().text()).toBe(302);
    const snapshot = await snapshotOf(layerId);
    expect(snapshot.annotations).toHaveLength(1);
    const expressionId = snapshot.annotations[0].expressionId;
    expect(snapshot.expressions[expressionId]).toMatchObject({ headword: "ni sa bula", generalMeaning: "hello" });
    const row = await env.DB.prepare("SELECT headword, created_by AS createdBy FROM expression WHERE id = ?1")
      .bind(expressionId)
      .first<{ headword: string; createdBy: string }>();
    expect(row).toEqual({ headword: "ni sa bula", createdBy: educator.userId });
  });

  it("reuses an Expression already in the library instead of adding the same one again", async () => {
    const first = await layerWithWords();
    const second = await layerWithWords();
    const headword = `bula-${crypto.randomUUID().slice(0, 8)}`;
    for (const { educator, layerId, segment: words } of [first, second]) {
      const temporary = crypto.randomUUID();
      const response = await save(
        educator,
        layerId,
        [{ ...words, startMs: 1_000, endMs: 3_000, english: "", speaker: "" }],
        {
          annotations: JSON.stringify([annotationOn(words.id, words.tokens[2].id, words.tokens[2].id, temporary)]),
          newExpressions: JSON.stringify([newExpression(temporary, { headword, generalMeaning: "life" })]),
        },
      );
      expect(response.status).toBe(302);
    }
    const rows = await env.DB.prepare("SELECT id FROM expression WHERE headword = ?1")
      .bind(headword)
      .all<{ id: string }>();
    expect(rows.results).toHaveLength(1);
    expect((await snapshotOf(second.layerId)).annotations[0].expressionId).toBe(rows.results[0].id);
  });

  it("keeps an Annotation anchored when words are added, and flags it, unmoved, when its words go", async () => {
    const { educator, layerId, segment: words } = await layerWithWords();
    const temporary = crypto.randomUUID();
    const bula = words.tokens[2];
    await save(educator, layerId, [{ ...words, startMs: 1_000, endMs: 3_000, english: "", speaker: "" }], {
      annotations: JSON.stringify([annotationOn(words.id, bula.id, bula.id, temporary)]),
      newExpressions: JSON.stringify([newExpression(temporary, { headword: "bula", generalMeaning: "life" })]),
    });
    const annotated = await snapshotOf(layerId);

    // The editor sends its old tokens with the new text; the server re-tokenises against them.
    const longer = {
      ...annotated.segments[0],
      fijian: "Ni sa bula vakalevu vinaka",
      startMs: 1_000,
      endMs: 3_000,
      english: "",
      speaker: "",
    };
    expect(
      (await save(educator, layerId, [longer], { annotations: JSON.stringify(annotated.annotations) })).status,
    ).toBe(302);
    const after = await snapshotOf(layerId);
    expect(after.segments[0].tokens.map((token) => token.text)).toEqual(["Ni", "sa", "bula", "vakalevu", "vinaka"]);
    expect(after.segments[0].tokens[2].id).toBe(bula.id);
    expect(after.annotations[0].startTokenId).toBe(bula.id);

    const without = {
      ...after.segments[0],
      fijian: "Ni sa vinaka",
      startMs: 1_000,
      endMs: 3_000,
      english: "",
      speaker: "",
    };
    expect((await save(educator, layerId, [without], { annotations: JSON.stringify(after.annotations) })).status).toBe(
      302,
    );
    const gone = await snapshotOf(layerId);
    expect(gone.segments[0].tokens.some((token) => token.id === bula.id)).toBe(false);
    // Kept as it was, pointing at the word that's gone, for the Educator to revalidate.
    expect(gone.annotations).toEqual(after.annotations);
  });

  it("refuses an Annotation without its meaning, and a note without who it comes from", async () => {
    const { educator, layerId, segment: words } = await layerWithWords();
    const temporary = crypto.randomUUID();
    const plain = [{ ...words, startMs: 1_000, endMs: 3_000, english: "", speaker: "" }];

    const noMeaning = await save(educator, layerId, plain, {
      annotations: JSON.stringify([
        { ...annotationOn(words.id, words.tokens[0].id, words.tokens[0].id, temporary), contextualMeaning: "" },
      ]),
      newExpressions: JSON.stringify([newExpression(temporary)]),
    });
    expect(noMeaning.status).toBe(400);
    expect(await noMeaning.text()).toContain("Say what the words mean here.");

    const note = {
      id: crypto.randomUUID(),
      segmentId: words.id,
      kind: "cultural",
      text: "Said on arrival.",
      attribution: "",
    };
    const unattributed = await save(educator, layerId, plain, { notes: JSON.stringify([note]) });
    expect(unattributed.status).toBe(400);
    expect(await unattributed.text()).toContain("Say who the note comes from.");

    const attributed = await save(educator, layerId, plain, {
      notes: JSON.stringify([{ ...note, attribution: "Ratu Joni" }]),
    });
    expect(attributed.status).toBe(302);
    expect((await snapshotOf(layerId)).notes).toEqual([{ ...note, attribution: "Ratu Joni" }]);
  });

  it("refuses an idiom explained only by its literal words", async () => {
    const { educator, layerId, segment: words } = await layerWithWords();
    const temporary = crypto.randomUUID();

    const refused = await save(
      educator,
      layerId,
      [{ ...words, startMs: 1_000, endMs: 3_000, english: "", speaker: "" }],
      {
        annotations: JSON.stringify([annotationOn(words.id, words.tokens[0].id, words.tokens[1].id, temporary)]),
        newExpressions: JSON.stringify([newExpression(temporary, { idiom: true, literalMeaning: "hello" })]),
      },
    );

    expect(refused.status).toBe(400);
    expect(await refused.text()).toContain("Explain what the idiom means beyond its literal translation.");
  });

  it("adds only the new Expressions an Annotation uses, and matches the library across capitals", async () => {
    const { educator, layerId, segment: words } = await layerWithWords();
    const headword = `Āvā-${crypto.randomUUID().slice(0, 6)}`;
    const used = crypto.randomUUID();
    const unused = crypto.randomUUID();
    const plain = [{ ...words, startMs: 1_000, endMs: 3_000, english: "", speaker: "" }];
    await save(educator, layerId, plain, {
      annotations: JSON.stringify([annotationOn(words.id, words.tokens[0].id, words.tokens[0].id, used)]),
      newExpressions: JSON.stringify([
        newExpression(used, { headword, generalMeaning: "a test word" }),
        newExpression(unused, { headword: `unused-${crypto.randomUUID()}` }),
      ]),
    });
    expect(await env.DB.prepare("SELECT id FROM expression WHERE id = ?1").bind(unused).first()).toBeNull();

    const again = crypto.randomUUID();
    await save(educator, layerId, plain, {
      annotations: JSON.stringify([annotationOn(words.id, words.tokens[1].id, words.tokens[1].id, again)]),
      newExpressions: JSON.stringify([
        newExpression(again, { headword: headword.toLowerCase(), generalMeaning: "a test word" }),
      ]),
    });
    expect((await snapshotOf(layerId)).annotations[0].expressionId).toBe(used);
  });

  it("refuses a new Expression whose ID another Expression already has, rather than moving Annotations", async () => {
    const { educator, layerId, segment: words } = await layerWithWords();
    const first = crypto.randomUUID();
    const plain = [{ ...words, startMs: 1_000, endMs: 3_000, english: "", speaker: "" }];
    await save(educator, layerId, plain, {
      annotations: JSON.stringify([annotationOn(words.id, words.tokens[0].id, words.tokens[0].id, first)]),
      newExpressions: JSON.stringify([newExpression(first, { headword: `taken-${crypto.randomUUID().slice(0, 6)}` })]),
    });

    const refused = await save(educator, layerId, plain, {
      annotations: JSON.stringify([annotationOn(words.id, words.tokens[0].id, words.tokens[0].id, first)]),
      newExpressions: JSON.stringify([newExpression(first, { headword: "something else" })]),
    });

    expect(refused.status).toBe(400);
    expect(await refused.text()).toContain("already in use");
  });

  it("lets editors and whoever added an Expression change it in the library", async () => {
    const { editor, educator, layerId, segment: words } = await layerWithWords();
    const temporary = crypto.randomUUID();
    await save(educator, layerId, [{ ...words, startMs: 1_000, endMs: 3_000, english: "", speaker: "" }], {
      annotations: JSON.stringify([annotationOn(words.id, words.tokens[3].id, words.tokens[3].id, temporary)]),
      newExpressions: JSON.stringify([
        newExpression(temporary, {
          headword: `vinaka-${crypto.randomUUID().slice(0, 6)}`,
          generalMeaning: "good; thank you",
        }),
      ]),
    });
    const expressionId = (await snapshotOf(layerId)).annotations[0].expressionId;
    const other = await staff("other-educator", { role: "educator" });
    const form = {
      headword: "vinaka",
      generalMeaning: "good; thank you",
      grammarNote: "",
      pronunciation: "vee-nah-kah",
      literalMeaning: "",
    };

    expect((await other.browser.fetch(`/admin/expressions/${expressionId}`, { form })).status).toBe(403);
    const refusals = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_event WHERE action = 'expression.refused' AND object_id = ?1 AND actor_id = ?2",
    )
      .bind(expressionId, other.userId)
      .first<{ count: number }>();
    expect(refusals?.count).toBe(1);
    expect((await educator.browser.fetch(`/admin/expressions/${expressionId}`, { form })).status).toBe(302);
    expect(
      (await editor.browser.fetch(`/admin/expressions/${expressionId}`, { form: { ...form, pronunciation: "vinaka" } }))
        .status,
    ).toBe(302);
    const row = await env.DB.prepare("SELECT pronunciation FROM expression WHERE id = ?1")
      .bind(expressionId)
      .first<{ pronunciation: string }>();
    expect(row?.pronunciation).toBe("vinaka");
    // The Learning Layer keeps its copy until it is next saved.
    expect((await snapshotOf(layerId)).expressions[expressionId]).toMatchObject({ pronunciation: "nee sah mbula" });
    expect(await (await other.browser.fetch("/admin/expressions?q=good")).text()).toContain(
      `/admin/expressions/${expressionId}`,
    );
  });

  it("lets the Educator who added an Expression change it only until another's Learning Layer uses it", async () => {
    const mine = await layerWithWords();
    const theirs = await layerWithWords();
    const id = crypto.randomUUID();
    const headword = `sega-${crypto.randomUUID().slice(0, 6)}`;
    const plain = (words: typeof mine.segment) => [
      { ...words, startMs: 1_000, endMs: 3_000, english: "", speaker: "" },
    ];
    await save(mine.educator, mine.layerId, plain(mine.segment), {
      annotations: JSON.stringify([
        annotationOn(mine.segment.id, mine.segment.tokens[0].id, mine.segment.tokens[0].id, id),
      ]),
      newExpressions: JSON.stringify([newExpression(id, { headword, generalMeaning: "no; not" })]),
    });
    const form = { headword, generalMeaning: "no; not", grammarNote: "", pronunciation: "senga", literalMeaning: "" };
    expect((await mine.educator.browser.fetch(`/admin/expressions/${id}`, { form })).status).toBe(302);

    // Another Educator's Learning Layer starts using it.
    await save(theirs.educator, theirs.layerId, plain(theirs.segment), {
      annotations: JSON.stringify([
        annotationOn(theirs.segment.id, theirs.segment.tokens[0].id, theirs.segment.tokens[0].id, id),
      ]),
    });

    expect((await mine.educator.browser.fetch(`/admin/expressions/${id}`, { form })).status).toBe(403);
    expect(
      (await mine.editor.browser.fetch(`/admin/expressions/${id}`, { form: { ...form, pronunciation: "sega" } }))
        .status,
    ).toBe(302);
    // The other Learning Layer's editor shows the library change before it is saved again.
    const page = await (await theirs.educator.browser.fetch(`/admin/learning-layers/${theirs.layerId}`)).text();
    expect(page).toContain("Updated in the library since this Learning Layer was saved");
  });

  it("splits a hyphenated compound into its parts, and flags an Annotation whose word an edit repeats", async () => {
    const { educator, layerId, segment: words } = await layerWithWords();
    const compound = { ...words, fijian: "Ni sa vale-ni-vuli", startMs: 1_000, endMs: 3_000, english: "", speaker: "" };
    await save(educator, layerId, [compound]);
    const split = await snapshotOf(layerId);
    expect(split.segments[0].tokens.map((token) => token.text)).toEqual(["Ni", "sa", "vale", "ni", "vuli"]);

    const id = crypto.randomUUID();
    const vuli = split.segments[0].tokens[4];
    await save(educator, layerId, [{ ...split.segments[0], startMs: 1_000, endMs: 3_000, english: "", speaker: "" }], {
      annotations: JSON.stringify([annotationOn(words.id, vuli.id, vuli.id, id)]),
      newExpressions: JSON.stringify([
        newExpression(id, { headword: `vuli-${crypto.randomUUID().slice(0, 6)}`, generalMeaning: "learn" }),
      ]),
    });
    const annotated = await snapshotOf(layerId);

    // Sent without matching tokens, the server re-tokenises and flags the Annotation to check.
    const repeated = {
      ...annotated.segments[0],
      fijian: "Ni sa vuli vale-ni-vuli",
      startMs: 1_000,
      endMs: 3_000,
      english: "",
      speaker: "",
    };
    expect(
      (await save(educator, layerId, [repeated], { annotations: JSON.stringify(annotated.annotations) })).status,
    ).toBe(302);
    const flagged = (await snapshotOf(layerId)).annotations[0] as { needsCheck?: boolean };
    expect(flagged.needsCheck).toBe(true);
  });
});
