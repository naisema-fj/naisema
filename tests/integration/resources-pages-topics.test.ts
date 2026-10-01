import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { type Scanner, scanUpload } from "~/lib/scan.server";
import { act, articleForm, post, type Staff, staff, topic } from "./support/articles";
import { completeUpload, sendPart, startUpload } from "./support/media";
import { recordRights } from "./support/rights";

const PUBLIC = "https://naisema.test";
const visit = (path: string, init: RequestInit = {}) => SELF.fetch(`${PUBLIC}${path}`, { redirect: "manual", ...init });
const read = async (path: string) => (await visit(path)).text();
const word = () => `w${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;

const resourceFields = {
  resourceLanguage: "Standard Fijian and English",
  resourceAgeGuidance: "all-ages",
  resourceAccessibility: "Tagged PDF with headings.",
  resourceUsageTerms: "Free to print and share for teaching. Not for sale.",
};

/** Creates an item of any type; `fields` override the defaults, `type` picks Article, Resource or Page. */
async function create(editor: Staff, type: "article" | "resource" | "page", fields: Record<string, string | string[]>) {
  const topicId = (fields.topicId as string) ?? (await topic(editor));
  const response = await post(
    editor,
    `/admin/articles/new${type === "article" ? "" : `?type=${type}`}`,
    articleForm(topicId, { flag: [], languageVariety: "", ...fields }),
  );
  const id = response.headers.get("Location")?.split("/").at(-1);
  if (!id) throw new Error(`Not created (${response.status}): ${await response.text()}`);
  return { id, topicId };
}

/** Records rights, submits and publishes revision 1 (no flags, so no reviews are needed). */
async function publish(editor: Staff, id: string) {
  expect((await recordRights(editor.browser, id)).status).toBe(302);
  await scanEvidence(id);
  expect((await act(editor, id, 1, { intent: "submit" })).status).toBe(302);
  const published = await act(editor, id, 1, { intent: "publish" });
  expect(published.status, await published.clone().text()).toBe(302);
}

const clean: Scanner = async ({ body }) => {
  await body.cancel();
  return { verdict: "clean" };
};

async function scanEvidence(itemId: string) {
  const { results } = await env.DB.prepare(
    "SELECT evidence_asset_id AS assetId FROM rights_record WHERE subject_id = ?1 AND evidence_asset_id IS NOT NULL",
  )
    .bind(itemId)
    .all<{ assetId: string }>();
  for (const { assetId } of results) await scanUpload(env, getDb(env.DB), assetId, clean);
}

/** A PDF in the media library, scanned clean unless `scan` is false. */
async function libraryPdf(editor: Staff, { scan = true } = {}) {
  const bytes = new TextEncoder().encode("%PDF-1.7\nA vocabulary sheet.");
  const { id } = (await (
    await startUpload(editor.browser, { name: "sheet.pdf", type: "application/pdf", size: bytes.length, head: bytes })
  ).json()) as { id: string };
  await sendPart(editor.browser, id, 1, bytes);
  await completeUpload(editor.browser, id);
  if (scan) await scanUpload(env, getDb(env.DB), id, clean);
  return id;
}

async function pathOf(id: string) {
  const row = await env.DB.prepare("SELECT primary_area AS area, slug FROM content_item WHERE id = ?1")
    .bind(id)
    .first<{ area: string; slug: string }>();
  return `/${row?.area}/${row?.slug}`;
}

describe("Pages", () => {
  it("back a footer page once published; until then it says it is being written", async () => {
    const editor = await staff("editor", { role: "editor" });
    expect(await read("/inclusion")).toContain("This page is being written");

    const { id } = await create(editor, "page", {
      page: "inclusion",
      title: "Inclusion at Na iSema",
      summary: "How we work to be usable by everyone.",
    });
    expect(await read("/inclusion")).toContain("This page is being written");
    await publish(editor, id);

    const page = await read("/inclusion");
    expect(page).toContain("<h1>Inclusion at Na iSema</h1>");
    expect(page).toContain("Bula vinaka.");
    expect(page).not.toContain("This page is being written");
    expect(await read("/sitemap.xml")).toContain(`<loc>${PUBLIC}/inclusion</loc>`);
  });

  it("are one per footer page, and stay out of the homepage's recent items", async () => {
    const editor = await staff("editor", { role: "editor" });
    const term = word();
    const { id } = await create(editor, "page", { page: "contact", title: `Contact ${term}` });
    await publish(editor, id);

    const again = await post(
      editor,
      "/admin/articles/new?type=page",
      articleForm(await topic(editor), { page: "contact" }),
    );
    expect(again.status).toBe(400);
    expect(await read("/")).not.toContain(`Contact ${term}`);
    expect(await read(`/search?q=${term}`)).toContain(`Contact ${term}`);
  });

  it("keep their footer address and sit outside the Topics", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id } = await create(editor, "page", { page: "privacy" });

    const moved = await editor.browser.fetch(`/admin/articles/${id}`, { form: { intent: "slug", slug: "secrets" } });

    expect(moved.status).toBe(400);
    expect(await moved.text()).toContain("address is fixed");
    const row = await env.DB.prepare(
      "SELECT r.snapshot FROM content_item c JOIN revision r ON r.id = c.current_draft_revision_id WHERE c.id = ?1",
    )
      .bind(id)
      .first<{ snapshot: string }>();
    expect(JSON.parse(row?.snapshot ?? "{}").topicIds).toEqual([]);
  });
});

describe("Resources", () => {
  it("show a link's destination, last check, language, age guidance and permitted use before it is followed", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id } = await create(editor, "resource", {
      title: "Fijian dictionary online",
      primaryArea: "resources",
      resourceKind: "link",
      resourceUrl: "https://www.example.org/dictionary",
      resourceCheckedOn: "2026-09-30",
      ...resourceFields,
    });
    await publish(editor, id);

    const page = await read(await pathOf(id));

    expect(page).toContain("Before you go");
    expect(page).toContain("example.org, another website");
    expect(page).toContain("30 Sept 2026");
    expect(page).toContain("Standard Fijian and English");
    expect(page).toContain("All ages");
    expect(page).toContain("Free to print and share for teaching. Not for sale.");
    expect(page).toContain('href="https://www.example.org/dictionary"');
    expect(page).toContain("<li>Resource</li>");
  });

  it("let a visitor report a broken link, once a day, and tell the editor", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id } = await create(editor, "resource", {
      primaryArea: "resources",
      resourceKind: "link",
      resourceUrl: "https://example.org/gone",
      resourceCheckedOn: "2026-09-30",
      ...resourceFields,
    });
    await publish(editor, id);
    const report = () =>
      visit(`/resources/${id}/report-link`, {
        method: "POST",
        headers: { "CF-Connecting-IP": "198.51.100.7", Origin: PUBLIC },
      });

    const first = await report();
    await report();

    expect(first.status).toBe(200);
    expect(await first.text()).toContain("An editor will check it.");
    const editPage = await (await editor.browser.fetch(`/admin/articles/${id}`)).text();
    expect(editPage).toContain("reported this link broken 1 time since you last checked it");
  });

  it("offer a scanned file with its type and size, and count each download", async () => {
    const editor = await staff("editor", { role: "editor" });
    const assetId = await libraryPdf(editor);
    const { id } = await create(editor, "resource", {
      primaryArea: "resources",
      resourceKind: "file",
      resourceAssetId: assetId,
      ...resourceFields,
    });
    await publish(editor, id);

    const page = await read(await pathOf(id));
    expect(page).toContain("Before you download");
    expect(page).toContain("Download (PDF, 1 KB)");

    const download = await visit(`/resources/${id}/download`);
    expect(download.status).toBe(200);
    expect(download.headers.get("Content-Disposition")).toBe('attachment; filename="sheet.pdf"');
    expect(download.headers.get("Cache-Control")).toBe("no-store");
    expect(await download.text()).toContain("A vocabulary sheet.");
  });

  it("stop offering the file once the Resource is withdrawn", async () => {
    const editor = await staff("editor", { role: "editor" });
    const assetId = await libraryPdf(editor);
    const { id } = await create(editor, "resource", {
      primaryArea: "resources",
      resourceKind: "file",
      resourceAssetId: assetId,
      ...resourceFields,
    });
    await publish(editor, id);
    expect((await visit(`/resources/${id}/download`)).status).toBe(200);

    await act(editor, id, 1, { intent: "withdraw" });

    expect((await visit(`/resources/${id}/download`)).status).toBe(404);
  });

  it("can't offer a file that hasn't passed its virus scan", async () => {
    const editor = await staff("editor", { role: "editor" });
    const assetId = await libraryPdf(editor, { scan: false });

    const response = await post(
      editor,
      "/admin/articles/new?type=resource",
      articleForm(await topic(editor), {
        primaryArea: "resources",
        resourceKind: "file",
        resourceAssetId: assetId,
        ...resourceFields,
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("passed its virus scan");
  });
});

describe("Topic pages", () => {
  it("show the description, the lead feature first, and the Topic's items, narrowed by subtopic", async () => {
    const editor = await staff("editor", { role: "editor" });
    const term = word();
    const broad = await topic(editor);
    const sub = await topic(editor);
    const { id: lead } = await create(editor, "article", { topicId: broad, title: `Lead ${term}` });
    const { id: inSub } = await create(editor, "article", { topicId: sub, title: `Sub item ${term}` });
    await publish(editor, lead);
    await publish(editor, inSub);
    const slugs = await env.DB.prepare("SELECT id, slug FROM topic WHERE id IN (?1, ?2)")
      .bind(broad, sub)
      .all<{ id: string; slug: string }>();
    const slugOf = (id: string) => slugs.results.find((row) => row.id === id)?.slug as string;

    await editor.browser.fetch("/admin/topics", {
      form: {
        intent: "update",
        topicId: broad,
        description: `All about ${term}.`,
        parentTopicId: "",
        leadItemId: lead,
      },
    });
    await editor.browser.fetch("/admin/topics", {
      form: { intent: "update", topicId: sub, description: "", parentTopicId: broad, leadItemId: "" },
    });

    const whole = await read(`/topics/${slugOf(broad)}`);
    expect(whole).toContain(`All about ${term}.`);
    expect(whole.indexOf(`Lead ${term}`)).toBeLessThan(whole.indexOf(`Sub item ${term}`));
    expect(whole).toContain(`href="/topics/${slugOf(broad)}/${slugOf(sub)}"`);

    const narrowed = await read(`/topics/${slugOf(broad)}/${slugOf(sub)}`);
    expect(narrowed).toContain(`Sub item ${term}`);
    expect(narrowed).not.toContain(`Lead ${term}`);

    expect(await read("/topics")).toContain(`href="/topics/${slugOf(broad)}"`);
    expect((await visit("/topics/no-such-topic")).status).toBe(404);
    expect((await visit(`/topics/${slugOf(broad)}/no-such-subtopic`)).status).toBe(404);
  });

  it("refuse a subtopic of a subtopic", async () => {
    const editor = await staff("editor", { role: "editor" });
    const [top, middle, bottom] = [await topic(editor), await topic(editor), await topic(editor)];
    await editor.browser.fetch("/admin/topics", {
      form: { intent: "update", topicId: middle, description: "", parentTopicId: top, leadItemId: "" },
    });

    const response = await editor.browser.fetch("/admin/topics", {
      form: { intent: "update", topicId: bottom, description: "", parentTopicId: middle, leadItemId: "" },
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("is itself a subtopic");
  });
});

describe("related items and views", () => {
  it("show the related items chosen for an item, only once they are public", async () => {
    const editor = await staff("editor", { role: "editor" });
    const term = word();
    const { id: shown } = await create(editor, "article", { title: `Published ${term}` });
    const { id: hidden } = await create(editor, "article", { title: `Draft ${term}` });
    await publish(editor, shown);
    const { id } = await create(editor, "article", { title: `Main ${term}`, relatedId: [shown, hidden] });
    await publish(editor, id);

    const page = await read(await pathOf(id));

    expect(page).toContain("Related");
    expect(page).toContain(`Published ${term}`);
    expect(page).not.toContain(`Draft ${term}`);
    expect(page).toContain(`src="/e/opened/${id}"`);
  });

  it("count a view without caching it", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id } = await create(editor, "article", {});
    await publish(editor, id);

    const response = await visit(`/e/opened/${id}`);

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
