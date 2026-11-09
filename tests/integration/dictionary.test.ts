import { env, SELF } from "cloudflare:test";
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

const PUBLIC = "https://naisema.test";
const visit = (path: string) => SELF.fetch(`${PUBLIC}${path}`);

/** A small data file whose entries cite their own sources, so tests don't share state. */
const reviewFile = (prefix: string, meaning: string) => {
  const form = new FormData();
  form.set(
    "file",
    new File(
      [
        `window.FIJIAN_DATA = ${JSON.stringify({
          schema: 1,
          generated: "2026-11-06",
          entries: [
            {
              id: `${prefix}-word`,
              fijian: `${prefix}vale`,
              englishPos: "noun",
              meaning,
              sources: [{ id: `${prefix}-src` }],
            },
            { id: `${prefix}-own`, fijian: `${prefix}lako`, englishPos: "verb", meaning: "To go." },
            { id: `${prefix}-culture`, fijian: `${prefix}sevusevu`, englishPos: "cultural term", meaning: "A gift." },
          ],
          sources: [{ id: `${prefix}-src`, name: `${prefix} word list` }],
        })};`,
      ],
      "data.js",
    ),
  );
  return form;
};

const LANGUAGE_REVIEWER = { role: "reviewer", reviewType: "language", languageVariety: "standard-fijian" } as const;

describe("the public Vosa dictionary", () => {
  it("shows an entry only once it is approved as it stands and its sources are cleared", async () => {
    const editor = await signedInStaff("dict-pub-editor@naisema.test", [{ role: "editor" }]);
    const reviewer = await signedInStaff("dict-pub-reviewer@naisema.test", [LANGUAGE_REVIEWER]);
    await editor.browser.fetch("/admin/dictionary", { multipart: reviewFile("pub", "A house.") });

    expect((await visit("/learn/dictionary/pub-word")).status).toBe(404);
    expect((await reviewer.browser.fetch("/admin/dictionary/pub-word", { form: { intent: "approve" } })).status).toBe(
      302,
    );
    // Approved, but its source isn't cleared yet.
    expect((await visit("/learn/dictionary/pub-word")).status).toBe(404);
    // An entry that cites no source is public as soon as it is approved.
    await reviewer.browser.fetch("/admin/dictionary/pub-own", { form: { intent: "approve" } });
    expect((await visit("/learn/dictionary/pub-own")).status).toBe(200);

    await editor.browser.fetch("/admin/dictionary/sources", {
      form: { intent: "clear", source: "pub-src", note: "The team's own word list." },
    });
    const page = await visit("/learn/dictionary/pub-word");
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("A house.");
    expect(html).toContain("Reviewed for language (Standard Fijian)");
    expect(html).toContain("pub word list");
    expect(await (await visit("/learn/dictionary?q=pubvale")).text()).toContain("/learn/dictionary/pub-word");

    // A changed import takes it down until it is reviewed again.
    await editor.browser.fetch("/admin/dictionary", { multipart: reviewFile("pub", "A big house.") });
    expect((await visit("/learn/dictionary/pub-word")).status).toBe(404);
    expect((await visit("/learn/dictionary/pub-own")).status).toBe(200);
    expect(await auditActions(reviewer.userId)).toContain("dictionary.approved");
  });

  it("keeps a cultural term private even when approved, and lets nobody approve what they imported", async () => {
    const both = await signedInStaff("dict-pub-both@naisema.test", [{ role: "editor" }, LANGUAGE_REVIEWER]);
    const reviewer = await signedInStaff("dict-pub-reviewer2@naisema.test", [LANGUAGE_REVIEWER]);
    await both.browser.fetch("/admin/dictionary", { multipart: reviewFile("cult", "A house.") });

    expect((await both.browser.fetch("/admin/dictionary/cult-own", { form: { intent: "approve" } })).status).toBe(403);
    await reviewer.browser.fetch("/admin/dictionary/cult-culture", { form: { intent: "approve" } });
    expect((await visit("/learn/dictionary/cult-culture")).status).toBe(404);
    expect(await (await reviewer.browser.fetch("/admin/dictionary/cult-culture")).text()).toContain("a cultural term");
  });

  it("lets only editors clear a source", async () => {
    const reviewer = await signedInStaff("dict-pub-reviewer3@naisema.test", [LANGUAGE_REVIEWER]);
    const refused = await reviewer.browser.fetch("/admin/dictionary/sources", {
      form: { intent: "clear", source: "pub-src", note: "Mine." },
    });
    expect(refused.status).toBe(403);
  });
});

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
    expect(html).toContain("Needs language review");
    expect(html).toContain("Not public.");
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
