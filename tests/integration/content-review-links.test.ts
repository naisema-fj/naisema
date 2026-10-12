import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { issueToken } from "~/lib/access-links";
import { getDb } from "~/lib/db.server";
import { scanUpload } from "~/lib/scan.server";
import { act, type Staff, saveNewRevision, staff, submittedArticle } from "./support/articles";
import { clean, createEpisode } from "./support/episodes";
import { video } from "./support/layers";
import { recordRights } from "./support/rights";

/**
 * Review Links to Content Item Revisions (#44, ADR-0003, GOV-03): an editor shares an exact
 * Revision with a Knowledge Holder, and their approval names the link they saw it through.
 */

const PUBLIC = "https://naisema.test";
const DAY = 86_400_000;

/** Issues a Review Link to the revision and returns its public path (the address is shown once). */
async function issue(editor: Staff, itemId: string, number = 1, recipient = "Ratu Joni") {
  const response = await act(editor, itemId, number, { intent: "issueLink", recipient });
  const html = await response.text();
  const url = html.match(/https?:\/\/[^"<\s]+\/review\/[A-Za-z0-9_-]+/)?.[0];
  if (!url) throw new Error(`No Review Link issued (${response.status}): ${html.slice(0, 300)}`);
  return new URL(url).pathname;
}

const linksTo = (itemId: string) =>
  env.DB.prepare(
    `SELECT k.id, k.created_at AS createdAt, k.expires_at AS expiresAt FROM review_link k
     JOIN revision r ON r.id = k.content_revision_id WHERE r.content_item_id = ?1 ORDER BY k.created_at`,
  )
    .bind(itemId)
    .all<{ id: string; createdAt: number; expiresAt: number }>();

const accesses = (linkId: string) =>
  env.DB.prepare("SELECT outcome FROM review_link_access WHERE review_link_id = ?1 ORDER BY accessed_at")
    .bind(linkId)
    .all<{ outcome: string }>();

const withdrawPublish = async (editor: Staff, itemId: string) => {
  expect((await recordRights(editor.browser, itemId, { uses: ["publish"] })).status).toBe(302);
  const record = await env.DB.prepare("SELECT id FROM rights_record WHERE subject_id = ?1 AND withdrawn_at IS NULL")
    .bind(itemId)
    .first<{ id: string }>();
  await editor.browser.fetch(`/admin/articles/${itemId}/rights`, {
    form: { intent: "withdraw", recordId: record?.id as string, reason: "The family withdrew it." },
  });
};

describe("Review Links to a Content Item Revision", () => {
  it("shows the exact revision to anyone with the link, watermarked, never cached or indexed, logging each opening", async () => {
    const { editor, article } = await submittedArticle(["sensitiveCultural"]);
    const path = await issue(editor, article.id);

    const page = await SELF.fetch(`${PUBLIC}${path}`);

    expect(page.status).toBe(200);
    expect(page.headers.get("Cache-Control")).toBe("private, no-store");
    expect(page.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    const html = await page.text();
    expect(html).toContain("Draft for review");
    expect(html).toContain("Vosa vakaviti");
    expect(html).toContain("Greetings.");
    expect(html).toContain("Bula vinaka.");
    expect(html).toContain("Words by Sera");
    expect(html).not.toContain("/admin/");
    const [link] = (await linksTo(article.id)).results;
    expect(link.expiresAt - link.createdAt).toBe(14 * DAY);
    expect((await accesses(link.id)).results).toEqual([{ outcome: "viewed" }]);
  });

  it("is for exactly one kind of Revision, and can only be revoked", async () => {
    const { editor, article } = await submittedArticle([]);
    await issue(editor, article.id);
    const [link] = (await linksTo(article.id)).results;

    await expect(
      env.DB.prepare(
        "INSERT INTO review_link (id, token_hash, recipient, created_by, created_at, expires_at) VALUES ('none', 'h1', 'x', 'u', 0, 1)",
      ).run(),
    ).rejects.toThrow(/review_link_one_revision/);
    await expect(
      env.DB.prepare("UPDATE review_link SET expires_at = ?1 WHERE id = ?2")
        .bind(Date.now() + 1e9, link.id)
        .run(),
    ).rejects.toThrow(/only be revoked/);
  });

  it("is issued only to editors, only once submitted, and only for the latest revision", async () => {
    const editor = await staff("editor", { role: "editor" });
    const reviewer = await staff("reviewer", { role: "reviewer", reviewType: "editorial" });
    const { article, editor: author } = await submittedArticle(["sensitiveCultural"]);

    const byReviewer = await act(reviewer, article.id, 1, { intent: "issueLink", recipient: "Ratu Joni" });
    expect(byReviewer.status).toBeGreaterThanOrEqual(400);
    await saveNewRevision(author, article, { flag: ["sensitiveCultural"], summary: "Greetings, changed." });
    const stale = await act(author, article.id, 1, { intent: "issueLink", recipient: "Ratu Joni" });
    expect(stale.status).toBe(400);
    expect(await stale.text()).toContain("Only the latest revision can be shared for review.");
    const unsubmitted = await act(author, article.id, 2, { intent: "issueLink", recipient: "Ratu Joni" });
    expect(await unsubmitted.text()).toContain("Submit this revision for review before sharing it.");
    expect((await linksTo(article.id)).results).toHaveLength(0);
    void editor;
  });

  it("stops working once revoked or expired, still logging the attempt", async () => {
    const { editor, article } = await submittedArticle([]);
    const path = await issue(editor, article.id);
    const [link] = (await linksTo(article.id)).results;

    expect((await act(editor, article.id, 1, { intent: "revokeLink", linkId: link.id })).status).toBe(302);
    expect((await SELF.fetch(`${PUBLIC}${path}`)).status).toBe(410);

    const { token, tokenHash } = await issueToken();
    const expiring = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO review_link (id, content_revision_id, token_hash, recipient, created_by, created_at, expires_at)
       SELECT ?1, content_revision_id, ?2, 'Ratu Joni', created_by, ?3, ?4 FROM review_link WHERE id = ?5`,
    )
      .bind(expiring, tokenHash, Date.now() - 15 * DAY, Date.now() - DAY, link.id)
      .run();
    expect((await SELF.fetch(`${PUBLIC}/review/${token}`)).status).toBe(410);
    expect((await accesses(link.id)).results).toEqual([{ outcome: "revoked" }]);
    expect((await accesses(expiring)).results).toEqual([{ outcome: "expired" }]);
    // A link can't be revoked through another revision's page.
    const other = await submittedArticle([]);
    await issue(other.editor, other.article.id);
    const [otherLink] = (await linksTo(other.article.id)).results;
    const crossed = await act(editor, article.id, 1, { intent: "revokeLink", linkId: otherLink.id });
    expect(await crossed.text()).toContain("That Review Link isn&#x27;t for this revision.");
  });
});

describe("audio and video on a Review Link", () => {
  it("plays an Episode's audio only while the link is active and its Publish grant stands", async () => {
    const editor = await staff("editor", { role: "editor" });
    const id = await createEpisode(editor);
    expect((await act(editor, id, 1, { intent: "submit" })).status).toBe(302);
    const path = await issue(editor, id);

    const html = await (await SELF.fetch(`${PUBLIC}${path}`)).text();
    expect(html).toContain(`src="${path}/audio"`);
    expect(html).toContain("Mere: Bula vinaka, Ratu.");
    const played = await SELF.fetch(`${PUBLIC}${path}/audio`);
    expect(played.status).toBe(200);
    expect(played.headers.get("Cache-Control")).toBe("private, no-store");
    expect(played.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    await played.arrayBuffer();
    const later = await SELF.fetch(`${PUBLIC}${path}/audio`, { headers: { Range: "bytes=4-9" } });
    expect(later.status).toBe(206);
    await later.arrayBuffer();
    const [link] = (await linksTo(id)).results;
    expect((await accesses(link.id)).results).toEqual([{ outcome: "viewed" }, { outcome: "played" }]);

    // Withdrawing the item's Publish grant stops the audio, and the page says so.
    await withdrawPublish(editor, id);
    expect((await SELF.fetch(`${PUBLIC}${path}/audio`)).status).toBe(404);
    expect(await (await SELF.fetch(`${PUBLIC}${path}`)).text()).toContain(
      "The recording can&#x27;t be played right now.",
    );

    // Revoked: no audio either.
    await act(editor, id, 1, { intent: "revokeLink", linkId: link.id });
    expect((await SELF.fetch(`${PUBLIC}${path}/audio`)).status).toBe(403);
  });

  it("plays a Video's footage only while the link is active and its Publish grant stands", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id } = await video(editor);
    expect((await act(editor, id, 1, { intent: "submit" })).status).toBe(302);
    const path = await issue(editor, id);

    const html = await (await SELF.fetch(`${PUBLIC}${path}`)).text();
    expect(html).toContain("Talanoa at the market");
    expect(html).toContain(`src="${path}/video"`);
    expect((await SELF.fetch(`${PUBLIC}${path}/video`)).status).toBe(200);

    await withdrawPublish(editor, id);
    expect((await SELF.fetch(`${PUBLIC}${path}/video`)).status).toBe(404);
    expect(await (await SELF.fetch(`${PUBLIC}${path}`)).text()).toContain("The video can&#x27;t be played right now.");
    // An Episode's audio route answers nothing for a Video.
    expect((await SELF.fetch(`${PUBLIC}${path}/audio`)).status).toBe(404);
  });
});

describe("Knowledge Holder Approvals through a Review Link", () => {
  const evidenceForm = (fields: Record<string, string>, evidence = true) => {
    const form = new FormData();
    form.set("intent", "knowledgeHolder");
    for (const [name, value] of Object.entries(fields)) form.set(name, value);
    if (evidence) {
      form.set(
        "evidence",
        new File([new TextEncoder().encode("%PDF-1.7\n% signed note\n")], "approval.pdf", { type: "application/pdf" }),
      );
    }
    return form;
  };

  async function sharedArticle() {
    const { editor, article } = await submittedArticle(["sensitiveCultural"]);
    const otherEditor = await staff("other-editor", { role: "editor" });
    const path = await issue(editor, article.id);
    const [link] = (await linksTo(article.id)).results;
    const base = {
      knowledgeHolderName: "Ratu Joni Madraiwiwi",
      method: "In person at Lomanikoro",
      conditions: "Not to be used in advertising.",
      reviewLinkId: link.id,
    };
    return { editor, otherEditor, article, path, link, base };
  }

  it("names the link they saw, only once it was opened, with private evidence for editors", async () => {
    const { editor, otherEditor, article, path, link, base } = await sharedArticle();

    const unopened = await act(otherEditor, article.id, 1, evidenceForm(base));
    expect(unopened.status).toBe(400);
    expect(await unopened.text()).toContain("never been opened");

    await SELF.fetch(`${PUBLIC}${path}`);
    expect((await act(otherEditor, article.id, 1, evidenceForm(base))).status).toBe(302);
    const recorded = await env.DB.prepare(
      `SELECT review_type AS reviewType, review_link_id AS linkId, conditions, evidence_name AS evidence,
              evidence_asset_id AS assetId
       FROM review_approval WHERE revision_id = (SELECT id FROM revision WHERE content_item_id = ?1 AND number = 1)
       AND knowledge_holder_name IS NOT NULL`,
    )
      .bind(article.id)
      .first<{ reviewType: string; linkId: string; conditions: string; evidence: string; assetId: string }>();
    expect(recorded).toMatchObject({
      reviewType: "cultural",
      linkId: link.id,
      conditions: "Not to be used in advertising.",
      evidence: "approval.pdf",
    });
    const approval = await env.DB.prepare("SELECT id FROM review_approval WHERE review_link_id = ?1")
      .bind(link.id)
      .first<{ id: string }>();

    // The page says which link they saw it through, and offers the evidence to editors.
    const page = await (await editor.browser.fetch(`/admin/articles/${article.id}/revisions/1`)).text();
    expect(page).toContain("seen through the Review Link for Ratu Joni");
    expect(page).toContain(`/admin/articles/approvals/${approval?.id}/evidence`);

    // Held back until scanned, then readable by editors only, and each read is audited.
    const evidenceUrl = `/admin/articles/approvals/${approval?.id}/evidence`;
    expect((await editor.browser.fetch(evidenceUrl)).status).toBe(409);
    await scanUpload(env, getDb(env.DB), recorded?.assetId as string, clean);
    const downloaded = await editor.browser.fetch(evidenceUrl);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get("Content-Disposition")).toContain("approval.pdf");
    expect(await downloaded.text()).toContain("signed note");
    const reviewer = await staff("reviewer", { role: "reviewer", reviewType: "cultural" });
    expect((await reviewer.browser.fetch(evidenceUrl)).status).toBe(404);
    const reads = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM audit_event WHERE action = 'approval_evidence.read' AND object_id = ?1",
    )
      .bind(approval?.id)
      .first<{ n: number }>();
    expect(reads?.n).toBe(1);
  });

  it("refuses a link to another revision, and needs one", async () => {
    const { otherEditor, article, path, base } = await sharedArticle();
    await SELF.fetch(`${PUBLIC}${path}`);
    const elsewhere = await submittedArticle([]);
    await issue(elsewhere.editor, elsewhere.article.id);
    const [foreign] = (await linksTo(elsewhere.article.id)).results;
    await SELF.fetch(`${PUBLIC}${path}`);

    const wrong = await act(otherEditor, article.id, 1, evidenceForm({ ...base, reviewLinkId: foreign.id }, false));
    const none = await act(otherEditor, article.id, 1, evidenceForm({ ...base, reviewLinkId: "" }, false));

    for (const refused of [wrong, none]) {
      expect(refused.status).toBe(400);
      expect(await refused.text()).toContain("Choose the Review Link they saw revision 1 through.");
    }
  });

  it("carries the link and evidence forward with the approval, and lets the item publish", async () => {
    const { otherEditor, editor, article, path, base } = await sharedArticle();
    await SELF.fetch(`${PUBLIC}${path}`);
    expect((await act(otherEditor, article.id, 1, evidenceForm(base))).status).toBe(302);
    const second = await saveNewRevision(editor, article, { flag: ["sensitiveCultural"] });

    const carried = await env.DB.prepare(
      `SELECT review_link_id AS linkId, evidence_name AS evidence, carried_forward_from_id AS carriedFrom
       FROM review_approval WHERE revision_id = ?1 AND knowledge_holder_name IS NOT NULL`,
    )
      .bind(second.id)
      .first<{ linkId: string; evidence: string; carriedFrom: string }>();

    expect(carried?.carriedFrom).toBeTruthy();
    expect(carried).toMatchObject({ evidence: "approval.pdf" });
    expect(carried?.linkId).toBe(base.reviewLinkId);
    await act(editor, article.id, second.number, { intent: "submit" });
    expect((await act(otherEditor, article.id, second.number, { intent: "publish" })).status).toBe(302);
  });

  it("leaves approvals recorded without a link valid", async () => {
    const { editor, article } = await submittedArticle(["sensitiveCultural"]);
    const otherEditor = await staff("other-editor", { role: "editor" });
    const revision = await env.DB.prepare("SELECT id FROM revision WHERE content_item_id = ?1 AND number = 1")
      .bind(article.id)
      .first<{ id: string }>();
    await env.DB.prepare(
      `INSERT INTO review_approval (id, revision_id, review_type, decision, reviewer_id, knowledge_holder_name,
         knowledge_holder_method, decided_at)
       VALUES (?1, ?2, 'cultural', 'approved', ?3, 'Ratu Epeli', 'In person', ?4)`,
    )
      .bind(crypto.randomUUID(), revision?.id, otherEditor.userId, Date.now())
      .run();

    const published = await act(otherEditor, article.id, 1, { intent: "publish" });
    const page = await (await editor.browser.fetch(`/admin/articles/${article.id}/revisions/1`)).text();

    expect(published.status).toBe(302);
    expect(page).toContain("by Ratu Epeli (In person)");
    expect(page).not.toContain("seen through the Review Link");
  });
});
