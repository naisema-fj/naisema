import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createArticle, staff } from "./support/articles";
import { authoredLayer } from "./support/layers";

/** Staff search (#58): finds what the person's roles may open from the lists, and nothing else. */

const word = () => `w${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
type Who = Awaited<ReturnType<typeof staff>>;

const search = async (who: Who, query: string) =>
  (await who.browser.fetch(`/admin/search?q=${encodeURIComponent(query)}`)).text();
// React puts a comment between text and the values inside it; the reader never sees them.
const main = (html: string) => html.slice(html.indexOf("<main")).replaceAll("<!-- -->", "");
const headings = (html: string) => [...main(html).matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map(([, text]) => text);

async function slugOf(articleId: string) {
  const row = await env.DB.prepare("SELECT slug FROM content_item WHERE id = ?1")
    .bind(articleId)
    .first<{ slug: string }>();
  return row?.slug as string;
}

async function addContributor(editor: Who, name: string) {
  await editor.browser.fetch("/admin/contributors", { form: { name, notes: "" } });
  const row = await env.DB.prepare("SELECT id FROM contributor WHERE name = ?1").bind(name).first<{ id: string }>();
  return row?.id as string;
}

async function addProvider(editor: Who, name: string) {
  const response = await editor.browser.fetch("/admin/providers/new", {
    form: { name, lastCheckedOn: "2026-09-30", listed: "on" },
  });
  return response.headers.get("Location")?.split("/").at(-1) as string;
}

describe("staff search", () => {
  it("finds a Content Item by a word in its title, by its slug and by the start of its ID, and says its state", async () => {
    const editor = await staff("editor", { role: "editor" });
    const title = `Yaqona ${word()}`;
    const { id } = await createArticle(editor, { title });

    const byTitle = await search(editor, title.toLowerCase());
    const bySlug = await search(editor, await slugOf(id));
    const byId = await search(editor, id.slice(0, 8));

    for (const html of [byTitle, bySlug, byId]) {
      expect(headings(html)).toEqual(["Content Items"]);
      expect(main(html)).toContain(`<a href="/admin/articles/${id}">${title}</a>`);
      expect(main(html)).toContain("Not published");
    }
  });

  it("finds Learning Layers, media files, Contributors and Providers, each grouped and linked to its page", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { layerId, assetId } = await authoredLayer();
    const contributorName = `Mere ${word()}`;
    const contributorId = await addContributor(editor, contributorName);
    const providerName = `Lami School ${word()}`;
    const providerId = await addProvider(editor, providerName);

    const layers = main(await search(editor, "greetings"));
    expect(layers).toContain(`href="/admin/learning-layers/${layerId}"`);
    expect(layers).toContain("Not published");

    const media = main(await search(editor, "talanoa.mp4"));
    expect(media).toContain(`href="/admin/media#asset-${assetId}"`);
    expect(media).toContain("Ready");

    const people = main(await search(editor, contributorName));
    expect(people).toContain(`href="/admin/contributors#contributor-${contributorId}"`);

    const providers = main(await search(editor, providerName));
    expect(providers).toContain(`href="/admin/providers/${providerId}"`);
    expect(providers).toContain("Listed on the public site");

    // An ID finds each kind too.
    expect(main(await search(editor, assetId.slice(0, 8)))).toContain(`#asset-${assetId}`);
    expect(main(await search(editor, providerId.slice(0, 8)))).toContain(`/admin/providers/${providerId}`);
    expect(main(await search(editor, contributorId.slice(0, 8)))).toContain(`#contributor-${contributorId}`);
  });

  it("groups results by kind", async () => {
    const editor = await staff("editor", { role: "editor" });
    const shared = word();
    await createArticle(editor, { title: `Story ${shared}` });
    await addContributor(editor, `Person ${shared}`);
    await addProvider(editor, `School ${shared}`);

    expect(headings(await search(editor, shared))).toEqual(["Content Items", "Contributors", "Providers"]);
  });

  it("shows an Educator only the Learning Layers they are assigned to and the media library, not content or directories", async () => {
    const { educator, editor } = await authoredLayer();
    const { layerId: otherLayer } = await authoredLayer();
    await createArticle(editor, { title: "Greetings article" });
    await addContributor(editor, "Greetings Contributor");
    await addProvider(editor, "Greetings Provider");

    const html = main(await search(educator, "greetings"));

    expect(headings(html)).toEqual(["Learning Layers"]);
    expect(html).not.toContain(`/admin/learning-layers/${otherLayer}`);
    expect(html).not.toContain("Greetings article");
    expect(html).not.toContain("Greetings Contributor");
    expect(html).not.toContain("Greetings Provider");
    expect(main(await search(educator, "talanoa"))).toContain("Media files");
  });

  it("never searches Cases, even for the people who handle them or an administrator", async () => {
    const lead = await staff("lead", { role: "safeguarding_lead" });
    const admin = await staff("admin", { role: "administrator" });
    const editor = await staff("editor", { role: "editor" });
    const caseId = crypto.randomUUID();
    const secret = word();
    await env.DB.prepare(
      "INSERT INTO case_record (id, kind, reason, details, received_at, updated_at) VALUES (?1, 'report', ?2, ?2, 0, 0)",
    )
      .bind(caseId, `Concern ${secret}`)
      .run();

    for (const who of [lead, admin, editor]) {
      for (const query of [secret, caseId, caseId.slice(0, 8)]) {
        const html = main(await search(who, query));
        expect(html).toContain("Nothing found");
        expect(headings(html)).toEqual([]);
        expect(html).not.toContain("/admin/cases/");
        expect(html).not.toContain(`Concern ${secret}`);
      }
    }
  });

  it("offers the search box to people with something to search, and to nobody else", async () => {
    const editor = await staff("editor", { role: "editor" });
    const lead = await staff("lead", { role: "safeguarding_lead" });

    expect(await (await editor.browser.fetch("/admin")).text()).toContain('<search class="staff-search">');
    expect(await (await lead.browser.fetch("/admin")).text()).not.toContain('class="staff-search"');
  });

  it("keeps the query in the box and the address, and has a helpful empty state", async () => {
    const editor = await staff("editor", { role: "editor" });
    const query = `nothing-${word()}`;

    const html = await search(editor, query);

    expect(html).toMatch(
      new RegExp(`<input[^>]*name="q"[^>]*value="${query}"|<input[^>]*value="${query}"[^>]*name="q"`),
    );
    expect(main(html)).toContain(`Nothing found for “${query}”.`);
    expect(main(html)).toContain("Search only covers what your roles may open.");
    expect(main(await search(editor, ""))).toContain("Type a word from a title or name");
  });

  it("shows what was typed as text, never as markup", async () => {
    const editor = await staff("editor", { role: "editor" });

    const html = await search(editor, '<script>alert("x")</script>');

    expect(html).not.toContain('<script>alert("x")');
    expect(main(html)).toContain("&lt;script&gt;");
  });

  it("needs a staff sign-in", async () => {
    const response = await (await import("cloudflare:test")).SELF.fetch("http://admin.localhost/admin/search?q=x", {
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("/admin/sign-in");
  });

  it("limits each kind and says how many more matched", async () => {
    const editor = await staff("editor", { role: "editor" });
    const shared = word();
    for (let i = 0; i < 17; i++) await addContributor(editor, `Person ${shared} ${i}`);

    const html = main(await search(editor, shared));

    expect(html).toContain("17 results");
    expect(html.match(/contributor-/g)).toHaveLength(15);
    expect(html).toContain("2 more matches.");
  });
});
