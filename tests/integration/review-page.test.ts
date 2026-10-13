import { describe, expect, it } from "vitest";
import { act, approve, createArticle, languageReviewerRole, staff, submittedArticle } from "./support/articles";

// React puts a comment between text and the values inside it; the reader never sees them.
const plain = (html: string) => html.replaceAll("<!-- -->", "");

const revisionPage = async (who: Awaited<ReturnType<typeof staff>>, articleId: string, number = 1) =>
  plain(await (await who.browser.fetch(`/admin/articles/${articleId}/revisions/${number}`)).text());

describe("the review and publishing page (BO-03)", () => {
  it("lists what is missing before publishing near the top, with the action beside each item", async () => {
    const { editor, article } = await submittedArticle(["languageInstruction"]);

    const page = await revisionPage(editor, article.id);

    const missing = page.indexOf("can be published</h3>");
    expect(missing).toBeGreaterThan(-1);
    expect(missing).toBeLessThan(page.indexOf("Required reviews"));
    expect(page).toMatch(
      /Language review \(standard-fijian\) is still needed\.\s*<a href="#assign-form-language">Assign a reviewer<\/a>/,
    );
    expect(page).toContain("<strong>Not ready to publish</strong>");
    expect(page).toContain('id="assign-form-language"');
  });

  it("points an unsubmitted revision at its submit button, and says when it is ready", async () => {
    const { editor, article } = await submittedArticle([]);
    const ready = await revisionPage(editor, article.id);
    expect(ready).toContain("<strong>Ready to publish</strong>");
    expect(ready).not.toContain("can be published</h3>");

    const draft = await staff("draft-editor", { role: "editor" });
    const fresh = await createArticle(draft, { flag: "languageInstruction", languageVariety: "standard-fijian" });
    const page = await revisionPage(draft, fresh.id);
    expect(page).toMatch(
      /hasn(?:'|&#x27;)t been submitted for review\.\s*<a href="#submit-revision">Submit revision 1 for review/,
    );
    expect(page).toContain('id="submit-revision"');
  });

  it("states each required review in words with a symbol, not by colour alone", async () => {
    const reviewer = await staff("lang-reviewer", languageReviewerRole);
    const { editor, article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);

    const waiting = await revisionPage(editor, article.id);
    expect(waiting).toMatch(/status-awaiting"><span aria-hidden="true">…<\/span> Waiting for review/);

    await approve(reviewer, article.id, 1, "language");
    const approved = await revisionPage(editor, article.id);
    expect(approved).toMatch(/status-approved"><span aria-hidden="true">✓<\/span> Approved/);
    expect(approved).toContain("<strong>Ready to publish</strong>");
  });

  it("shows a refused decision inside the form it came from, and moves the reader to it", async () => {
    const reviewer = await staff("lang-reviewer", languageReviewerRole);
    const { article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);

    const refused = await act(reviewer, article.id, 1, {
      intent: "decide",
      reviewType: "language",
      decision: "rejected",
    });
    const page = plain(await refused.text());

    expect(refused.status).toBe(400);
    const form = page.slice(page.indexOf('id="decide-language"'));
    expect(form.indexOf('role="alert"')).toBeGreaterThan(-1);
    expect(form.indexOf('role="alert"')).toBeLessThan(form.indexOf("Record decision"));
    expect(page.match(/role="alert"/g)).toHaveLength(1);
    expect(page).toContain("autofocus");
  });

  it("sends a saved action back to its confirmation, which takes the focus", async () => {
    const { editor, article } = await submittedArticle([]);

    const published = await act(editor, article.id, 1, { intent: "publish" });

    expect(published.status).toBe(302);
    expect(published.headers.get("location")).toMatch(/\?done=publish#outcome$/);
    const page = plain(
      await (await editor.browser.fetch(`/admin/articles/${article.id}/revisions/1?done=publish`)).text(),
    );
    expect(page).toMatch(/<p role="status" id="outcome" tabindex="-1">Published\.<\/p>/);
  });

  it("lists a reviewer's queue as a table, naming the item, its kind and the review wanted", async () => {
    const reviewer = await staff("lang-reviewer", languageReviewerRole);
    const { article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);

    const queue = plain(await (await reviewer.browser.fetch("/admin/reviews")).text());

    expect(queue).toContain("One revision is waiting for your review.");
    expect(queue).toMatch(
      new RegExp(
        `<th scope="row"><a href="/admin/articles/${article.id}/revisions/1">[^<]+</a></th><td>Content Item</td><td>Revision 1</td><td>Language review</td>`,
      ),
    );
  });
});
