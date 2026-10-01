import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { sendExpiryWarnings } from "~/lib/rights-expiry.server";
import { type Scanner, scanUpload } from "~/lib/scan.server";
import { act, articleForm, post, type Staff, staff, topic } from "./support/articles";
import { completeUpload, sendPart, startUpload } from "./support/media";
import { recordMediaRights, recordRights } from "./support/rights";
import { emailsTo } from "./support/staff";

const PUBLIC = "https://naisema.test";
const visit = (path: string) => SELF.fetch(`${PUBLIC}${path}`, { redirect: "manual" });
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);

const clean: Scanner = async ({ body: stream }) => {
  await stream.cancel();
  return { verdict: "clean" };
};

async function scannedImage(editor: Staff, name = "harbour.png") {
  const { id } = (await (
    await startUpload(editor.browser, { name, type: "image/png", size: PNG.length, head: PNG })
  ).json()) as { id: string };
  await sendPart(editor.browser, id, 1, PNG);
  await completeUpload(editor.browser, id);
  await scanUpload(env, getDb(env.DB), id, clean);
  return id;
}

/** An Article whose body shows a media library image, with its own Rights Record, submitted. */
async function articleShowing(editor: Staff, imageId: string) {
  const image = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Levuka at dawn." }] },
      { type: "image", attrs: { src: `${PUBLIC}/media/images/${imageId}/960`, alt: "Boats in Levuka harbour" } },
    ],
  };
  const response = await post(
    editor,
    "/admin/articles/new",
    articleForm(await topic(editor), { flag: [], languageVariety: "", body: JSON.stringify(image) }),
  );
  const id = response.headers.get("Location")?.split("/").at(-1) as string;
  expect((await recordRights(editor.browser, id)).status).toBe(302);
  expect((await act(editor, id, 1, { intent: "submit" })).status).toBe(302);
  return id;
}

async function pathOf(id: string) {
  const row = await env.DB.prepare("SELECT primary_area AS area, slug FROM content_item WHERE id = ?1")
    .bind(id)
    .first<{ area: string; slug: string }>();
  return `/${row?.area}/${row?.slug}`;
}

describe("Rights Records for media library files (#17)", () => {
  it("are needed for every file an item uses; the item's own record doesn't cover them", async () => {
    const editor = await staff("editor", { role: "editor" });
    const imageId = await scannedImage(editor);
    const id = await articleShowing(editor, imageId);

    const refused = await act(editor, id, 1, { intent: "publish" });
    expect(refused.status).toBe(400);
    expect(await refused.text()).toContain("The file harbour.png has no current Rights Record granting Publish.");

    expect((await recordMediaRights(editor.browser, imageId, { rightsHolder: "Mere Vula" })).status).toBe(302);
    const published = await act(editor, id, 1, { intent: "publish" });

    expect(published.status, await published.clone().text()).toBe(302);
    expect((await visit(await pathOf(id))).status).toBe(200);
    expect((await visit(`/media/images/${imageId}/960`)).status).toBe(200);
  });

  it("take down every item using the file the moment the file's record is withdrawn", async () => {
    const editor = await staff("editor", { role: "editor" });
    const imageId = await scannedImage(editor);
    const id = await articleShowing(editor, imageId);
    await recordMediaRights(editor.browser, imageId);
    expect((await act(editor, id, 1, { intent: "publish" })).status).toBe(302);
    const record = await env.DB.prepare("SELECT id FROM rights_record WHERE subject_id = ?1")
      .bind(imageId)
      .first<{ id: string }>();

    const withdrawn = await editor.browser.fetch(`/admin/media/${imageId}/rights`, {
      form: { intent: "withdraw", recordId: record?.id as string, reason: "The photographer withdrew permission." },
    });

    expect(withdrawn.status).toBe(302);
    expect((await visit(await pathOf(id))).status).toBe(404);
    expect((await visit(`/media/images/${imageId}/960`)).status).toBe(404);
    const page = await (await editor.browser.fetch(`/admin/media/${imageId}/rights`)).text();
    expect(page).toContain("The photographer withdrew permission.");
  });

  it("are managed by editors; Educators upload but can't record rights", async () => {
    const editor = await staff("editor", { role: "editor" });
    const educator = await staff("educator", { role: "educator" });
    const imageId = await scannedImage(editor);

    expect((await editor.browser.fetch(`/admin/media/${imageId}/rights`)).status).toBe(200);
    expect((await educator.browser.fetch(`/admin/media/${imageId}/rights`)).status).toBe(403);
    expect((await editor.browser.fetch(`/admin/media/${crypto.randomUUID()}/rights`)).status).toBe(404);
    const library = await (await editor.browser.fetch("/admin/media")).text();
    expect(library).toContain(`/admin/media/${imageId}/rights`);
  });

  it("are included in the daily expiry warnings, naming the file and its rights page", async () => {
    const editor = await staff("editor", { role: "editor" });
    const name = `canoe-${crypto.randomUUID().slice(0, 8)}.png`;
    const imageId = await scannedImage(editor, name);
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO rights_record (id, subject_type, subject_id, rights_holder, permitted_uses, guardian_permission,
         evidence_key, evidence_name, evidence_type, expires_at, created_by, created_at)
       VALUES (?1, 'media_asset', ?2, 'Ana', '["publish"]', 0, 'rights/test', 'p.pdf', 'application/pdf', ?3, ?4, ?5)`,
    )
      .bind(crypto.randomUUID(), imageId, now + 20 * 86_400_000, editor.userId, now)
      .run();
    const address = (
      (await env.DB.prepare("SELECT email FROM user WHERE id = ?1").bind(editor.userId).first<{ email: string }>()) as {
        email: string;
      }
    ).email;

    await sendExpiryWarnings(env, new Date(now));

    const warning = (await emailsTo(address)).find((email) => email.subject.startsWith("Rights Records expiring"));
    expect(warning?.text).toContain(`The file ${name}`);
    expect(warning?.text).toContain(`http://admin.localhost/admin/media/${imageId}/rights`);
  });
});
