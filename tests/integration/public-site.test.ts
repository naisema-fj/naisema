import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { publicCacheKey } from "~/lib/public-cache.server";
import {
  act,
  approve,
  body,
  languageFlag,
  languageReviewerRole,
  saveNewRevision,
  staff,
  submittedArticle,
} from "./support/articles";

const PUBLIC = "https://naisema.test";
const visit = (path: string) => SELF.fetch(`${PUBLIC}${path}`, { redirect: "manual" });

async function itemPath(articleId: string) {
  const row = await env.DB.prepare("SELECT primary_area AS area, slug FROM content_item WHERE id = ?1")
    .bind(articleId)
    .first<{ area: string; slug: string }>();
  return `/${row?.area}/${row?.slug}`;
}

/** A language-flagged article, approved and published, as a visitor would find it. */
async function publishedLanguageArticle() {
  const reviewer = await staff("lang-reviewer", languageReviewerRole);
  const { editor, article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);
  await approve(reviewer, article.id, 1, "language");
  expect((await act(editor, article.id, 1, { intent: "publish" })).status).toBe(302);
  return { editor, reviewer, article, path: await itemPath(article.id) };
}

describe("public site shell", () => {
  it("offers the six areas, the footer links and the welcome on the homepage", async () => {
    const response = await visit("/");
    const page = await response.text();

    expect(response.status).toBe(200);
    for (const area of ["Learn", "Voices", "Discover", "Connect", "E-zine", "Resources"]) {
      expect(page).toContain(`>${area}</a>`);
    }
    for (const link of ["About", "Inclusion", "Partners", "Contact", "Privacy", "Community standards"]) {
      expect(page).toContain(`>${link}</a>`);
    }
    expect(page).toContain("Bula vinaka");
    expect(page.toLowerCase()).not.toContain("verified");
  });

  it("says plainly which services aren't open yet", async () => {
    const learn = await (await visit("/learn")).text();
    const home = await (await visit("/")).text();

    expect(learn).toContain("Video lessons with captions, word meanings and practice open with the first lessons");
    expect(home).toContain("The newsletter isn&#x27;t open yet.");
  });

  it("answers unknown areas and pages with 404", async () => {
    expect((await visit("/nowhere")).status).toBe(404);
    expect((await visit("/learn/no-such-article")).status).toBe(404);
  });

  it("ships no client JavaScript and allows none on public pages", async () => {
    const response = await visit("/");

    expect(response.headers.get("Content-Security-Policy")).toContain("script-src 'none'");
    expect(await response.text()).not.toContain("<script");
  });

  it("keys cached pages by the deployed version, so a deploy never serves pages built for old assets", () => {
    const deployed = (id: string) => ({ ...env, CF_VERSION_METADATA: { id, tag: "", timestamp: "" } });

    expect(publicCacheKey(deployed("v1"), `${PUBLIC}/`)).not.toBe(publicCacheKey(deployed("v2"), `${PUBLIC}/`));
    expect(publicCacheKey(deployed("v1"), `${PUBLIC}/learn`)).toBe(publicCacheKey(deployed("v1"), `${PUBLIC}/learn`));
  });

  it("keeps non-production sites out of search engines", async () => {
    const robots = await visit("/robots.txt");

    expect(await robots.text()).toContain("Disallow: /");
    expect((await visit("/")).headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
});

describe("a published article", () => {
  it("shows its title, summary, credit, dates, format, topics and Review Labels from real approvals", async () => {
    const { path } = await publishedLanguageArticle();

    const response = await visit(path);
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(page).toContain("<h1>Vosa vakaviti</h1>");
    expect(page).toContain("Greetings.");
    expect(page).toContain("Words by Sera");
    expect(page).toMatch(/Published <time datetime="\d{4}-\d{2}-\d{2}">/i);
    expect(page).toContain("Article");
    expect(page).toMatch(/Language reviewed · Standard Fijian · \d{1,2} \w{3,4} \d{4}/);
    expect(page).toContain(">Learn</a>");
    expect(page.toLowerCase()).not.toContain("verified");
  });

  it("is listed in its area, on the homepage and in the sitemap", async () => {
    const { path } = await publishedLanguageArticle();

    expect(await (await visit("/learn")).text()).toContain(`href="${path}"`);
    expect(await (await visit("/")).text()).toContain(`href="${path}"`);
    expect(await (await visit("/sitemap.xml")).text()).toContain(`<loc>${PUBLIC}${path}</loc>`);
  });

  it("shows the published revision, never a newer draft", async () => {
    const { editor, article, path } = await publishedLanguageArticle();
    await saveNewRevision(editor, article, { ...languageFlag, title: "Draft title", body: body("Draft words.") });

    const page = await (await visit(path)).text();

    expect(page).toContain("<h1>Vosa vakaviti</h1>");
    expect(page).not.toContain("Draft words.");
  });

  it("never renders a draft that was never published", async () => {
    const { article } = await submittedArticle([]);
    const path = await itemPath(article.id);

    expect((await visit(path)).status).toBe(404);
    expect(await (await visit("/sitemap.xml")).text()).not.toContain(path);
  });

  it("answers 410 once withdrawn, even if the page was cached a moment before", async () => {
    const { editor, article, path } = await publishedLanguageArticle();
    const first = await visit(path);
    expect(first.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=300");

    await act(editor, article.id, 1, { intent: "withdraw" });

    const after = await visit(path);
    expect(after.status).toBe(410);
    expect(await after.text()).toContain("This has been withdrawn");
  });

  it("disappears the moment its rights are withdrawn", async () => {
    const { editor, article, path } = await publishedLanguageArticle();
    await visit(path);
    const record = await env.DB.prepare("SELECT id FROM rights_record WHERE subject_id = ?1")
      .bind(article.id)
      .first<{ id: string }>();

    await editor.browser.fetch(`/admin/articles/${article.id}/rights`, {
      form: { intent: "withdraw", recordId: record?.id as string, reason: "The family asked us to stop." },
    });

    expect((await visit(path)).status).toBe(404);
  });

  it("moves to a new slug, and its old address answers with a 301", async () => {
    const { editor, article, path } = await publishedLanguageArticle();
    await visit(path);

    const change = await editor.browser.fetch(`/admin/articles/${article.id}`, {
      form: { intent: "slug", slug: "greetings-in-fijian" },
    });

    expect(change.status).toBe(302);
    const old = await visit(path);
    expect(old.status).toBe(301);
    expect(old.headers.get("Location")).toBe("/learn/greetings-in-fijian");
    expect((await visit("/learn/greetings-in-fijian")).status).toBe(200);
  });

  it("refuses a slug that another item uses", async () => {
    const { editor, article } = await publishedLanguageArticle();
    const { path: otherPath } = await publishedLanguageArticle();

    const change = await editor.browser.fetch(`/admin/articles/${article.id}`, {
      form: { intent: "slug", slug: otherPath.split("/")[2] },
    });

    expect(change.status).toBe(400);
  });
});
