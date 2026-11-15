import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

/** The Fijian apps' pages and the forms they send to (docs/decision-log.md, "The Fijian apps join NAISEMA"). */

const PUBLIC = "http://localhost";
const visit = (path: string, init: RequestInit = {}) => SELF.fetch(`${PUBLIC}${path}`, { redirect: "manual", ...init });

const APP_PAGES = [
  "/apps/dictionary/",
  "/apps/dictionary/pronunciation/",
  "/apps/lessons/",
  "/apps/lessons/body-parts/",
  "/apps/vale-vakaviti/",
  "/apps/waqa-vakaviti/",
  "/apps/translation/",
];

const scriptPolicy = (response: Response) =>
  /script-src ([^;]*)/.exec(response.headers.get("Content-Security-Policy") ?? "")?.[1];

describe("the Fijian apps' pages", () => {
  it("run their own script files from this site, and never an inline script", async () => {
    for (const path of APP_PAGES) {
      const response = await visit(path);
      expect(response.status, path).toBe(200);
      const html = await response.text();
      expect(scriptPolicy(response), path).toMatch(/^'self'( https:\/\/challenges\.cloudflare\.com)?$/);
      expect(html, path).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
      expect(html, path).toContain('class="app-switcher"');
      expect(html, path).toContain('id="main"');
    }
  });

  it("load Turnstile only where a form sends something", async () => {
    expect(scriptPolicy(await visit("/apps/dictionary/"))).toContain("challenges.cloudflare.com");
    expect(scriptPolicy(await visit("/apps/translation/"))).toBe("'self'");
  });

  it("are found at the addresses the apps site used, with their closing slash", async () => {
    const redirected = await visit("/apps/lessons/body-parts?from=menu");
    expect(redirected.status).toBe(301);
    expect(redirected.headers.get("Location")).toBe("/apps/lessons/body-parts/?from=menu");
    expect((await visit("/apps/not-an-app/")).status).toBe(404);
  });

  it("keep the apps site's browser-only word editor off the public dictionary", async () => {
    const html = await (await visit("/apps/dictionary/")).text();
    for (const id of ["edit-dialog", "proverb-dialog", "import-button", "export-button", "add-button"]) {
      expect(html).not.toContain(`id="${id}"`);
    }
    expect(html).toContain('action="/forms/icavuti"');
  });

  it("ask for corrections through NAISEMA's form, which knows the page", async () => {
    const html = await (await visit("/apps/waqa-vakaviti/")).text();
    expect(html).toContain('href="/forms/page-correction?page=%2Fapps%2Fwaqa-vakaviti%2F"');
  });

  it("are listed on the apps' home, whose suggestion form sends to the team", async () => {
    const html = await (await visit("/apps")).text();
    for (const path of ["/apps/dictionary/", "/apps/lessons/", "/apps/translation/"]) expect(html).toContain(path);
    expect(html).toContain('action="/forms/suggest-word"');
  });
});

describe("the forms the apps send to", () => {
  const send = (form: string, fields: Record<string, string>) =>
    visit(`/forms/${form}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "CF-Connecting-IP": `10.2.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
      },
      body: new URLSearchParams({ "cf-turnstile-response": "test-token", notice: "2026-11-v1", ...fields }),
    });

  it("fill in the form's own fields from the link that opened it", async () => {
    const html = await (await visit("/forms/correct-word?word=Baca&notice=2026-11-v1&email=x%40example.org")).text();
    expect(html).toMatch(/name="word"[^>]*value="Baca"/);
    // Only the form's own fields: never the notice or a contact address.
    expect(html).toContain('name="email" value=""');
    expect(html).not.toMatch(/name="notice"[^>]*checked/);
  });

  it("store an icavuti and a page correction as Submissions", async () => {
    expect((await send("icavuti", { scope: "koro", province: "Ba", title: "A title" })).status).toBe(400);
    const sent = await send("icavuti", {
      scope: "koro",
      province: "Ba",
      district: "Nadi",
      title: "A title",
      villages: "Narewa",
      community: "Yavusa: one",
    });
    expect(sent.status).toBe(200);
    const correction = await send("page-correction", {
      page: "/apps/vale-vakaviti/",
      topic: "The bou",
      message: "The bou is the main post.",
    });
    expect(correction.status).toBe(200);
    const rows = await env.DB.prepare(
      "SELECT form, fields FROM submission WHERE form IN ('icavuti', 'page-correction') ORDER BY form",
    ).all<{ form: string; fields: string }>();
    expect(rows.results.map((row) => [row.form, JSON.parse(row.fields)])).toEqual([
      [
        "icavuti",
        {
          scope: "koro",
          province: "Ba",
          district: "Nadi",
          title: "A title",
          villages: "Narewa",
          community: "Yavusa: one",
        },
      ],
      ["page-correction", { page: "/apps/vale-vakaviti/", topic: "The bou", message: "The bou is the main post." }],
    ]);
  });
});
