import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { isEligible } from "~/lib/publication.server";
import {
  act,
  approve,
  body,
  createArticle,
  currentRevision,
  languageFlag,
  languageReviewerRole,
  publication,
  saveNewRevision,
  staff,
  submittedArticle,
} from "./support/articles";
import { pdfEvidence, recordRights } from "./support/rights";
import { auditActions } from "./support/staff";

async function rightsRecords(articleId: string) {
  const { results } = await env.DB.prepare(
    "SELECT id, rights_holder AS rightsHolder, permitted_uses AS uses, evidence_key AS evidenceKey, withdrawn_at AS withdrawnAt FROM rights_record WHERE subject_id = ?1 ORDER BY created_at",
  )
    .bind(articleId)
    .all<{ id: string; rightsHolder: string; uses: string; evidenceKey: string; withdrawnAt: number | null }>();
  return results;
}

/** Stores a record straight in the database, for states the form rightly refuses to create. */
async function insertRecord(articleId: string, fields: { expiresAt?: number; uses?: string[] }) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO rights_record (id, subject_type, subject_id, rights_holder, permitted_uses, guardian_permission,
       evidence_key, evidence_name, evidence_type, expires_at, created_by, created_at)
     VALUES (?1, 'content_item', ?2, 'Sera Vula', ?3, 0, 'rights/test', 'permission.pdf', 'application/pdf', ?4, 'test', ?5)`,
  )
    .bind(id, articleId, JSON.stringify(fields.uses ?? ["publish"]), fields.expiresAt ?? null, Date.now() - 86_400_000)
    .run();
  return id;
}

describe("Rights Records", () => {
  it("records a Rights Record with its evidence in the private bucket, and audits it", async () => {
    const editor = await staff("editor", { role: "editor" });
    const article = await createArticle(editor);

    const response = await recordRights(editor.browser, article.id, {
      uses: ["publish", "excerpt"],
      expiresOn: "2099-01-01",
    });

    expect(response.status).toBe(302);
    const [record] = await rightsRecords(article.id);
    expect(record).toMatchObject({ rightsHolder: "Sera Vula" });
    expect(JSON.parse(record.uses)).toEqual(["publish", "excerpt"]);
    const stored = await env.EVIDENCE.get(record.evidenceKey);
    expect(await stored?.text()).toContain("%PDF-1.7");
    expect(await auditActions(editor.userId)).toContain("rights_record.recorded");
    const page = await (await editor.browser.fetch(`/admin/articles/${article.id}/rights`)).text();
    expect(page).toContain("<h2>Sera Vula: Current</h2>");
    expect(page).toContain("Publish, Excerpt");
    expect(page).not.toContain(record.evidenceKey);
  });

  it("lets an editor download the evidence as an attachment, and audits the read", async () => {
    const editor = await staff("editor", { role: "editor" });
    const article = await createArticle(editor);
    await recordRights(editor.browser, article.id);
    const [record] = await rightsRecords(article.id);

    const download = await editor.browser.fetch(`/admin/rights/${record.id}/evidence`);

    expect(download.status).toBe(200);
    expect(download.headers.get("Content-Disposition")).toBe('attachment; filename="permission.pdf"');
    expect(download.headers.get("Content-Type")).toBe("application/pdf");
    expect(download.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await download.text()).toContain("%PDF-1.7");
    expect(await auditActions(editor.userId)).toContain("rights_evidence.read");
  });

  it("keeps evidence away from everyone but editors, and off the public site", async () => {
    const editor = await staff("editor", { role: "editor" });
    const article = await createArticle(editor);
    await recordRights(editor.browser, article.id);
    const [record] = await rightsRecords(article.id);
    const admin = await staff("admin", { role: "administrator" });
    const reviewer = await staff("reviewer", languageReviewerRole);

    for (const other of [admin, reviewer]) {
      expect((await other.browser.fetch(`/admin/rights/${record.id}/evidence`)).status).toBe(403);
      expect((await other.browser.fetch(`/admin/articles/${article.id}/rights`)).status).toBe(403);
      expect((await recordRights(other.browser, article.id)).status).toBe(403);
    }
    expect((await editor.browser.fetch(`https://naisema.test/admin/rights/${record.id}/evidence`)).status).toBe(404);
  });

  it("accepts only PDF or image evidence, judged by the file's contents", async () => {
    const editor = await staff("editor", { role: "editor" });
    const article = await createArticle(editor);
    const disguised = new File([new TextEncoder().encode("<html><script>alert(1)</script>")], "permission.pdf", {
      type: "application/pdf",
    });

    const response = await recordRights(editor.browser, article.id, { evidence: disguised });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Evidence must be a PDF, JPEG, PNG or WebP file.");
    expect(await rightsRecords(article.id)).toEqual([]);
  });

  it("refuses a file whose declared type or name doesn't match its contents", async () => {
    const editor = await staff("editor", { role: "editor" });
    const article = await createArticle(editor);
    const pdfBytes = new TextEncoder().encode("%PDF-1.7 but really a web page");

    const asHtml = await recordRights(editor.browser, article.id, {
      evidence: new File([pdfBytes], "permission.html", { type: "text/html" }),
    });
    const misnamed = await recordRights(editor.browser, article.id, {
      evidence: new File([pdfBytes], "permission.jpg", { type: "application/pdf" }),
    });

    expect(asHtml.status).toBe(400);
    expect(misnamed.status).toBe(400);
    expect(await rightsRecords(article.id)).toEqual([]);
  });

  it("refuses evidence over 10 MB, stopping a much larger upload before it is all read", async () => {
    const editor = await staff("editor", { role: "editor" });
    const article = await createArticle(editor);
    const pdfOfSize = (bytes: number) => {
      const content = new Uint8Array(bytes);
      content.set(new TextEncoder().encode("%PDF-1.7"));
      return new File([content], "permission.pdf", { type: "application/pdf" });
    };

    const justOver = await recordRights(editor.browser, article.id, { evidence: pdfOfSize(10 * 1024 * 1024 + 1) });
    const farOver = await recordRights(editor.browser, article.id, { evidence: pdfOfSize(11 * 1024 * 1024) });

    expect(justOver.status).toBe(400);
    expect(await justOver.text()).toContain("Evidence files can be at most 10 MB.");
    expect(farOver.status).toBe(413);
    expect(await rightsRecords(article.id)).toEqual([]);
  });

  it("keeps what was entered when the form is refused", async () => {
    const editor = await staff("editor", { role: "editor" });
    const article = await createArticle(editor);

    const response = await recordRights(editor.browser, article.id, {
      rightsHolder: "Vanua Levu Heritage Trust",
      uses: ["publish", "translate"],
      expiresOn: "2099-06-30",
      evidence: new File([new TextEncoder().encode("not evidence")], "x.pdf", { type: "application/pdf" }),
    });

    const page = await response.text();
    expect(page).toContain('value="Vanua Levu Heritage Trust"');
    expect(page).toContain('value="2099-06-30"');
    expect(page).toMatch(/<input type="checkbox" id="use-translate" name="use" checked="" value="translate"\/>/);
  });

  it("needs a Permitted Use, and never ticks AI training for you", async () => {
    const editor = await staff("editor", { role: "editor" });
    const article = await createArticle(editor);

    const none = await recordRights(editor.browser, article.id, { uses: [] });
    const page = await (await editor.browser.fetch(`/admin/articles/${article.id}/rights`)).text();

    expect(none.status).toBe(400);
    expect(page).toMatch(/<input type="checkbox" id="use-aiTraining" name="use" value="aiTraining"\/>/);
  });

  it("refuses an expiry date that has already passed", async () => {
    const editor = await staff("editor", { role: "editor" });
    const article = await createArticle(editor);

    const response = await recordRights(editor.browser, article.id, { expiresOn: "2020-01-01" });

    expect(response.status).toBe(400);
    expect(await rightsRecords(article.id)).toEqual([]);
  });

  it("links a Rights Record to the Contributors it covers", async () => {
    const editor = await staff("editor", { role: "editor" });
    const article = await createArticle(editor);
    await editor.browser.fetch("/admin/contributors", { form: { name: "Mere Tuilau", notes: "Storyteller, Rewa" } });
    const contributor = await env.DB.prepare("SELECT id FROM contributor WHERE name = 'Mere Tuilau'").first<{
      id: string;
    }>();
    const form = new FormData();
    form.set("intent", "record");
    form.set("rightsHolder", "Mere Tuilau");
    form.append("use", "publish");
    form.append("contributorId", contributor?.id as string);
    form.set("evidence", pdfEvidence());

    await editor.browser.fetch(`/admin/articles/${article.id}/rights`, { multipart: form });

    const page = await (await editor.browser.fetch(`/admin/articles/${article.id}/rights`)).text();
    expect(page).toContain("<dt>Contributors</dt><dd>Mere Tuilau</dd>");
  });

  it("can only be withdrawn, never edited", async () => {
    const editor = await staff("editor", { role: "editor" });
    const article = await createArticle(editor);
    await recordRights(editor.browser, article.id);
    const [record] = await rightsRecords(article.id);
    await expect(
      env.DB.prepare("UPDATE rights_record SET withdrawal_reason = 'half' WHERE id = ?1").bind(record.id).run(),
    ).rejects.toThrow(/Rights Records can only be withdrawn/);

    await expect(
      env.DB.prepare("UPDATE rights_record SET permitted_uses = '[\"aiTraining\"]' WHERE id = ?1")
        .bind(record.id)
        .run(),
    ).rejects.toThrow(/Rights Records can only be withdrawn/);
    const withdraw = { intent: "withdraw", recordId: record.id, reason: "The family asked us to stop." };
    expect((await editor.browser.fetch(`/admin/articles/${article.id}/rights`, { form: withdraw })).status).toBe(302);
    expect((await editor.browser.fetch(`/admin/articles/${article.id}/rights`, { form: withdraw })).status).toBe(400);
    await expect(
      env.DB.prepare("UPDATE rights_record SET withdrawn_at = NULL WHERE id = ?1").bind(record.id).run(),
    ).rejects.toThrow(/Rights Records can only be withdrawn/);
    expect(await auditActions(editor.userId)).toContain("rights_record.withdrawn");
  });
});

describe("rights in eligibility (AC-02)", () => {
  it("blocks publishing without a Rights Record", async () => {
    const { editor, article } = await submittedArticle([], [], { rights: false });

    const response = await act(editor, article.id, 1, { intent: "publish" });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("No current Rights Record grants Publish.");
  });

  it("blocks publishing when the only Rights Record grants other uses but not Publish", async () => {
    const { editor, article } = await submittedArticle([], [], { rights: false });
    await recordRights(editor.browser, article.id, { uses: ["excerpt", "translate"] });

    expect((await act(editor, article.id, 1, { intent: "publish" })).status).toBe(400);
  });

  it("blocks publishing with an expired permission", async () => {
    const { editor, article } = await submittedArticle([], [], { rights: false });
    await insertRecord(article.id, { expiresAt: Date.now() - 1000 });

    const response = await act(editor, article.id, 1, { intent: "publish" });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Its Rights Record granting Publish expired on");
  });

  it("blocks publishing a revised, unreviewed language revision even with rights", async () => {
    const reviewer = await staff("lang-reviewer", languageReviewerRole);
    const { editor, article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);
    await approve(reviewer, article.id, 1, "language");
    const revised = await saveNewRevision(editor, article, { ...languageFlag, body: body("Ni sa bula.") });
    await act(editor, article.id, revised.number, { intent: "submit" });

    expect((await act(editor, article.id, revised.number, { intent: "publish" })).status).toBe(400);
  });

  it("makes a published item ineligible the moment its rights are withdrawn, with no unpublish job", async () => {
    const { editor, article } = await submittedArticle([]);
    expect((await act(editor, article.id, 1, { intent: "publish" })).status).toBe(302);
    const published = await currentRevision(article.id);
    const db = getDb(env.DB);
    expect(await isEligible(db, published.id)).toEqual({ eligible: true });

    const [record] = await rightsRecords(article.id);
    await editor.browser.fetch(`/admin/articles/${article.id}/rights`, {
      form: { intent: "withdraw", recordId: record.id, reason: "Permission withdrawn by the family." },
    });

    expect(await isEligible(db, published.id)).toEqual({
      eligible: false,
      reasons: ["Its Rights Record granting Publish was withdrawn."],
    });
    expect((await publication(article.id))?.state).toBe("published");
    const page = await (await editor.browser.fetch(`/admin/articles/${article.id}/revisions/1`)).text();
    expect(page).toContain("Its Rights Record granting Publish was withdrawn.");
  });

  it("makes a published item ineligible the moment its permission expires", async () => {
    const { editor, article } = await submittedArticle([], [], { rights: false });
    const expiresAt = Date.now() + 60_000;
    await insertRecord(article.id, { expiresAt });
    await act(editor, article.id, 1, { intent: "publish" });
    const published = await currentRevision(article.id);
    const db = getDb(env.DB);

    expect(await isEligible(db, published.id, new Date(expiresAt - 1))).toEqual({ eligible: true });
    expect((await isEligible(db, published.id, new Date(expiresAt))).eligible).toBe(false);
  });
});

describe("withdrawing a Rights Record", () => {
  it("only withdraws a record from the article it belongs to", async () => {
    const editor = await staff("editor", { role: "editor" });
    const first = await createArticle(editor);
    const second = await createArticle(editor);
    await recordRights(editor.browser, first.id);
    const [record] = await rightsRecords(first.id);

    const response = await editor.browser.fetch(`/admin/articles/${second.id}/rights`, {
      form: { intent: "withdraw", recordId: record.id, reason: "Wrong article." },
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("That Rights Record doesn&#x27;t belong to this article.");
    expect((await rightsRecords(first.id))[0].withdrawnAt).toBeNull();
  });
});
