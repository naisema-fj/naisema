import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { RoleAssignment } from "~/lib/permissions";
import { auditActions, signedInStaff } from "./support/staff";

type Staff = Awaited<ReturnType<typeof signedInStaff>>;

let counter = 0;
const unique = (name: string) => `${name}-${++counter}-${crypto.randomUUID().slice(0, 8)}@naisema.test`;
const staff = (name: string, ...roles: RoleAssignment[]) => signedInStaff(unique(name), roles);
const languageFlag = { flag: "languageInstruction", languageVariety: "standard-fijian" };
const languageReviewerRole = { role: "reviewer", reviewType: "language", languageVariety: "standard-fijian" } as const;

const body = (text: string) =>
  JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

async function topic(editor: Staff) {
  const name = `Topic ${crypto.randomUUID()}`;
  await editor.browser.fetch("/admin/topics", { form: { name } });
  const row = await env.DB.prepare("SELECT id FROM topic WHERE name = ?1").bind(name).first<{ id: string }>();
  return row?.id as string;
}

function articleForm(topicId: string, fields: Record<string, string | string[]> = {}) {
  const flagged = ([] as string[]).concat(fields.flag ?? []);
  const form = new URLSearchParams({
    ...(flagged.includes("historicalClaims") && !("sources" in fields) ? { sources: "Oral history from Sera" } : {}),
    title: "Vosa vakaviti",
    summary: "Greetings.",
    primaryArea: "learn",
    credit: "Words by Sera",
    body: body("Bula vinaka."),
    topicId,
  });
  for (const [name, value] of Object.entries(fields)) {
    form.delete(name);
    for (const item of Array.isArray(value) ? value : [value]) form.append(name, item);
  }
  return form;
}

function post(who: Staff, path: string, form: URLSearchParams) {
  return who.browser.fetch(path, {
    method: "POST",
    body: form,
    headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: "http://admin.localhost" },
  });
}

async function createArticle(editor: Staff, fields: Record<string, string | string[]> = {}) {
  const topicId = await topic(editor);
  const response = await post(editor, "/admin/articles/new", articleForm(topicId, fields));
  const id = response.headers.get("Location")?.split("/").at(-1);
  if (!id) throw new Error(`Article not created (${response.status}): ${await response.text()}`);
  return { id, topicId };
}

async function currentRevision(articleId: string) {
  return (await env.DB.prepare(
    "SELECT r.id, r.number FROM content_item c JOIN revision r ON r.id = c.current_draft_revision_id WHERE c.id = ?1",
  )
    .bind(articleId)
    .first<{ id: string; number: number }>()) as { id: string; number: number };
}

async function saveNewRevision(editor: Staff, article: { id: string; topicId: string }, fields = {}) {
  const base = await currentRevision(article.id);
  const response = await post(
    editor,
    `/admin/articles/${article.id}`,
    articleForm(article.topicId, { baseRevisionId: base.id, ...fields }),
  );
  expect(response.status, await response.clone().text()).toBe(302);
  return currentRevision(article.id);
}

function act(who: Staff, articleId: string, number: number, fields: Record<string, string>) {
  return who.browser.fetch(`/admin/articles/${articleId}/revisions/${number}`, { form: fields });
}

async function publication(articleId: string) {
  return env.DB.prepare(
    `SELECT c.publication_state AS state, r.number AS publishedNumber
       FROM content_item c LEFT JOIN revision r ON r.id = c.current_published_revision_id WHERE c.id = ?1`,
  )
    .bind(articleId)
    .first<{ state: string; publishedNumber: number | null }>();
}

async function approvals(revisionId: string) {
  const { results } = await env.DB.prepare(
    "SELECT review_type AS reviewType, decision, carried_forward_from_id AS carriedFrom FROM review_approval WHERE revision_id = ?1 ORDER BY review_type",
  )
    .bind(revisionId)
    .all<{ reviewType: string; decision: string; carriedFrom: string | null }>();
  return results;
}

/** An editor writes a flagged article, assigns reviewers, and submits it. */
async function submittedArticle(flags: string[], reviewers: { reviewType: string; reviewer: Staff }[] = []) {
  const editor = await staff("editor", { role: "editor" });
  const article = await createArticle(editor, {
    flag: flags,
    languageVariety: flags.includes("languageInstruction") ? "standard-fijian" : "",
  });
  for (const { reviewType, reviewer } of reviewers) {
    const assigned = await act(editor, article.id, 1, { intent: "assign", reviewType, reviewerId: reviewer.userId });
    expect(assigned.status, await assigned.clone().text()).toBe(302);
  }
  expect((await act(editor, article.id, 1, { intent: "submit" })).status).toBe(302);
  return { editor, article };
}

const approve = (reviewer: Staff, articleId: string, number: number, reviewType: string) =>
  act(reviewer, articleId, number, { intent: "decide", reviewType, decision: "approved", scope: "All the Fijian" });

describe("review gates", () => {
  it("blocks publishing a language-flagged revision until its language review is approved (AC-02)", async () => {
    const reviewer = await staff("lang-reviewer", languageReviewerRole);
    const { editor, article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);

    const early = await act(editor, article.id, 1, { intent: "publish" });
    expect(early.status).toBe(400);
    expect(await early.text()).toContain("Language review (standard-fijian) is still needed.");
    expect(await publication(article.id)).toEqual({ state: "unpublished", publishedNumber: null });

    expect((await approve(reviewer, article.id, 1, "language")).status).toBe(302);
    expect((await act(editor, article.id, 1, { intent: "publish" })).status).toBe(302);
    expect(await publication(article.id)).toEqual({ state: "published", publishedNumber: 1 });
    expect(await auditActions(editor.userId)).toEqual(
      expect.arrayContaining(["publish.refused", "revision.submitted", "review.assigned", "content_item.published"]),
    );
    expect(await auditActions(reviewer.userId)).toContain("review.approved");
  });

  it("blocks publishing a revised but unreviewed language revision, and keeps the approved one published (AC-02)", async () => {
    const reviewer = await staff("lang-reviewer", languageReviewerRole);
    const { editor, article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);
    await approve(reviewer, article.id, 1, "language");
    await act(editor, article.id, 1, { intent: "publish" });

    const revised = await saveNewRevision(editor, article, {
      ...languageFlag,
      body: body("Bula vinaka, noqu itokani."),
    });
    await act(editor, article.id, revised.number, { intent: "submit" });
    const blocked = await act(editor, article.id, revised.number, { intent: "publish" });

    expect(blocked.status).toBe(400);
    expect(await approvals(revised.id)).toEqual([]);
    expect(await publication(article.id)).toEqual({ state: "published", publishedNumber: 1 });
  });

  it("carries forward only the approvals whose fields didn't change, as recorded Carried-forward Approvals", async () => {
    const languageReviewer = await staff("lang-reviewer", languageReviewerRole);
    const editorialReviewer = await staff("editorial-reviewer", { role: "reviewer", reviewType: "editorial" });
    const { editor, article } = await submittedArticle(
      ["languageInstruction", "historicalClaims"],
      [
        { reviewType: "language", reviewer: languageReviewer },
        { reviewType: "editorial", reviewer: editorialReviewer },
      ],
    );
    await approve(languageReviewer, article.id, 1, "language");
    await approve(editorialReviewer, article.id, 1, "editorial");
    const [firstEditorial, firstLanguage] = await approvals((await currentRevision(article.id)).id);

    // The credit is covered by editorial review but not by language review.
    const revised = await saveNewRevision(editor, article, {
      flag: ["languageInstruction", "historicalClaims"],
      languageVariety: "standard-fijian",
      credit: "Words by Sera and Mere",
    });

    const carried = await approvals(revised.id);
    expect(carried).toEqual([{ reviewType: "language", decision: "approved", carriedFrom: expect.any(String) }]);
    const original = await env.DB.prepare("SELECT id FROM review_approval WHERE id = ?1")
      .bind(carried[0].carriedFrom)
      .first<{ id: string }>();
    expect(original).not.toBeNull();
    expect([firstEditorial.reviewType, firstLanguage.reviewType]).toEqual(["editorial", "language"]);
    expect(await auditActions(editor.userId)).toContain("review_approval.carried_forward");
    await act(editor, article.id, revised.number, { intent: "submit" });
    const page = await (await editor.browser.fetch(`/admin/articles/${article.id}/revisions/${revised.number}`)).text();
    expect(page).toContain("carried forward from revision 1");
    expect(page).toContain("Editorial review is still needed.");
  });

  it("won't let anyone approve a revision they authored or edited", async () => {
    const editorReviewer = await staff("editor-reviewer", { role: "editor" }, languageReviewerRole);
    const article = await createArticle(editorReviewer, {
      flag: "languageInstruction",
      languageVariety: "standard-fijian",
    });
    await act(editorReviewer, article.id, 1, {
      intent: "assign",
      reviewType: "language",
      reviewerId: editorReviewer.userId,
    });
    await act(editorReviewer, article.id, 1, { intent: "submit" });

    const response = await approve(editorReviewer, article.id, 1, "language");

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("You can&#x27;t review this revision");
    expect(await approvals((await currentRevision(article.id)).id)).toEqual([]);
  });

  it("only lets the assigned reviewer, scoped to the Review Type and Language Variety, decide", async () => {
    const assigned = await staff("lang-reviewer", languageReviewerRole);
    const unassigned = await staff("other-lang-reviewer", languageReviewerRole);
    const { article } = await submittedArticle(
      ["languageInstruction"],
      [{ reviewType: "language", reviewer: assigned }],
    );

    expect((await unassigned.browser.fetch(`/admin/articles/${article.id}/revisions/1`)).status).toBe(403);
    expect((await approve(unassigned, article.id, 1, "language")).status).toBe(403);
    expect((await approve(assigned, article.id, 1, "editorial")).status).toBe(400);
    expect(await approvals((await currentRevision(article.id)).id)).toEqual([]);
  });

  it("refuses to assign someone who doesn't review that Review Type", async () => {
    const cultural = await staff("cultural-reviewer", { role: "reviewer", reviewType: "cultural" });
    const editor = await staff("editor", { role: "editor" });
    const article = await createArticle(editor, { flag: "languageInstruction", languageVariety: "standard-fijian" });

    const response = await act(editor, article.id, 1, {
      intent: "assign",
      reviewType: "language",
      reviewerId: cultural.userId,
    });

    expect(response.status).toBe(400);
  });

  it("needs notes to reject, and a rejection blocks publishing", async () => {
    const reviewer = await staff("lang-reviewer", languageReviewerRole);
    const { editor, article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);

    const bare = await act(reviewer, article.id, 1, { intent: "decide", reviewType: "language", decision: "rejected" });
    await act(reviewer, article.id, 1, {
      intent: "decide",
      reviewType: "language",
      decision: "rejected",
      notes: "The second greeting is Bauan, not Standard Fijian.",
    });
    const publish = await act(editor, article.id, 1, { intent: "publish" });

    expect(bare.status).toBe(400);
    expect(await publish.text()).toContain("Language review (standard-fijian) was rejected.");
    expect(await auditActions(reviewer.userId)).toContain("review.rejected");
  });

  it("takes a Knowledge Holder Approval, recorded by an editor who didn't write the revision", async () => {
    const { editor, article } = await submittedArticle(["sensitiveCultural"]);
    const otherEditor = await staff("other-editor", { role: "editor" });
    const approval = {
      intent: "knowledgeHolder",
      knowledgeHolderName: "Ratu Epeli",
      method: "In person at the village",
      conditions: "Do not show the ceremony's closing words",
    };

    const byAuthor = await act(editor, article.id, 1, approval);
    const byOther = await act(otherEditor, article.id, 1, approval);
    const publish = await act(otherEditor, article.id, 1, { intent: "publish" });

    expect(byAuthor.status).toBe(400);
    expect(byOther.status).toBe(302);
    expect(publish.status).toBe(302);
    expect(await auditActions(otherEditor.userId)).toContain("knowledge_holder_approval.recorded");
    const page = await (await otherEditor.browser.fetch(`/admin/articles/${article.id}/revisions/1`)).text();
    expect(page).toContain("by Ratu Epeli (In person at the village)");
    expect(page).toContain("Conditions: Do not show the ceremony&#x27;s closing words");
  });

  it("publishes an unflagged article once submitted, and never a draft", async () => {
    const editor = await staff("editor", { role: "editor" });
    const article = await createArticle(editor);

    const draft = await act(editor, article.id, 1, { intent: "publish" });
    await act(editor, article.id, 1, { intent: "submit" });
    const submitted = await act(editor, article.id, 1, { intent: "publish" });

    expect(await draft.text()).toContain("It hasn&#x27;t been submitted for review.");
    expect(submitted.status).toBe(302);
  });

  it("moves an article through unpublished → published → withdrawn → archived", async () => {
    const { editor, article } = await submittedArticle([]);

    expect((await act(editor, article.id, 1, { intent: "withdraw" })).status).toBe(400);
    expect((await act(editor, article.id, 1, { intent: "publish" })).status).toBe(302);
    expect((await act(editor, article.id, 1, { intent: "archive" })).status).toBe(400);
    expect((await act(editor, article.id, 1, { intent: "withdraw" })).status).toBe(302);
    expect((await publication(article.id))?.state).toBe("withdrawn");
    expect((await act(editor, article.id, 1, { intent: "archive" })).status).toBe(302);
    expect((await act(editor, article.id, 1, { intent: "publish" })).status).toBe(400);
    expect((await publication(article.id))?.state).toBe("archived");
    expect(await auditActions(editor.userId)).toEqual(
      expect.arrayContaining(["content_item.withdrawn", "content_item.archived"]),
    );
  });

  it("shows each revision's state: draft, submitted, approved, superseded", async () => {
    const reviewer = await staff("lang-reviewer", languageReviewerRole);
    const editor = await staff("editor", { role: "editor" });
    const article = await createArticle(editor, { flag: "languageInstruction", languageVariety: "standard-fijian" });
    await act(editor, article.id, 1, { intent: "assign", reviewType: "language", reviewerId: reviewer.userId });
    const state = async (number: number) => {
      const page = await (await editor.browser.fetch(`/admin/articles/${article.id}/revisions/${number}`)).text();
      return page.match(/<dt>This revision<\/dt><dd>([^<]+)<\/dd>/)?.[1];
    };

    expect(await state(1)).toBe("Draft");
    await act(editor, article.id, 1, { intent: "submit" });
    expect(await state(1)).toBe("Submitted for review");
    await approve(reviewer, article.id, 1, "language");
    expect(await state(1)).toBe("Approved");
    await saveNewRevision(editor, article, { ...languageFlag, summary: "Greetings and farewells." });
    expect(await state(1)).toBe("Superseded by a newer revision");
  });

  it("lists submitted revisions waiting on a reviewer in their queue", async () => {
    const reviewer = await staff("lang-reviewer", languageReviewerRole);
    const { article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);

    const queue = await (await reviewer.browser.fetch("/admin/reviews")).text();
    expect(queue).toContain(`href="/admin/articles/${article.id}/revisions/1"`);

    await approve(reviewer, article.id, 1, "language");
    const after = await (await reviewer.browser.fetch("/admin/reviews")).text();
    expect(after).not.toContain(`href="/admin/articles/${article.id}/revisions/1"`);
  });

  it("requires the Language Variety when language instruction is flagged", async () => {
    const editor = await staff("editor", { role: "editor" });
    const topicId = await topic(editor);

    const response = await post(editor, "/admin/articles/new", articleForm(topicId, { flag: "languageInstruction" }));

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Enter the Language Variety this article teaches.");
  });

  it("refuses, in the database itself, to change a recorded decision", async () => {
    const reviewer = await staff("lang-reviewer", languageReviewerRole);
    const { article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);
    await approve(reviewer, article.id, 1, "language");

    await expect(
      env.DB.prepare("UPDATE review_approval SET decision = 'rejected' WHERE revision_id = ?1")
        .bind((await currentRevision(article.id)).id)
        .run(),
    ).rejects.toThrow(/Review Approvals are immutable/);
  });

  it("keeps a removed flag's review required until a revision without the flag is reviewed", async () => {
    const reviewer = await staff("lang-reviewer", languageReviewerRole);
    const { editor, article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);
    await act(reviewer, article.id, 1, {
      intent: "decide",
      reviewType: "language",
      decision: "rejected",
      notes: "Wrong variety.",
    });

    const unflagged = await saveNewRevision(editor, article, { body: body("Hello.") });
    await act(editor, article.id, unflagged.number, { intent: "submit" });
    const blocked = await act(editor, article.id, unflagged.number, { intent: "publish" });
    expect(blocked.status).toBe(400);
    expect(await blocked.text()).toContain("Language review (standard-fijian) is still needed.");

    await approve(reviewer, article.id, unflagged.number, "language");
    expect((await act(editor, article.id, unflagged.number, { intent: "publish" })).status).toBe(302);
    const next = await saveNewRevision(editor, article, { body: body("Hello again.") });
    await act(editor, article.id, next.number, { intent: "submit" });
    expect((await act(editor, article.id, next.number, { intent: "publish" })).status).toBe(302);
  });

  it("only publishes the latest revision; an earlier one comes back by restoring it", async () => {
    const { editor, article } = await submittedArticle([]);
    await saveNewRevision(editor, article, { summary: "A newer summary." });

    const response = await act(editor, article.id, 1, { intent: "publish" });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Only the latest revision can be published");
  });

  it("carries a restored revision's approvals forward to the revision the restore creates", async () => {
    const reviewer = await staff("lang-reviewer", languageReviewerRole);
    const { editor, article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);
    await approve(reviewer, article.id, 1, "language");
    const first = await currentRevision(article.id);
    const worse = await saveNewRevision(editor, article, { ...languageFlag, body: body("A worse version.") });

    await editor.browser.fetch(`/admin/articles/${article.id}/history`, {
      form: { baseRevisionId: worse.id, revisionId: first.id },
    });

    const restored = await currentRevision(article.id);
    expect(restored.number).toBe(3);
    expect(await approvals(restored.id)).toEqual([
      { reviewType: "language", decision: "approved", carriedFrom: expect.any(String) },
    ]);
  });

  it("keeps a carried approval's original decision date", async () => {
    const reviewer = await staff("lang-reviewer", languageReviewerRole);
    const { editor, article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);
    await approve(reviewer, article.id, 1, "language");
    const next = await saveNewRevision(editor, article, { ...languageFlag, credit: "Words by Mere" });

    const { results } = await env.DB.prepare(
      `SELECT c.decided_at AS carried, o.decided_at AS original
         FROM review_approval c JOIN review_approval o ON o.id = c.carried_forward_from_id WHERE c.revision_id = ?1`,
    )
      .bind(next.id)
      .all<{ carried: number; original: number }>();

    expect(results).toHaveLength(1);
    expect(results[0].carried).toBe(results[0].original);
  });

  it("needs sources for historical claims", async () => {
    const editor = await staff("editor", { role: "editor" });
    const topicId = await topic(editor);

    const missing = await post(
      editor,
      "/admin/articles/new",
      articleForm(topicId, { flag: "historicalClaims", sources: "" }),
    );
    const given = await post(
      editor,
      "/admin/articles/new",
      articleForm(topicId, { flag: "historicalClaims", sources: "Fiji Museum archive, 1874 Deed of Cession" }),
    );

    expect(missing.status).toBe(400);
    expect(await missing.text()).toContain("List the sources for the historical claims.");
    expect(given.status).toBe(302);
  });

  it("won't publish identifiable children until guardian permission can be recorded (#17)", async () => {
    const reviewer = await staff("safeguarding-reviewer", { role: "reviewer", reviewType: "safeguarding" });
    const { editor, article } = await submittedArticle(
      ["identifiableChildren"],
      [{ reviewType: "safeguarding", reviewer }],
    );
    await approve(reviewer, article.id, 1, "safeguarding");

    const response = await act(editor, article.id, 1, { intent: "publish" });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("documented guardian permission");
  });

  it("matches a reviewer's Language Variety however the administrator spelled it", async () => {
    const admin = await staff("admin", { role: "administrator" });
    const reviewer = await staff("lang-reviewer", { role: "editor" });
    const email = (await env.DB.prepare("SELECT email FROM user WHERE id = ?1").bind(reviewer.userId).first<{
      email: string;
    }>()) as { email: string };
    await admin.browser.fetch("/admin/staff", {
      form: {
        intent: "grant",
        email: email.email,
        role: "reviewer",
        reviewType: "language",
        languageVariety: " Standard Fijian ",
      },
    });
    const { editor, article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);

    expect((await approve(reviewer, article.id, 1, "language")).status).toBe(302);
    expect((await act(editor, article.id, 1, { intent: "publish" })).status).toBe(302);
  });

  it("answers a repeated submit or assignment with a message, not an error", async () => {
    const reviewer = await staff("lang-reviewer", languageReviewerRole);
    const { editor, article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);

    expect((await act(editor, article.id, 1, { intent: "submit" })).status).toBe(400);
    expect(
      (await act(editor, article.id, 1, { intent: "assign", reviewType: "language", reviewerId: reviewer.userId }))
        .status,
    ).toBe(400);
  });

  it("refuses a decision for a Review Type the revision doesn't need, and audits refused decisions", async () => {
    const reviewer = await staff("editorial-reviewer", { role: "reviewer", reviewType: "editorial" });
    const { article } = await submittedArticle(["historicalClaims"], [{ reviewType: "editorial", reviewer }]);
    const cultural = await staff("cultural-reviewer", { role: "reviewer", reviewType: "cultural" });

    const unneeded = await act(reviewer, article.id, 1, {
      intent: "decide",
      reviewType: "language",
      decision: "approved",
    });

    expect(unneeded.status).toBe(400);
    expect(await approvals((await currentRevision(article.id)).id)).toEqual([]);
    expect(await auditActions(reviewer.userId)).toContain("review_approval.refused");
    expect(cultural.userId).toBeTruthy();
  });
});
