import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { type Scanner, scanUpload } from "~/lib/scan.server";
import { act, articleForm, post, type Staff, staff, topic } from "./support/articles";
import { completeUpload, sendPart, startUpload } from "./support/media";
import { recordMediaRights, recordRights } from "./support/rights";

const PUBLIC = "https://naisema.test";
const visit = (path: string) => SELF.fetch(`${PUBLIC}${path}`, { redirect: "manual" });
const read = async (path: string) => (await visit(path)).text();
const word = () => `w${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);
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

/** A scanned portrait, with its own Rights Record unless `rights` is false. */
async function portrait(editor: Staff, { rights = true } = {}) {
  const { id } = (await (
    await startUpload(editor.browser, { name: "portrait.png", type: "image/png", size: PNG.length, head: PNG })
  ).json()) as { id: string };
  await sendPart(editor.browser, id, 1, PNG);
  await completeUpload(editor.browser, id);
  await scanUpload(env, getDb(env.DB), id, clean);
  if (rights) expect((await recordMediaRights(editor.browser, id)).status).toBe(302);
  return id;
}

async function created(editor: Staff, path: string, fields: Record<string, string | string[]>) {
  const response = await post(
    editor,
    path,
    articleForm(await topic(editor), { flag: [], languageVariety: "", ...fields }),
  );
  const id = response.headers.get("Location")?.split("/").at(-1);
  if (!id) throw new Error(`Not created (${response.status}): ${await response.text()}`);
  return id;
}

/** Records the item's own rights, submits and publishes revision 1 (no flags, so no reviews). */
async function publish(editor: Staff, id: string, { expect: status = 302 } = {}) {
  await recordRights(editor.browser, id);
  await scanEvidence(id);
  expect((await act(editor, id, 1, { intent: "submit" })).status).toBe(302);
  const published = await act(editor, id, 1, { intent: "publish" });
  expect(published.status, await published.clone().text()).toBe(status);
  return published;
}

async function creatorProfile(editor: Staff, fields: Record<string, string | string[]> = {}) {
  const name = `Litia ${word()}`;
  const sample = await created(editor, "/admin/articles/new", { title: `Sample by ${name}`, primaryArea: "ezine" });
  const id = await created(editor, "/admin/articles/new?type=creator", {
    title: name,
    summary: "Sings and makes short films about home.",
    creatorLocation: "Taveuni",
    creatorLanguages: "Standard Fijian\nEnglish",
    creatorMediaType: ["music", "video"],
    creatorPortraitAssetId: await portrait(editor),
    creatorSampleItemId: sample,
    ...fields,
  });
  return { id, sample, name };
}

async function slugOf(id: string) {
  return (await env.DB.prepare("SELECT slug FROM content_item WHERE id = ?1").bind(id).first<{ slug: string }>())
    ?.slug as string;
}

describe("Creator Profiles (CRE-01)", () => {
  it("show the chosen name, consented portrait, location, languages, media and a free sample", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id, sample, name } = await creatorProfile(editor);
    await publish(editor, sample);
    await publish(editor, id);
    const slug = await slugOf(id);

    const page = await read(`/connect/creators/${slug}`);

    expect(page).toContain(`<h1>${name}</h1>`);
    expect(page).toMatch(/<img class="portrait" src="\/media\/images\/[0-9a-f-]+\/640"/);
    expect(page).toContain("Taveuni");
    expect(page).toContain("Standard Fijian, English");
    expect(page).toContain("Music, Video");
    expect(page).toContain("A free sample of their work");
    expect(page).toContain(`Sample by ${name}`);
    expect((await visit(`/connect/${slug}`)).status).toBe(404);
    expect(await read("/connect/creators")).toContain(name);
    expect(await read("/connect/creators?media=music")).toContain(name);
    expect(await read("/connect/creators?media=writing")).not.toContain(name);
    expect(await read("/sitemap.xml")).toContain(`/connect/creators/${slug}`);
  });

  it("are public only while their free sample is", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id, sample } = await creatorProfile(editor);

    const refused = await publish(editor, id, { expect: 400 });
    expect(await refused.text()).toContain("Its free sample isn&#x27;t published right now.");

    await publish(editor, sample);
    expect((await act(editor, id, 1, { intent: "publish" })).status).toBe(302);
    const slug = await slugOf(id);
    expect((await visit(`/connect/creators/${slug}`)).status).toBe(200);

    await act(editor, sample, 1, { intent: "withdraw" });
    expect((await visit(`/connect/creators/${slug}`)).status).toBe(404);
  });

  it("need the portrait's own Rights Record, the consent of the person shown", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id, sample } = await creatorProfile(editor, {
      creatorPortraitAssetId: await portrait(editor, { rights: false }),
    });
    await publish(editor, sample);

    const refused = await publish(editor, id, { expect: 400 });

    expect(await refused.text()).toContain("The file portrait.png has no current Rights Record granting Publish.");
  });

  it("keep the location general and the sample a real piece of work", async () => {
    const editor = await staff("editor", { role: "editor" });
    const page = await created(editor, "/admin/articles/new?type=page", { page: "partners" });

    const response = await post(
      editor,
      "/admin/articles/new?type=creator",
      articleForm(await topic(editor), {
        flag: [],
        languageVariety: "",
        creatorLocation: "12 Marine Drive, Suva",
        creatorMediaType: ["music"],
        creatorPortraitAssetId: await portrait(editor),
        creatorSampleItemId: page,
      }),
    );
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("Give only a town, island or country, without numbers.");
    expect(text).toContain("Choose an Article, Resource or Episode that shows their work.");
  });
});
