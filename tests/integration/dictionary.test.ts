import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { auditActions, signedInStaff } from "./support/staff";

const dataFile = (meaning: string) =>
  new File(
    [
      `window.FIJIAN_DATA = ${JSON.stringify({
        schema: 1,
        generated: "2026-11-06",
        entries: [
          {
            id: "vosa-test-baca",
            fijian: "Baca",
            englishPos: "noun",
            meaning,
            status: "needs review",
            sources: [{ id: "vosa-test-source" }],
          },
        ],
        proverbs: [{ id: "vosa-test-saying", fijian: "qalova uaua na moka", meaning: "Too soon.", status: "reviewed" }],
        sources: [{ id: "vosa-test-source", name: "A historical word list", type: "pdf" }],
      })};`,
    ],
    "data.js",
    { type: "application/javascript" },
  );

const upload = (meaning: string) => {
  const form = new FormData();
  form.set("file", dataFile(meaning));
  return form;
};

const rows = async <T>(sql: string, ...values: unknown[]) =>
  (
    await env.DB.prepare(sql)
      .bind(...values)
      .all<T>()
  ).results;

describe("the Vosa dictionary drafts", () => {
  it("import as drafts that need review, refresh on a second import, and never become Expressions", async () => {
    const editor = await signedInStaff("dictionary-editor@naisema.test", [{ role: "editor" }]);

    const first = await editor.browser.fetch("/admin/dictionary", { multipart: upload("Bait.") });
    expect(first.status).toBe(200);
    expect(await first.text()).toContain("Imported 1 word, 1 saying and 1 source as drafts.");

    await editor.browser.fetch("/admin/dictionary", { multipart: upload("Bait for a fishhook.") });
    const stored = await rows<{ meaning: string; review_state: string; kind: string }>(
      "SELECT meaning, review_state, kind FROM dictionary_entry WHERE id LIKE 'vosa-test-%' ORDER BY id",
    );
    expect(stored).toEqual([
      { meaning: "Bait for a fishhook.", review_state: "needs_review", kind: "word" },
      { meaning: "Too soon.", review_state: "needs_review", kind: "saying" },
    ]);
    expect(await rows("SELECT id FROM expression WHERE headword = 'Baca'")).toEqual([]);
    expect(await auditActions(editor.userId)).toContain("dictionary.imported");

    const entry = await editor.browser.fetch("/admin/dictionary/vosa-test-baca");
    const html = await entry.text();
    expect(html).toContain("needs review. Not public.");
    expect(html).toContain("A historical word list");

    const sources = await (await editor.browser.fetch("/admin/dictionary/sources")).text();
    expect(sources).toContain("A historical word list");
  });

  it("import a file the size of the real dictionary in one go", async () => {
    const editor = await signedInStaff("dictionary-editor3@naisema.test", [{ role: "editor" }]);
    const entries = Array.from({ length: 1600 }, (_, n) => ({
      id: `vosa-bulk-${n}`,
      fijian: `vosa ${n}`,
      englishPos: "noun",
      meaning: `Meaning ${n}.`,
      themes: ["animals"],
      sources: [{ id: `vosa-bulk-source-${n % 230}` }],
    }));
    const sources = Array.from({ length: 230 }, (_, n) => ({ id: `vosa-bulk-source-${n}`, name: `Source ${n}` }));
    const form = new FormData();
    form.set(
      "file",
      new File(
        [`window.FIJIAN_DATA = ${JSON.stringify({ schema: 1, generated: "2026-11-06", entries, sources })};`],
        "data.js",
      ),
    );

    const response = await editor.browser.fetch("/admin/dictionary", { multipart: form });
    expect(await response.text()).toContain("Imported 1600 words, 0 sayings and 230 sources as drafts.");
    const [{ total }] = await rows<{ total: number }>(
      "SELECT count(*) AS total FROM dictionary_entry WHERE id LIKE 'vosa-bulk-%'",
    );
    expect(total).toBe(1600);
  });

  it("let an Educator read the drafts but not import", async () => {
    const educator = await signedInStaff("dictionary-educator@naisema.test", [{ role: "educator" }]);

    const list = await educator.browser.fetch("/admin/dictionary");
    expect(list.status).toBe(200);
    expect(await list.text()).not.toContain("Import as drafts");
    const refused = await educator.browser.fetch("/admin/dictionary", { multipart: upload("Bait.") });
    expect(refused.status).toBe(403);
  });

  it("refuse a file that isn't the Vosa data", async () => {
    const editor = await signedInStaff("dictionary-editor2@naisema.test", [{ role: "editor" }]);
    const form = new FormData();
    form.set("file", new File(["not the dictionary"], "notes.txt"));

    const refused = await editor.browser.fetch("/admin/dictionary", { multipart: form });
    expect(refused.status).toBe(400);
    expect(await refused.text()).toContain("isn&#x27;t the Vosa dictionary");
  });
});
