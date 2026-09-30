import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { auditActions, signedInStaff } from "./support/staff";

type Staff = Awaited<ReturnType<typeof signedInStaff>>;

const body = (...paragraphs: string[]) =>
  JSON.stringify({
    type: "doc",
    content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
  });

async function createTopic(editor: Staff, name: string) {
  await editor.browser.fetch("/admin/topics", { form: { name } });
  const row = await env.DB.prepare("SELECT id FROM topic WHERE name = ?1").bind(name).first<{ id: string }>();
  if (!row) throw new Error(`Topic ${name} was not created`);
  return row.id;
}

async function revisions(contentItemId: string) {
  const { results } = await env.DB.prepare(
    "SELECT id, number, snapshot, restored_from_revision_id AS restoredFrom FROM revision WHERE content_item_id = ?1 ORDER BY number",
  )
    .bind(contentItemId)
    .all<{ id: string; number: number; snapshot: string; restoredFrom: string | null }>();
  return results.map((row) => ({ ...row, snapshot: JSON.parse(row.snapshot) }));
}

async function newArticle(editor: Staff, fields: Record<string, string> = {}) {
  const topicId = fields.topicId ?? (await createTopic(editor, `Topic ${crypto.randomUUID()}`));
  const response = await editor.browser.fetch("/admin/articles/new", {
    form: {
      title: "Meke for beginners",
      summary: "The first steps.",
      primaryArea: "ezine",
      credit: "Words by Sera",
      body: body("Stand in a line."),
      ...fields,
      topicId,
    },
  });
  const id = response.headers.get("Location")?.split("/").at(-1);
  if (!id) throw new Error(`Article not created (${response.status})`);
  const [first] = await revisions(id);
  return { id, topicId, firstRevisionId: first.id };
}

function save(editor: Staff, article: { id: string; topicId: string }, baseRevisionId: string, fields = {}) {
  return editor.browser.fetch(`/admin/articles/${article.id}`, {
    form: {
      title: "Meke for beginners",
      summary: "The first steps.",
      credit: "Words by Sera",
      topicId: article.topicId,
      body: body("Stand in a line."),
      baseRevisionId,
      ...fields,
    },
  });
}

describe("articles", () => {
  it("lets an editor create an article, whose first save is Revision 1", async () => {
    const editor = await signedInStaff("article-editor1@naisema.test", [{ role: "editor" }]);
    const topicId = await createTopic(editor, "Kava ceremonies");

    const response = await editor.browser.fetch("/admin/articles/new", {
      form: {
        title: "Welcome to the yaqona",
        summary: "How a sevusevu begins.",
        primaryArea: "ezine",
        topicId,
        credit: "Words by Mere",
        body: body("The first bowl goes to the chief."),
      },
    });

    expect(response.status).toBe(302);
    const itemId = response.headers.get("Location")?.match(/^\/admin\/articles\/([0-9a-f-]{36})$/)?.[1];
    expect(itemId).toBeTruthy();
    const item = await env.DB.prepare("SELECT * FROM content_item WHERE id = ?1").bind(itemId).first();
    expect(item).toMatchObject({ type: "article", slug: "welcome-to-the-yaqona", primary_area: "ezine" });
    const [first] = await revisions(itemId as string);
    expect(first.number).toBe(1);
    expect(item?.current_draft_revision_id).toBe(first.id);
    expect(item?.current_published_revision_id).toBeNull();
    expect(first.snapshot).toEqual({
      title: "Welcome to the yaqona",
      summary: "How a sevusevu begins.",
      credit: "Words by Mere",
      topicIds: [topicId],
      body: JSON.parse(body("The first bowl goes to the chief.")),
    });
    expect(await auditActions(editor.userId)).toEqual(
      expect.arrayContaining(["content_item.created", "revision.saved"]),
    );
  });

  it("appends a new revision on every save and never changes an earlier one", async () => {
    const editor = await signedInStaff("article-editor2@naisema.test", [{ role: "editor" }]);
    const article = await newArticle(editor);

    const response = await save(editor, article, article.firstRevisionId, { body: body("Stand in two lines.") });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(`/admin/articles/${article.id}?saved=2`);
    const [first, second] = await revisions(article.id);
    expect(first.snapshot.body).toEqual(JSON.parse(body("Stand in a line.")));
    expect(second.snapshot.body).toEqual(JSON.parse(body("Stand in two lines.")));
    const item = await env.DB.prepare("SELECT current_draft_revision_id AS draft FROM content_item WHERE id = ?1")
      .bind(article.id)
      .first<{ draft: string }>();
    expect(item?.draft).toBe(second.id);
    const page = await (await editor.browser.fetch(`/admin/articles/${article.id}?saved=2`)).text();
    expect(page).toContain("Saved as revision 2.");
  });

  it("refuses, in the database itself, to change a saved revision", async () => {
    const editor = await signedInStaff("article-editor3@naisema.test", [{ role: "editor" }]);
    const article = await newArticle(editor);

    await expect(
      env.DB.prepare("UPDATE revision SET snapshot = '{}' WHERE id = ?1").bind(article.firstRevisionId).run(),
    ).rejects.toThrow(/Revisions are immutable/);
  });

  it("requires a title, summary, topic and credit, and names each missing field", async () => {
    const editor = await signedInStaff("article-editor4@naisema.test", [{ role: "editor" }]);

    const response = await editor.browser.fetch("/admin/articles/new", {
      form: { title: "", summary: " ", primaryArea: "ezine", credit: "", body: body("Draft") },
    });

    expect(response.status).toBe(400);
    const page = await response.text();
    for (const message of [
      "Enter the title.",
      "Enter the summary.",
      "Choose at least one topic.",
      "Enter the credit.",
    ]) {
      expect(page).toContain(message);
    }
    const created = await env.DB.prepare("SELECT count(*) AS count FROM content_item WHERE created_by = ?1")
      .bind(editor.userId)
      .first<{ count: number }>();
    expect(created?.count).toBe(0);
  });

  it("refuses a body outside the fixed block set and keeps the previous revision current", async () => {
    const editor = await signedInStaff("article-editor5@naisema.test", [{ role: "editor" }]);
    const article = await newArticle(editor);
    const unsafe = JSON.stringify({
      type: "doc",
      content: [{ type: "image", attrs: { src: "https://example.org/a.jpg", alt: "" } }],
    });

    const response = await save(editor, article, article.firstRevisionId, { body: unsafe });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Every image needs alt text describing it.");
    expect(await revisions(article.id)).toHaveLength(1);
  });

  it("refuses a save made from an out-of-date revision instead of overwriting newer work", async () => {
    const editor = await signedInStaff("article-editor6@naisema.test", [{ role: "editor" }]);
    const article = await newArticle(editor);
    await save(editor, article, article.firstRevisionId, { title: "Saved first" });

    const late = await save(editor, article, article.firstRevisionId, { title: "Saved second" });

    expect(late.status).toBe(409);
    const page = await late.text();
    expect(page).toContain("Someone else saved this");
    // Sending the refused form again must be refused again, not saved over the newer revision.
    expect(page).toContain(`name="baseRevisionId" value="${article.firstRevisionId}"`);
    expect((await revisions(article.id)).map((revision) => revision.snapshot.title)).toEqual([
      "Meke for beginners",
      "Saved first",
    ]);
  });

  it("lists every revision in the history and compares two of them", async () => {
    const editor = await signedInStaff("article-editor7@naisema.test", [{ role: "editor" }]);
    const article = await newArticle(editor);
    await save(editor, article, article.firstRevisionId, {
      title: "Meke for everyone",
      body: body("Stand in a line.", "Then clap."),
    });

    const history = await (await editor.browser.fetch(`/admin/articles/${article.id}/history`)).text();
    const compare = await (await editor.browser.fetch(`/admin/articles/${article.id}/compare?from=1&to=2`)).text();

    expect(history).toContain(`href="/admin/articles/${article.id}/revisions/1"`);
    expect(history).toContain(`href="/admin/articles/${article.id}/revisions/2"`);
    expect(history).toContain("article-editor7@naisema.test");
    expect(compare).toContain("<del>Was: <!-- -->Meke for beginners</del>");
    expect(compare).toContain("<ins>Now: <!-- -->Meke for everyone</ins>");
    expect(compare).toContain("Unchanged: <!-- -->The first steps.");
    expect(compare).toContain("<ins>Added: <!-- -->Then clap.</ins>");
  });

  it("restores an earlier revision by saving its content again as a new revision", async () => {
    const editor = await signedInStaff("article-editor8@naisema.test", [{ role: "editor" }]);
    const article = await newArticle(editor);
    await save(editor, article, article.firstRevisionId, { title: "A worse title" });
    const [, second] = await revisions(article.id);

    const response = await editor.browser.fetch(`/admin/articles/${article.id}/history`, {
      form: { baseRevisionId: second.id, revisionId: article.firstRevisionId },
    });

    expect(response.headers.get("Location")).toBe(`/admin/articles/${article.id}?saved=3`);
    const all = await revisions(article.id);
    expect(all.map((revision) => revision.snapshot.title)).toEqual([
      "Meke for beginners",
      "A worse title",
      "Meke for beginners",
    ]);
    expect(all[2].restoredFrom).toBe(article.firstRevisionId);
    expect(await auditActions(editor.userId)).toContain("revision.restored");
    const history = await (await editor.browser.fetch(`/admin/articles/${article.id}/history`)).text();
    expect(history).toContain(" — restored from 1");
  });

  it("renders a revision's body through the allowlist renderer", async () => {
    const editor = await signedInStaff("article-editor9@naisema.test", [{ role: "editor" }]);
    const embedded = await newArticle(editor, { title: "Lovo" });
    const article = await newArticle(editor, {
      body: JSON.stringify({
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Kava" }] },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Drink", marks: [{ type: "bold" }] },
              { type: "text", text: " here", marks: [{ type: "link", attrs: { href: "https://example.org" } }] },
            ],
          },
          { type: "image", attrs: { src: "/media/bowl.jpg", alt: "A tanoa bowl" } },
          { type: "contentItem", attrs: { id: embedded.id } },
          { type: "callout", content: [{ type: "paragraph", content: [{ type: "text", text: "Note" }] }] },
        ],
      }),
    });

    const page = await (await editor.browser.fetch(`/admin/articles/${article.id}/revisions/1`)).text();

    expect(page).toContain(
      '<h2>Kava</h2><p><strong>Drink</strong><a href="https://example.org" rel="noopener noreferrer"> here</a></p>' +
        '<img src="/media/bowl.jpg" alt="A tanoa bowl" loading="lazy"/>' +
        `<aside class="embedded-item"><a href="/admin/articles/${embedded.id}">Lovo</a></aside>` +
        '<aside class="callout"><p>Note</p></aside>',
    );
  });

  it("renders nothing outside the allowlist, even from a stored body that skipped the checks", async () => {
    const editor = await signedInStaff("article-editor10@naisema.test", [{ role: "editor" }]);
    const article = await newArticle(editor);
    const snapshot = {
      title: "Old",
      summary: "s",
      credit: "c",
      topicIds: [article.topicId],
      body: {
        type: "doc",
        content: [
          { type: "html", html: "<script>alert(1)</script>" },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "<b>kept as text</b>" },
              { type: "text", text: " bad link", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
            ],
          },
        ],
      },
    };
    await env.DB.prepare(
      "INSERT INTO revision (id, content_item_id, number, snapshot, created_by, created_at) VALUES (?1, ?2, 2, ?3, 'test', 0)",
    )
      .bind(crypto.randomUUID(), article.id, JSON.stringify(snapshot))
      .run();

    const page = await (await editor.browser.fetch(`/admin/articles/${article.id}/revisions/2`)).text();

    expect(page).not.toContain("<script>alert");
    expect(page).not.toContain("javascript:");
    expect(page).toContain("<p>&lt;b&gt;kept as text&lt;/b&gt;<!-- --> bad link</p>");
  });

  it("gives a second article with the same title its own slug", async () => {
    const editor = await signedInStaff("article-editor11@naisema.test", [{ role: "editor" }]);
    const first = await newArticle(editor, { title: "Tabua" });
    const second = await newArticle(editor, { title: "Tabua" });

    const { results } = await env.DB.prepare("SELECT id, slug FROM content_item WHERE id IN (?1, ?2)")
      .bind(first.id, second.id)
      .all<{ id: string; slug: string }>();

    expect(Object.fromEntries(results.map((row) => [row.id, row.slug]))).toEqual({
      [first.id]: "tabua",
      [second.id]: "tabua-2",
    });
  });

  it("is only for editors", async () => {
    const editor = await signedInStaff("article-editor12@naisema.test", [{ role: "editor" }]);
    const article = await newArticle(editor);
    const administrator = await signedInStaff("article-admin@naisema.test", [{ role: "administrator" }]);
    const educator = await signedInStaff("article-educator@naisema.test", [{ role: "educator" }]);

    for (const other of [administrator, educator]) {
      for (const path of [
        "/admin/articles",
        "/admin/articles/new",
        `/admin/articles/${article.id}`,
        `/admin/articles/${article.id}/history`,
        `/admin/articles/${article.id}/revisions/1`,
        `/admin/articles/${article.id}/compare?from=1&to=1`,
        "/admin/topics",
      ]) {
        expect((await other.browser.fetch(path)).status, path).toBe(403);
      }
      expect((await save(other, article, article.firstRevisionId)).status).toBe(403);
      expect((await other.browser.fetch("/admin/topics", { form: { name: "Sneaky" } })).status).toBe(403);
    }
    expect(await revisions(article.id)).toHaveLength(1);
  });
});
