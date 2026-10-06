import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { type Scanner, scanUpload } from "~/lib/scan.server";
import { act, approve, articleForm, currentRevision, post, type Staff, staff, topic } from "./support/articles";
import { completeUpload, sendPart, startUpload } from "./support/media";
import { recordMediaRights, recordRights } from "./support/rights";
import { readyVideoAsset } from "./support/video";

const PUBLIC = "https://naisema.test";
const visit = (path: string, init: RequestInit = {}) => SELF.fetch(`${PUBLIC}${path}`, { redirect: "manual", ...init });
const read = async (path: string) => (await visit(path)).text();

const clean: Scanner = async ({ body }) => {
  await body.cancel();
  return { verdict: "clean" };
};

/** An MP3 in the media library: a frame header, then the "sound" the tests read back by range. */
const SOUND = "0123456789abcdefghijklmnopqrstuvwxyz";
async function libraryMp3(editor: Staff, { scan = true } = {}) {
  const bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x64, ...new TextEncoder().encode(SOUND)]);
  const { id } = (await (
    await startUpload(editor.browser, { name: "talanoa.mp3", type: "audio/mpeg", size: bytes.length, head: bytes })
  ).json()) as { id: string };
  await sendPart(editor.browser, id, 1, bytes);
  await completeUpload(editor.browser, id);
  if (scan) {
    await scanUpload(env, getDb(env.DB), id, clean);
    expect((await recordMediaRights(editor.browser, id)).status).toBe(302);
  }
  return id;
}

async function scanEvidence(itemId: string) {
  const { results } = await env.DB.prepare(
    "SELECT evidence_asset_id AS assetId FROM rights_record WHERE subject_id = ?1 AND evidence_asset_id IS NOT NULL",
  )
    .bind(itemId)
    .all<{ assetId: string }>();
  for (const { assetId } of results) await scanUpload(env, getDb(env.DB), assetId, clean);
}

const episodeFields = (audioId: string, fields: Record<string, string | string[]> = {}) => ({
  flag: [],
  languageVariety: "",
  title: "Talanoa with Ratu Joni",
  summary: "Growing up in Levuka and leaving for Auckland.",
  credit: "Produced by NAISEMA Voices",
  episodeAudioAssetId: audioId,
  episodeHost: "Mere Vula",
  episodeGuests: "Ratu Joni",
  episodeRecordedOn: "2026-09-12",
  episodeDuration: "32:10",
  episodeTranscript: "Mere: Bula vinaka, Ratu.\n\nRatu Joni: Bula, Mere. [laughs]",
  episodeLinkLabel: ["Spotify", ""],
  episodeLinkUrl: ["https://open.spotify.com/episode/abc", ""],
  ...fields,
});

async function createEpisode(editor: Staff, fields: Record<string, string | string[]> = {}) {
  const audioId = await libraryMp3(editor);
  const response = await post(
    editor,
    "/admin/articles/new?type=episode",
    articleForm(await topic(editor), episodeFields(audioId, fields)),
  );
  const id = response.headers.get("Location")?.split("/").at(-1);
  if (!id) throw new Error(`Not created (${response.status}): ${await response.text()}`);
  return id;
}

/** Records rights, submits, has the transcript reviewed for accessibility, and publishes revision 1. */
async function publishEpisode(editor: Staff, id: string) {
  const reviewer = await staff("reviewer", { role: "reviewer", reviewType: "accessibility" });
  expect((await recordRights(editor.browser, id)).status).toBe(302);
  await scanEvidence(id);
  await act(editor, id, 1, { intent: "assign", reviewType: "accessibility", reviewerId: reviewer.userId });
  expect((await act(editor, id, 1, { intent: "submit" })).status).toBe(302);
  expect((await approve(reviewer, id, 1, "accessibility")).status).toBe(302);
  const published = await act(editor, id, 1, { intent: "publish" });
  expect(published.status, await published.clone().text()).toBe(302);
}

async function pathOf(id: string) {
  const row = await env.DB.prepare("SELECT primary_area AS area, slug FROM content_item WHERE id = ?1")
    .bind(id)
    .first<{ area: string; slug: string }>();
  return `/${row?.area}/${row?.slug}`;
}

describe("Voices Episodes", () => {
  it("are published in Voices with a native player, who speaks, the length and the full transcript", async () => {
    const editor = await staff("editor", { role: "editor" });
    const id = await createEpisode(editor);
    await publishEpisode(editor, id);

    const path = await pathOf(id);
    const page = await read(path);

    expect(path).toMatch(/^\/voices\//);
    expect(page).toContain('<audio controls="" preload="none"');
    expect(page).toContain(`<source src="/episodes/${id}/audio" type="audio/mpeg"/>`);
    expect(page).not.toContain("autoplay");
    expect(page).toContain("Mere Vula");
    expect(page).toContain("Ratu Joni");
    expect(page).toContain('<time dateTime="PT32M10S">32 min</time>');
    expect(page).toContain('<strong class="speaker">Mere: </strong>Bula vinaka, Ratu.');
    expect(page).toContain('href="https://open.spotify.com/episode/abc"');
    expect(page).toContain("open.spotify.com, another website");
    expect(page).toContain("<li>Episode</li>");
    expect(page).toContain('aria-label="Audio of Talanoa with Ratu Joni"');
    expect(page).toContain("Transcript reviewed for accessibility");
    const voices = await read("/voices");
    expect(voices).toContain("Talanoa with Ratu Joni");
    expect(voices).toContain("Episode · 32 min");
  });

  it("can play a video in place of audio, never cached, with its transcript beside it", async () => {
    const editor = await staff("editor", { role: "editor" });
    const videoId = await readyVideoAsset(editor, { seconds: 20, width: 1280, height: 720 });
    expect((await recordMediaRights(editor.browser, videoId)).status).toBe(302);
    const id = await createEpisode(editor, { episodeRecording: "video", episodeVideoAssetId: videoId });
    const row = await env.DB.prepare(
      "SELECT r.snapshot FROM content_item c JOIN revision r ON r.id = c.current_draft_revision_id WHERE c.id = ?1",
    )
      .bind(id)
      .first<{ snapshot: string }>();
    const snapshot = JSON.parse(row?.snapshot ?? "{}");
    expect(snapshot.episode).toMatchObject({ audioAssetId: "", videoAssetId: videoId });
    await publishEpisode(editor, id);

    const page = await visit(await pathOf(id));
    expect(page.headers.get("Cache-Control")).toBe("private, no-store");
    const html = await page.text();
    expect(html).toContain(`/videos/${id}/stream`);
    expect(html).not.toContain("<audio");
    expect(html).toContain("Who&#x27;s speaking");
    expect(html).toContain('<strong class="speaker">Mere: </strong>Bula vinaka, Ratu.');
    expect(await (await visit(`/videos/${id}/playback`)).json()).toMatchObject({
      src: expect.stringMatching(`^/videos/${id}/stream\\?v=`),
      hls: false,
    });
    expect((await visit(`/episodes/${id}/audio`)).status).toBe(404);
  });

  it("refuse a video that hasn't finished processing", async () => {
    const editor = await staff("editor", { role: "editor" });
    const response = await post(
      editor,
      "/admin/articles/new?type=episode",
      articleForm(
        await topic(editor),
        episodeFields("", { episodeRecording: "video", episodeVideoAssetId: crypto.randomUUID() }),
      ),
    );
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Choose a video that has finished processing.");
  });

  it("can't be published without a transcript, and always need its accessibility review", async () => {
    const editor = await staff("editor", { role: "editor" });
    const id = await createEpisode(editor, { episodeTranscript: "" });
    expect((await recordRights(editor.browser, id)).status).toBe(302);
    await scanEvidence(id);
    expect((await act(editor, id, 1, { intent: "submit" })).status).toBe(302);

    const refused = await act(editor, id, 1, { intent: "publish" });
    const text = await refused.text();

    expect(refused.status).toBe(400);
    expect(text).toContain("It has no transcript yet.");
    expect(text).toContain("Accessibility review of the transcript is still needed.");
  });

  it("can only play audio from the media library that has passed its virus scan", async () => {
    const editor = await staff("editor", { role: "editor" });
    const unscanned = await libraryMp3(editor, { scan: false });

    const response = await post(
      editor,
      "/admin/articles/new?type=episode",
      articleForm(await topic(editor), episodeFields(unscanned)),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("passed its virus scan");
  });
});

describe("Reviewing an Episode", () => {
  it("shows its reviewers the transcript, who speaks, and the audio, which only they and editors can hear", async () => {
    const editor = await staff("editor", { role: "editor" });
    const reviewer = await staff("reviewer", { role: "reviewer", reviewType: "accessibility" });
    const outsider = await staff("outsider", { role: "reviewer", reviewType: "accessibility" });
    const id = await createEpisode(editor);
    await act(editor, id, 1, { intent: "assign", reviewType: "accessibility", reviewerId: reviewer.userId });

    const page = await (await reviewer.browser.fetch(`/admin/articles/${id}/revisions/1`)).text();
    const audio = await reviewer.browser.fetch(`/admin/articles/${id}/revisions/1/audio`, {
      headers: { Range: "bytes=4-7" },
    });

    expect(page).toContain("Bula vinaka, Ratu.");
    expect(page).toContain("talanoa.mp3");
    expect(page).toContain("Mere Vula");
    expect(page).toContain(`src="/admin/articles/${id}/revisions/1/audio"`);
    expect(audio.status).toBe(206);
    expect(await audio.text()).toBe("0123");
    expect((await outsider.browser.fetch(`/admin/articles/${id}/revisions/1/audio`)).status).toBe(403);
  });
});

describe("Comparing an Episode's revisions", () => {
  it("shows what changed in its transcript and facts", async () => {
    const editor = await staff("editor", { role: "editor" });
    const id = await createEpisode(editor);
    const first = await currentRevision(id);
    const audioId = (
      await env.DB.prepare("SELECT id FROM media_asset WHERE name = 'talanoa.mp3' ORDER BY created_at DESC").first<{
        id: string;
      }>()
    )?.id as string;
    const saved = await post(
      editor,
      `/admin/articles/${id}`,
      articleForm(await topic(editor), {
        ...episodeFields(audioId, {
          episodeHost: "Sera Vula",
          episodeTranscript: "Mere: Bula vinaka, Ratu.\n\nRatu Joni: Bula, Mere. [laughs]\n\nMere: Vinaka.",
        }),
        baseRevisionId: first.id,
      }),
    );
    expect(saved.status, await saved.clone().text()).toBe(302);

    const page = await (await editor.browser.fetch(`/admin/articles/${id}/compare?from=1&to=2`)).text();

    expect(page).toContain("Mere Vula</del>");
    expect(page).toContain("Sera Vula</ins>");
    expect(page).toContain("Mere: Vinaka.</ins>");
    expect(page).toContain('<li class="same">Ratu Joni: Bula, Mere. [laughs]</li>');
  });
});

describe("Episode audio", () => {
  it("streams with byte ranges, so the player can start at once and seek", async () => {
    const editor = await staff("editor", { role: "editor" });
    const id = await createEpisode(editor);
    await publishEpisode(editor, id);
    const audio = `/episodes/${id}/audio`;

    const whole = await visit(audio);
    const part = await visit(audio, { headers: { Range: "bytes=4-13" } });
    const tail = await visit(audio, { headers: { Range: "bytes=-6" } });
    const beyond = await visit(audio, { headers: { Range: "bytes=999-" } });
    const stale = await visit(audio, { headers: { Range: "bytes=4-13", "If-Range": '"another-version"' } });

    expect(whole.status).toBe(200);
    expect(whole.headers.get("Accept-Ranges")).toBe("bytes");
    expect(whole.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(whole.headers.get("Cache-Control")).toBe("no-store");
    expect((await whole.arrayBuffer()).byteLength).toBe(4 + SOUND.length);
    expect(part.status).toBe(206);
    expect(part.headers.get("Content-Range")).toBe(`bytes 4-13/${4 + SOUND.length}`);
    expect(await part.text()).toBe("0123456789");
    expect(await tail.text()).toBe("uvwxyz");
    expect(beyond.status).toBe(416);
    expect(beyond.headers.get("Content-Range")).toBe(`bytes */${4 + SOUND.length}`);
    // A range against a version the player no longer has gets the whole file.
    expect(whole.headers.get("ETag")).toMatch(/^".+"$/);
    expect(stale.status).toBe(200);
  });

  it("stops the moment the Episode is withdrawn, and isn't served for drafts", async () => {
    const editor = await staff("editor", { role: "editor" });
    const draft = await createEpisode(editor);
    const id = await createEpisode(editor);
    await publishEpisode(editor, id);
    expect((await visit(`/episodes/${id}/audio`)).status).toBe(200);

    await act(editor, id, 1, { intent: "withdraw" });

    expect((await visit(`/episodes/${id}/audio`)).status).toBe(404);
    expect((await visit(`/episodes/${draft}/audio`)).status).toBe(404);
  });
});

describe("Rights Records for an Episode's parts", () => {
  const isaLei = "Isa Lei (1962 recording)";

  it("cover a listed guest, music or archive clip apart from the Episode, and each must stay current", async () => {
    const editor = await staff("editor", { role: "editor" });
    const id = await createEpisode(editor, { episodeMusic: isaLei });
    const music = await recordRights(editor.browser, id, {
      part: { kind: "music", name: isaLei },
      rightsHolder: "Fiji Broadcasting archive",
    });
    expect(music.status).toBe(302);
    await publishEpisode(editor, id);
    const rightsPage = await (await editor.browser.fetch(`/admin/articles/${id}/rights`)).text();
    expect(rightsPage).toContain(`Music: ${isaLei}`);
    expect(rightsPage).toContain("Speaker or guest: Ratu Joni");
    expect(rightsPage).toContain("The whole item");
    expect(await read(await pathOf(id))).toContain("Talanoa with Ratu Joni");

    await withdrawMusic(editor, id);

    expect((await visit(await pathOf(id))).status).toBe(404);
    expect((await visit(`/episodes/${id}/audio`)).status).toBe(404);
  });

  it("stop counting once the part is cut from the Episode", async () => {
    const editor = await staff("editor", { role: "editor" });
    const id = await createEpisode(editor, { episodeMusic: isaLei });
    await recordRights(editor.browser, id, { part: { kind: "music", name: isaLei } });
    await publishEpisode(editor, id);
    await withdrawMusic(editor, id);
    expect((await visit(await pathOf(id))).status).toBe(404);

    // Revision 2 cuts the music; nothing else changes, so the accessibility approval carries forward.
    const first = await currentRevision(id);
    const audioId = (
      await env.DB.prepare("SELECT json_extract(snapshot, '$.episode.audioAssetId') AS id FROM revision WHERE id = ?1")
        .bind(first.id)
        .first<{ id: string }>()
    )?.id as string;
    const topicId = (
      await env.DB.prepare("SELECT json_extract(snapshot, '$.topicIds[0]') AS id FROM revision WHERE id = ?1")
        .bind(first.id)
        .first<{ id: string }>()
    )?.id as string;
    const saved = await post(
      editor,
      `/admin/articles/${id}`,
      articleForm(topicId, { ...episodeFields(audioId, { episodeMusic: "" }), baseRevisionId: first.id }),
    );
    expect(saved.status, await saved.clone().text()).toBe(302);
    expect((await act(editor, id, 2, { intent: "submit" })).status).toBe(302);
    const published = await act(editor, id, 2, { intent: "publish" });

    expect(published.status, await published.clone().text()).toBe(302);
    expect((await visit(await pathOf(id))).status).toBe(200);
  });

  it("can only cover a part the current draft lists", async () => {
    const editor = await staff("editor", { role: "editor" });
    const id = await createEpisode(editor);

    const response = await recordRights(editor.browser, id, { part: { kind: "music", name: "Not in this Episode" } });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Choose a part this item");
  });
});

async function withdrawMusic(editor: Staff, id: string) {
  const record = await env.DB.prepare("SELECT id FROM rights_record WHERE subject_id = ?1 AND part_kind = 'music'")
    .bind(id)
    .first<{ id: string }>();
  const response = await editor.browser.fetch(`/admin/articles/${id}/rights`, {
    form: { intent: "withdraw", recordId: record?.id as string, reason: "The archive withdrew the licence." },
  });
  expect(response.status).toBe(302);
}
