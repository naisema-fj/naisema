import { env } from "cloudflare:test";
import { expect } from "vitest";
import { languageReviewerRole, post, type Staff, staff, topic } from "./articles";
import { recordMediaRights, recordRights } from "./rights";
import { readyVideoAsset } from "./video";

/** Videos with Learning Layers, authored, reviewed and given rights through the staff pages. */

export const TEACHING = ["translate", "transcribe", "educationalAdaptation"];

/** A Video Content Item on a ready Video Asset, with any Content Flags. */
export async function video(editor: Staff, flags: string[] = []) {
  const assetId = await readyVideoAsset(editor, { seconds: 30, width: 1280, height: 720 });
  const form = new URLSearchParams({
    title: "Talanoa at the market",
    summary: "Two friends meet at the Suva market.",
    primaryArea: "learn",
    credit: "Filmed by Sera",
    body: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Bula." }] }] }),
    topicId: await topic(editor),
    videoAssetId: assetId,
  });
  for (const flag of flags) form.append("flag", flag);
  const response = await post(editor, "/admin/articles/new?type=video", form);
  expect(response.status, await response.clone().text()).toBe(302);
  return { id: response.headers.get("Location")?.split("/").at(-1) as string, assetId };
}

export const layerRow = (id: string) =>
  env.DB.prepare(
    `SELECT l.publication_state AS state, l.current_published_revision_id AS publishedId, r.id AS revisionId,
            r.number, r.snapshot
     FROM learning_layer l JOIN learning_layer_revision r ON r.id = l.current_draft_revision_id WHERE l.id = ?1`,
  )
    .bind(id)
    .first<{ state: string; publishedId: string | null; revisionId: string; number: number; snapshot: string }>();

const segmentId = crypto.randomUUID();
const activityId = crypto.randomUUID();
const [rightChoice, wrongChoice] = [crypto.randomUUID(), crypto.randomUUID()];

/** What a ready Learning Layer holds: one checked Segment and one required Activity. */
export const readyContent = (change: { english?: string; startMs?: number } = {}) => ({
  segments: JSON.stringify([
    {
      id: segmentId,
      startMs: change.startMs ?? 1_000,
      endMs: 3_000,
      speaker: "Mere",
      fijian: "Bula vinaka",
      english: change.english ?? "Hello",
      overlapIntended: false,
      draft: false,
    },
  ]),
  activities: JSON.stringify([
    {
      id: activityId,
      kind: "comprehension",
      segmentId: null,
      prompt: "Who is Mere greeting?",
      options: [
        { id: rightChoice, text: "Her friend", correct: true },
        { id: wrongChoice, text: "A stallholder", correct: false },
      ],
      modelResponse: "",
      feedback: "She greets her friend Sera.",
      pronunciation: "",
      required: true,
      textAlternative: "Read the transcript, then choose who Mere greets.",
    },
  ]),
});

/** Saves the Learning Layer's editor form on top of its current draft. */
export async function save(who: Staff, layerId: string, fields: Record<string, string> = {}) {
  const current = await layerRow(layerId);
  const response = await who.browser.fetch(`/admin/learning-layers/${layerId}`, {
    form: {
      intent: "save",
      baseRevisionId: current?.revisionId ?? "",
      title: "Greetings",
      level: "beginner",
      clip: "whole",
      sourceStart: "",
      sourceEnd: "",
      ...readyContent(),
      ...fields,
    },
  });
  expect(response.status, await response.clone().text()).toBe(302);
  return (await layerRow(layerId)) as NonNullable<Awaited<ReturnType<typeof layerRow>>>;
}

/** A Video with an Educator assigned, and a Learning Layer they added and filled in. */
export async function authoredLayer({ flags = [] as string[] } = {}) {
  const editor = await staff("editor", { role: "editor" });
  const educator = await staff("educator", { role: "educator" });
  const reviewer = await staff("reviewer", languageReviewerRole);
  const { id: videoId, assetId } = await video(editor, flags);
  await editor.browser.fetch(`/admin/videos/${videoId}/learning-layers`, {
    form: { intent: "assign", educatorId: educator.userId },
  });
  const created = await educator.browser.fetch(`/admin/videos/${videoId}/learning-layers`, {
    form: { intent: "create", title: "Greetings", level: "beginner", clip: "whole" },
  });
  const layerId = created.headers.get("Location")?.split("/").at(-1) as string;
  // The editor's checkbox starts ticked on a culturally sensitive Video, so its saves send it.
  const saved = await save(educator, layerId, flags.includes("sensitiveCultural") ? { sensitiveCultural: "on" } : {});
  return { editor, educator, reviewer, videoId, assetId, layerId, number: saved.number };
}

export const act = (who: Staff, layerId: string, number: number, form: Record<string, string> | FormData) =>
  who.browser.fetch(
    `/admin/learning-layers/${layerId}/revisions/${number}`,
    form instanceof FormData ? { multipart: form } : { form },
  );

/** Every right a Learning Layer needs: the Video's Publish and teaching uses, and its footage's Publish. */
export async function grantRights(editor: Staff, videoId: string, assetId: string) {
  expect((await recordRights(editor.browser, videoId, { uses: ["publish"] })).status).toBe(302);
  expect((await recordRights(editor.browser, videoId, { uses: TEACHING })).status).toBe(302);
  expect((await recordMediaRights(editor.browser, assetId)).status).toBe(302);
}

export const recordsOf = (videoId: string) =>
  env.DB.prepare("SELECT id, permitted_uses AS uses FROM rights_record WHERE subject_id = ?1")
    .bind(videoId)
    .all<{ id: string; uses: string }>();

/** A Learning Layer submitted, approved for language, with every right in place: ready to publish. */
export async function approvedLayer(options: Parameters<typeof authoredLayer>[0] = {}) {
  const layer = await authoredLayer(options);
  const { editor, educator, reviewer, layerId, number, videoId, assetId } = layer;
  expect((await act(educator, layerId, number, { intent: "submit" })).status).toBe(302);
  await act(editor, layerId, number, { intent: "assign", reviewType: "language", reviewerId: reviewer.userId });
  await act(reviewer, layerId, number, { intent: "decide", reviewType: "language", decision: "approved" });
  await grantRights(editor, videoId, assetId);
  return layer;
}
