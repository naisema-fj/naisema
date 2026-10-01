import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { reindexExpiredRights } from "~/lib/search.server";
import { act, createArticle, type Staff, staff } from "./support/articles";
import { recordRights } from "./support/rights";

const PUBLIC = "https://naisema.test";
const visit = (path: string) => SELF.fetch(`${PUBLIC}${path}`, { redirect: "manual" });
const search = async (query: string) => (await visit(`/search${query}`)).text();
/** A word no other test's articles contain, so each test reads only its own results. */
const word = () => `w${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;

/** An unflagged article (no reviews needed) with a Rights Record granting Publish, published. */
async function publishedArticle(editor: Staff, fields: Record<string, string>) {
  const article = await createArticle(editor, { flag: [], languageVariety: "", ...fields });
  expect((await recordRights(editor.browser, article.id)).status).toBe(302);
  expect((await act(editor, article.id, 1, { intent: "submit" })).status).toBe(302);
  expect((await act(editor, article.id, 1, { intent: "publish" })).status).toBe(302);
  return article;
}

async function topicName(topicId: string) {
  const row = await env.DB.prepare("SELECT name FROM topic WHERE id = ?1").bind(topicId).first<{ name: string }>();
  return row?.name as string;
}

describe("public search", () => {
  it("finds published Articles by words in their title, summary or Topic", async () => {
    const editor = await staff("editor", { role: "editor" });
    const [inTitle, inSummary] = [word(), word()];
    const article = await publishedArticle(editor, { title: `Sevusevu ${inTitle}`, summary: `About ${inSummary}.` });
    const topic = await topicName(article.topicId);

    expect(await search(`?q=${inTitle}`)).toContain(`Sevusevu ${inTitle}`);
    expect(await search(`?q=${inSummary}`)).toContain(`Sevusevu ${inTitle}`);
    expect(await search(`?q=${encodeURIComponent(topic)}`)).toContain(`Sevusevu ${inTitle}`);
    // The last word matches as a prefix, as the visitor types.
    expect(await search(`?q=${inTitle.slice(0, 6)}`)).toContain(`Sevusevu ${inTitle}`);
  });

  it("never shows drafts", async () => {
    const editor = await staff("editor", { role: "editor" });
    const secret = word();
    const draft = await createArticle(editor, { flag: [], languageVariety: "", title: `Draft ${secret}` });
    await recordRights(editor.browser, draft.id);
    await act(editor, draft.id, 1, { intent: "submit" });

    expect(await search(`?q=${secret}`)).not.toContain(`Draft ${secret}`);
  });

  it("drops an item from search, its area and the sitemap the moment it is withdrawn", async () => {
    const editor = await staff("editor", { role: "editor" });
    const term = word();
    const article = await publishedArticle(editor, { title: `Withdrawn ${term}` });
    const row = await env.DB.prepare("SELECT slug FROM content_item WHERE id = ?1")
      .bind(article.id)
      .first<{ slug: string }>();
    const path = `/learn/${row?.slug}`;
    expect(await search(`?q=${term}`)).toContain(`Withdrawn ${term}`);
    expect(await (await visit("/learn")).text()).toContain(path);
    expect(await (await visit("/sitemap.xml")).text()).toContain(path);

    await act(editor, article.id, 1, { intent: "withdraw" });

    const response = await visit(`/search?q=${term}`);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).not.toContain(`Withdrawn ${term}`);
    expect(await (await visit("/learn")).text()).not.toContain(path);
    expect(await (await visit("/sitemap.xml")).text()).not.toContain(path);
  });

  it("sends a page past the last one back to the last page", async () => {
    const editor = await staff("editor", { role: "editor" });
    const term = word();
    await publishedArticle(editor, { title: `Only ${term}` });

    const response = await visit(`/search?q=${term}&page=99`);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(`/search?q=${term}`);
  });

  it("re-checks every hit, so an item that lapsed since it was indexed never appears", async () => {
    const editor = await staff("editor", { role: "editor" });
    const term = word();
    const article = await publishedArticle(editor, { title: `Lapsed ${term}` });
    // Its rights end without any event that would update the index, as an expiry does.
    await env.DB.prepare("UPDATE content_item SET current_published_revision_id = NULL WHERE id = ?1")
      .bind(article.id)
      .run();

    expect(await search(`?q=${term}`)).not.toContain(`Lapsed ${term}`);
    const left = await env.DB.prepare("SELECT count(*) AS n FROM search_entry WHERE content_item_id = ?1")
      .bind(article.id)
      .first<{ n: number }>();
    expect(left?.n).toBe(0);
  });

  it("filters by area, Topic and format, keeping the filters in the URL", async () => {
    const editor = await staff("editor", { role: "editor" });
    const term = word();
    const learn = await publishedArticle(editor, { title: `Learn ${term}`, primaryArea: "learn" });
    await publishedArticle(editor, { title: `Voices ${term}`, primaryArea: "voices" });

    const byArea = await search(`?q=${term}&area=learn`);
    expect(byArea).toContain(`Learn ${term}`);
    expect(byArea).not.toContain(`Voices ${term}`);
    expect(byArea).toMatch(/<option value="learn" selected="">/);

    const byTopic = await search(`?q=${term}&topic=${learn.topicId}`);
    expect(byTopic).toContain(`Learn ${term}`);
    expect(byTopic).not.toContain(`Voices ${term}`);

    expect(await search(`?q=${term}&format=article`)).toContain(`Voices ${term}`);
  });

  it("pages through results, keeping the search and filters in each page's address", async () => {
    const editor = await staff("editor", { role: "editor" });
    const term = word();
    for (let index = 1; index <= 21; index++) {
      await publishedArticle(editor, { title: `Paged ${term} ${index}`, primaryArea: "ezine" });
    }

    const first = await search(`?q=${term}&area=ezine`);
    expect(first).toContain("21 results");
    expect(first).toContain(`href="/search?q=${term}&amp;area=ezine&amp;page=2"`);

    const second = await search(`?q=${term}&area=ezine&page=2`);
    expect(second.match(new RegExp(`Paged ${term} \\d+`, "g"))).toHaveLength(1);
    expect(second).toContain(`href="/search?q=${term}&amp;area=ezine"`);

    // The area page lists the newest 20 and sends the rest to search.
    const area = await (await visit("/ezine")).text();
    expect(area.match(new RegExp(`Paged ${term} \\d+`, "g"))).toHaveLength(20);
    expect(area).toContain('href="/search?area=ezine"');
  });

  it("drops an item from search and listings once the daily job sees its rights expired", async () => {
    const editor = await staff("editor", { role: "editor" });
    const term = word();
    const inThreeDays = new Date(Date.now() + 3 * 86_400_000);
    const article = await createArticle(editor, { flag: [], languageVariety: "", title: `Expiring ${term}` });
    await recordRights(editor.browser, article.id, { expiresOn: inThreeDays.toISOString().slice(0, 10) });
    await act(editor, article.id, 1, { intent: "submit" });
    await act(editor, article.id, 1, { intent: "publish" });
    expect(await search(`?q=${term}`)).toContain(`Expiring ${term}`);

    const dayAfter = new Date(inThreeDays.getTime() + 86_400_000);
    await reindexExpiredRights(getDb(env.DB), new Date(dayAfter.getTime() - 2 * 86_400_000), dayAfter);

    const left = await env.DB.prepare("SELECT count(*) AS n FROM search_entry WHERE content_item_id = ?1")
      .bind(article.id)
      .first<{ n: number }>();
    expect(left?.n).toBe(0);
  });

  it("helps when nothing matches, and offers a way to start again", async () => {
    const page = await search(`?q=${word()}&area=learn`);

    expect(page).toContain("Nothing matched your search");
    expect(page).toContain('href="/search"');
    expect(page).toContain("Search all areas");
  });

  it("stays out of the edge cache and search engines", async () => {
    const response = await visit("/search?q=bula");

    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toContain('<meta name="robots" content="noindex"');
  });
});
