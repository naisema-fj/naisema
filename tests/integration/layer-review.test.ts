import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { isLayerEligible } from "~/lib/layer-review.server";
import { isEligible } from "~/lib/publication.server";
import { hashToken, randomToken } from "~/lib/signed-tokens.server";
import { languageReviewerRole, post, type Staff, staff, topic } from "./support/articles";
import { recordMediaRights, recordRights } from "./support/rights";
import { readyVideoAsset } from "./support/video";

const PUBLIC = "https://naisema.test";
const TEACHING = ["translate", "transcribe", "educationalAdaptation"];

/** A Video Content Item on a ready Video Asset, with any Content Flags. */
async function video(editor: Staff, flags: string[] = []) {
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

const layerRow = (id: string) =>
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
const readyContent = (change: { english?: string; startMs?: number } = {}) => ({
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
async function save(who: Staff, layerId: string, fields: Record<string, string> = {}) {
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
async function authoredLayer({ flags = [] as string[] } = {}) {
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

const act = (who: Staff, layerId: string, number: number, form: Record<string, string> | FormData) =>
  who.browser.fetch(
    `/admin/learning-layers/${layerId}/revisions/${number}`,
    form instanceof FormData ? { multipart: form } : { form },
  );

/** Every right a Learning Layer needs: the Video's Publish and teaching uses, and its footage's Publish. */
async function grantRights(editor: Staff, videoId: string, assetId: string) {
  expect((await recordRights(editor.browser, videoId, { uses: ["publish"] })).status).toBe(302);
  expect((await recordRights(editor.browser, videoId, { uses: TEACHING })).status).toBe(302);
  expect((await recordMediaRights(editor.browser, assetId)).status).toBe(302);
}

const recordsOf = (videoId: string) =>
  env.DB.prepare("SELECT id, permitted_uses AS uses FROM rights_record WHERE subject_id = ?1")
    .bind(videoId)
    .all<{ id: string; uses: string }>();

describe("publishing a Learning Layer (VAC-06)", () => {
  it("is refused at every step until it is submitted, reviewed, ready and its Video's rights allow teaching", async () => {
    const { editor, educator, reviewer, videoId, assetId, layerId, number } = await authoredLayer();
    const publish = async () => {
      const response = await act(editor, layerId, number, { intent: "publish" });
      return { status: response.status, text: await response.text() };
    };

    let attempt = await publish();
    expect(attempt.status).toBe(400);
    expect(attempt.text).toContain("It hasn&#x27;t been submitted for review.");

    // The Educator who wrote it submits it; the editor asks a language reviewer.
    expect((await act(educator, layerId, number, { intent: "submit" })).status).toBe(302);
    expect(
      (await act(editor, layerId, number, { intent: "assign", reviewType: "language", reviewerId: reviewer.userId }))
        .status,
    ).toBe(302);
    attempt = await publish();
    expect(attempt.text).toContain("Language review (standard-fijian) is still needed.");

    expect(
      (await act(reviewer, layerId, number, { intent: "decide", reviewType: "language", decision: "approved" })).status,
    ).toBe(302);
    attempt = await publish();
    expect(attempt.text).toContain("Its Video has no current Rights Record granting Publish.");
    expect(attempt.text).toContain("Its Video has no current Rights Record granting Translate.");
    expect(attempt.text).toContain("The file talanoa.mp4 has no current Rights Record granting Publish.");
    const refusals = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_event WHERE action = 'learning_layer.publish_refused' AND object_id = ?1",
    )
      .bind((await layerRow(layerId))?.revisionId)
      .first<{ count: number }>();
    expect(refusals?.count).toBe(3);

    await grantRights(editor, videoId, assetId);
    expect((await act(editor, layerId, number, { intent: "publish" })).status).toBe(302);
    const published = await layerRow(layerId);
    expect(published).toMatchObject({ state: "published", publishedId: published?.revisionId });
  });

  it("can't be submitted or reviewed by someone not on it, and the author can't approve their own work", async () => {
    const { layerId, number, educator } = await authoredLayer();
    const stranger = await staff("other-educator", { role: "educator" });
    const unassigned = await staff("other-reviewer", languageReviewerRole);
    expect((await stranger.browser.fetch(`/admin/learning-layers/${layerId}/revisions/${number}`)).status).toBe(403);
    expect((await unassigned.browser.fetch(`/admin/learning-layers/${layerId}/revisions/${number}`)).status).toBe(403);
    // The Educator can open and submit it, but can't decide on it.
    expect((await act(educator, layerId, number, { intent: "submit" })).status).toBe(302);
    const refused = await act(educator, layerId, number, {
      intent: "decide",
      reviewType: "language",
      decision: "approved",
    });
    expect(refused.status).toBe(400);
  });
});

describe("carrying approvals forward", () => {
  it("keeps language approval through a retiming, but needs it again once a reviewed translation changes", async () => {
    const { editor, educator, reviewer, layerId, number } = await authoredLayer();
    await act(educator, layerId, number, { intent: "submit" });
    await act(editor, layerId, number, { intent: "assign", reviewType: "language", reviewerId: reviewer.userId });
    await act(reviewer, layerId, number, { intent: "decide", reviewType: "language", decision: "approved" });

    const approvalsOn = (revisionId: string) =>
      env.DB.prepare(
        "SELECT review_type AS reviewType, carried_forward_from_id AS carriedFrom FROM learning_layer_approval WHERE revision_id = ?1",
      )
        .bind(revisionId)
        .all<{ reviewType: string; carriedFrom: string | null }>();

    const retimed = await save(educator, layerId, readyContent({ startMs: 1_200 }));
    const carried = (await approvalsOn(retimed.revisionId)).results;
    expect(carried).toHaveLength(1);
    expect(carried[0]).toMatchObject({ reviewType: "language" });
    expect(carried[0].carriedFrom).not.toBeNull();

    const retranslated = await save(educator, layerId, readyContent({ startMs: 1_200, english: "Hello there" }));
    expect((await approvalsOn(retranslated.revisionId)).results).toEqual([]);
    const eligibility = await isLayerEligible(getDb(env.DB), retranslated.revisionId);
    expect(eligibility.eligible).toBe(false);
    if (!eligibility.eligible) expect(eligibility.reasons).toContain("It hasn't been submitted for review.");
  });
});

describe("rights on the Video (VID-01)", () => {
  it("withdrawing teaching rights removes the Learning Layer but not the Video; withdrawing Publish removes both", async () => {
    const { editor, educator, reviewer, videoId, assetId, layerId, number } = await authoredLayer();
    await act(educator, layerId, number, { intent: "submit" });
    await act(editor, layerId, number, { intent: "assign", reviewType: "language", reviewerId: reviewer.userId });
    await act(reviewer, layerId, number, { intent: "decide", reviewType: "language", decision: "approved" });
    await grantRights(editor, videoId, assetId);
    expect((await act(editor, layerId, number, { intent: "publish" })).status).toBe(302);

    const db = getDb(env.DB);
    const { revisionId } = (await layerRow(layerId)) as { revisionId: string };
    const videoRevision = await env.DB.prepare("SELECT current_draft_revision_id AS id FROM content_item WHERE id = ?1")
      .bind(videoId)
      .first<{ id: string }>();
    const videoRightsReasons = async () => {
      const result = await isEligible(db, videoRevision?.id as string);
      return result.eligible ? [] : result.reasons.filter((reason) => reason.includes("Rights Record"));
    };
    const withdraw = (recordId: string) =>
      editor.browser.fetch(`/admin/articles/${videoId}/rights`, {
        form: { intent: "withdraw", recordId, reason: "The family asked us to stop teaching from it." },
      });

    const records = (await recordsOf(videoId)).results;
    const teaching = records.find((record) => record.uses.includes("translate"));
    expect((await withdraw(teaching?.id as string)).status).toBe(302);
    const withoutTeaching = await isLayerEligible(db, revisionId);
    expect(withoutTeaching.eligible).toBe(false);
    if (!withoutTeaching.eligible) {
      expect(withoutTeaching.reasons).toContain("Its Video's Rights Record granting Translate was withdrawn.");
    }
    expect(await videoRightsReasons()).toEqual([]);

    const publish = records.find((record) => record.uses.includes("publish"));
    expect((await withdraw(publish?.id as string)).status).toBe(302);
    const withoutPublish = await isLayerEligible(db, revisionId);
    expect(withoutPublish.eligible).toBe(false);
    if (!withoutPublish.eligible) {
      expect(withoutPublish.reasons).toContain("Its Video's Rights Record granting Publish was withdrawn.");
    }
    expect(await videoRightsReasons()).toEqual(["Its Rights Record granting Publish was withdrawn."]);
  });
});

describe("Review Links and Knowledge Holder Approvals", () => {
  async function issuedLink(flags = ["sensitiveCultural"]) {
    const layer = await authoredLayer({ flags });
    await act(layer.educator, layer.layerId, layer.number, { intent: "submit" });
    // Before any rights are recorded, the editor is told what sharing the footage means.
    const page = await (
      await layer.editor.browser.fetch(`/admin/learning-layers/${layer.layerId}/revisions/${layer.number}`)
    ).text();
    expect(page).toContain("This Video has no Rights Record granting Publish yet.");
    const issued = await act(layer.editor, layer.layerId, layer.number, {
      intent: "issueLink",
      recipient: "Ratu Joni",
    });
    expect(issued.status).toBe(200);
    const url = (await issued.text()).match(/https?:\/\/[^"<\s]+\/review\/[A-Za-z0-9_-]+/)?.[0] as string;
    expect(url).toBeTruthy();
    return { ...layer, path: new URL(url).pathname };
  }

  const linkRows = (layerId: string) =>
    env.DB.prepare(
      `SELECT k.id, k.expires_at AS expiresAt, k.created_at AS createdAt FROM review_link k
       JOIN learning_layer_revision r ON r.id = k.revision_id WHERE r.learning_layer_id = ?1`,
    )
      .bind(layerId)
      .all<{ id: string; expiresAt: number; createdAt: number }>();

  const accesses = (linkId: string) =>
    env.DB.prepare("SELECT outcome FROM review_link_access WHERE review_link_id = ?1 ORDER BY accessed_at")
      .bind(linkId)
      .all<{ outcome: string }>();

  it("shows the exact revision to anyone with the link, watermarked, never cached or indexed, logging each opening", async () => {
    const { layerId, path } = await issuedLink();
    const page = await SELF.fetch(`${PUBLIC}${path}`);
    expect(page.status).toBe(200);
    expect(page.headers.get("Cache-Control")).toBe("private, no-store");
    expect(page.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    const html = await page.text();
    expect(html).toContain("Draft for review");
    expect(html).toContain("Bula vinaka");
    expect(html).toContain("Who is Mere greeting?");
    expect(html).toContain("Her friend (correct)");

    const [link] = (await linkRows(layerId)).results;
    expect(link.expiresAt - link.createdAt).toBe(14 * 86_400_000);
    expect((await SELF.fetch(`${PUBLIC}${path}/video`)).status).toBe(200);
    // A player's later ranges belong to the same play.
    const later = await SELF.fetch(`${PUBLIC}${path}/video`, { headers: { Range: "bytes=100-" } });
    expect(later.status).toBe(206);
    await later.arrayBuffer();
    expect((await accesses(link.id)).results).toEqual([{ outcome: "viewed" }, { outcome: "played" }]);
  });

  it("stops playing the footage once its Publish grant is withdrawn, and can only be revoked", async () => {
    const { editor, videoId, layerId, path } = await issuedLink();
    expect((await recordRights(editor.browser, videoId, { uses: ["publish"] })).status).toBe(302);
    const [record] = (await recordsOf(videoId)).results;
    await editor.browser.fetch(`/admin/articles/${videoId}/rights`, {
      form: { intent: "withdraw", recordId: record.id, reason: "The family withdrew it." },
    });
    const html = await (await SELF.fetch(`${PUBLIC}${path}`)).text();
    expect(html).toContain("The video can&#x27;t be played right now.");
    expect((await SELF.fetch(`${PUBLIC}${path}/video`)).status).toBe(404);

    const [link] = (await linkRows(layerId)).results;
    await expect(
      env.DB.prepare("UPDATE review_link SET expires_at = ?1 WHERE id = ?2")
        .bind(Date.now() + 1e9, link.id)
        .run(),
    ).rejects.toThrow(/only be revoked/);
  });

  it("can only be issued for the latest revision", async () => {
    const { editor, educator, layerId, number } = await issuedLink();
    await save(educator, layerId, { sensitiveCultural: "on", ...readyContent({ english: "Hello there" }) });
    const refused = await act(editor, layerId, number, { intent: "issueLink", recipient: "Ratu Joni" });
    expect(refused.status).toBe(400);
    expect(await refused.text()).toContain("Only the latest revision can be shared for review.");
  });

  it("stops working once revoked or expired, still logging the attempt", async () => {
    const { editor, layerId, number, path } = await issuedLink();
    const [link] = (await linkRows(layerId)).results;
    expect((await act(editor, layerId, number, { intent: "revokeLink", linkId: link.id })).status).toBe(302);
    expect((await SELF.fetch(`${PUBLIC}${path}`)).status).toBe(410);
    expect((await SELF.fetch(`${PUBLIC}${path}/video`)).status).toBe(403);

    // A link issued 15 days ago has expired.
    const token = randomToken();
    const expiring = { id: crypto.randomUUID() };
    await env.DB.prepare(
      `INSERT INTO review_link (id, revision_id, token_hash, recipient, created_by, created_at, expires_at)
       SELECT ?1, revision_id, ?2, 'Ratu Joni', created_by, ?3, ?4 FROM review_link WHERE id = ?5`,
    )
      .bind(expiring.id, await hashToken(token), Date.now() - 15 * 86_400_000, Date.now() - 86_400_000, link.id)
      .run();
    expect((await SELF.fetch(`${PUBLIC}/review/${token}`)).status).toBe(410);
    // The page and the video were both tried.
    expect((await accesses(link.id)).results).toEqual([{ outcome: "revoked" }, { outcome: "revoked" }]);
    expect((await accesses(expiring.id)).results).toEqual([{ outcome: "expired" }]);
    expect((await SELF.fetch(`${PUBLIC}/review/not-a-real-token`)).status).toBe(404);
  });

  it("records a Knowledge Holder Approval naming the link they saw, with private evidence, by an editor who didn't write it", async () => {
    const { editor, reviewer, layerId, number, path, videoId, assetId } = await issuedLink();
    const [link] = (await linkRows(layerId)).results;
    const approval = () => {
      const form = new FormData();
      form.set("intent", "knowledgeHolder");
      form.set("knowledgeHolderName", "Ratu Joni Madraiwiwi");
      form.set("method", "In person at Lomanikoro");
      form.set("conditions", "Not to be used in advertising.");
      form.set("reviewLinkId", link.id);
      form.set(
        "evidence",
        new File([new TextEncoder().encode("%PDF-1.7\n% signed note\n")], "approval.pdf", { type: "application/pdf" }),
      );
      return act(editor, layerId, number, form);
    };

    // Not yet opened: it can't be how they saw this revision.
    const unopened = await approval();
    expect(unopened.status).toBe(400);
    expect(await unopened.text()).toContain("never been opened");

    await SELF.fetch(`${PUBLIC}${path}`);
    expect((await approval()).status).toBe(302);
    const recorded = await env.DB.prepare(
      `SELECT review_type AS reviewType, review_link_id AS linkId, conditions, evidence_name AS evidence
       FROM learning_layer_approval WHERE knowledge_holder_name IS NOT NULL AND review_link_id = ?1`,
    )
      .bind(link.id)
      .first();
    expect(recorded).toEqual({
      reviewType: "cultural",
      linkId: link.id,
      conditions: "Not to be used in advertising.",
      evidence: "approval.pdf",
    });

    // With language review and rights too, the culturally sensitive Learning Layer can publish.
    await act(editor, layerId, number, { intent: "assign", reviewType: "language", reviewerId: reviewer.userId });
    await act(reviewer, layerId, number, { intent: "decide", reviewType: "language", decision: "approved" });
    await grantRights(editor, videoId, assetId);
    expect((await act(editor, layerId, number, { intent: "publish" })).status).toBe(302);
  });

  it("starts a Learning Layer on a culturally sensitive Video flagged, and won't publish one unflagged", async () => {
    const { editor, educator, reviewer, videoId, assetId, layerId } = await authoredLayer({
      flags: ["sensitiveCultural"],
    });
    const flagged = await layerRow(layerId);
    expect(JSON.parse(flagged?.snapshot ?? "{}").flags).toEqual(["sensitiveCultural"]);

    // Unticking the flag doesn't get past the Video's.
    const unflagged = await save(educator, layerId, { sensitiveCultural: "" });
    await act(educator, layerId, unflagged.number, { intent: "submit" });
    await act(editor, layerId, unflagged.number, {
      intent: "assign",
      reviewType: "language",
      reviewerId: reviewer.userId,
    });
    await act(reviewer, layerId, unflagged.number, { intent: "decide", reviewType: "language", decision: "approved" });
    await grantRights(editor, videoId, assetId);
    const refused = await act(editor, layerId, unflagged.number, { intent: "publish" });
    expect(refused.status).toBe(400);
    expect(await refused.text()).toContain("Its Video is marked culturally sensitive");
  });
});

describe("queues and dependent items (VCMS-06)", () => {
  it("shows editors what waits for review, the reviewer their queue, and the video page what depends on it", async () => {
    const { editor, educator, reviewer, layerId, number, assetId } = await authoredLayer();
    await act(educator, layerId, number, { intent: "submit" });
    await act(editor, layerId, number, { intent: "assign", reviewType: "language", reviewerId: reviewer.userId });

    const queues = await (await editor.browser.fetch("/admin/learning-layers")).text();
    expect(queues).toMatch(/Waiting for review[\s\S]*Greetings, revision 2[\s\S]*Ready to publish/);
    const reviews = await (await reviewer.browser.fetch("/admin/reviews")).text();
    expect(reviews).toContain(`/admin/learning-layers/${layerId}/revisions/${number}`);
    const videoPage = await (await editor.browser.fetch(`/admin/media/${assetId}/video`)).text();
    expect(videoPage).toContain(`/admin/learning-layers/${layerId}`);
  });

  it("lists a withdrawn Learning Layer as ready to publish again", async () => {
    const { editor, educator, reviewer, videoId, assetId, layerId, number } = await authoredLayer();
    await act(educator, layerId, number, { intent: "submit" });
    await act(editor, layerId, number, { intent: "assign", reviewType: "language", reviewerId: reviewer.userId });
    await act(reviewer, layerId, number, { intent: "decide", reviewType: "language", decision: "approved" });
    await grantRights(editor, videoId, assetId);
    await act(editor, layerId, number, { intent: "publish" });
    const ready = async () =>
      (await (await editor.browser.fetch("/admin/learning-layers")).text()).match(
        /Ready to publish<\/h2>([\s\S]*?)<\/section>/,
      )?.[1] ?? "";
    expect(await ready()).not.toContain(`/admin/learning-layers/${layerId}/revisions`);
    expect((await act(editor, layerId, number, { intent: "withdraw" })).status).toBe(302);
    expect((await layerRow(layerId))?.state).toBe("withdrawn");
    expect(await ready()).toContain(`/admin/learning-layers/${layerId}/revisions/${number}`);
  });
});
