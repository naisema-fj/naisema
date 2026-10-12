import { env } from "cloudflare:test";
import { expect } from "vitest";
import { getDb } from "~/lib/db.server";
import { type Scanner, scanUpload } from "~/lib/scan.server";
import { articleForm, post, type Staff, topic } from "./articles";
import { completeUpload, sendPart, startUpload } from "./media";
import { recordMediaRights } from "./rights";

/** Voices Episodes, with a scanned MP3 in the media library, created through the staff pages. */

export const clean: Scanner = async ({ body }) => {
  await body.cancel();
  return { verdict: "clean" };
};

/** An MP3 in the media library: a frame header, then the "sound" the tests read back by range. */
export const SOUND = "0123456789abcdefghijklmnopqrstuvwxyz";
export async function libraryMp3(editor: Staff, { scan = true } = {}) {
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

export async function scanEvidence(itemId: string) {
  const { results } = await env.DB.prepare(
    "SELECT evidence_asset_id AS assetId FROM rights_record WHERE subject_id = ?1 AND evidence_asset_id IS NOT NULL",
  )
    .bind(itemId)
    .all<{ assetId: string }>();
  for (const { assetId } of results) await scanUpload(env, getDb(env.DB), assetId, clean);
}

export const episodeFields = (audioId: string, fields: Record<string, string | string[]> = {}) => ({
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

export async function createEpisode(editor: Staff, fields: Record<string, string | string[]> = {}) {
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
