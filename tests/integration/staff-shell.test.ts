import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { staff } from "./support/articles";

/** The staff shell (#55): one header and navigation around every staff page, offering only what the roles allow. */

const ADMIN = "http://admin.localhost";
const page = async (who: { browser: { fetch: (path: string) => Promise<Response> } }, path: string) =>
  (await who.browser.fetch(path)).text();

const navLinks = (html: string) =>
  [...html.matchAll(/<nav aria-label="Staff"[\s\S]*?<\/nav>/g)]
    .flatMap(([nav]) => [...nav.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)])
    .map(([, href, label]) => ({ href, label }));

describe("the staff shell", () => {
  it("offers an editor their pages in the navigation, marks the current one, and shows who is signed in", async () => {
    const editor = await staff("editor", { role: "editor" });

    const home = await page(editor, "/admin");
    const articles = await page(editor, "/admin/articles");

    const labels = navLinks(home).map((link) => link.label);
    expect(labels).toEqual(expect.arrayContaining(["Staff home", "Content", "Topics", "Media library", "Submissions"]));
    expect(labels).not.toContain("Staff and roles");
    expect(labels).not.toContain("Audit log");
    expect(home).toContain(editor.email);
    expect(home).toContain('action="/admin/sign-out"');
    // The same navigation is in the phone menu.
    expect(home).toContain('<nav aria-label="Staff menu"');
    expect(home).toMatch(/<a href="\/admin" aria-current="page">Staff home<\/a>/);
    expect(articles).toMatch(/<a href="\/admin\/articles" aria-current="page">Content<\/a>/);
    expect(articles).not.toMatch(/<a href="\/admin" aria-current/);
  });

  it("offers an administrator the administration pages", async () => {
    const administrator = await staff("admin", { role: "administrator" });

    const labels = navLinks(await page(administrator, "/admin")).map((link) => link.label);

    expect(labels).toEqual(
      expect.arrayContaining(["Staff and roles", "Exports", "Audit log", "Usage and costs", "Backups and restoring"]),
    );
    expect(labels).not.toContain("Content");
  });

  it("lists on the home page the same pages as the navigation, and keeps the shell on a missing page", async () => {
    const editor = await staff("editor", { role: "editor" });

    const history = await page(editor, "/admin/articles/anything/history");
    const home = await page(editor, "/admin");

    // The article doesn't exist (404), and the error still has the shell around it.
    expect(history).toContain("Page not found");
    expect(history).toContain('<nav aria-label="Staff"');
    for (const { href, label } of navLinks(home).filter((link) => link.href !== "/admin")) {
      expect(home, label).toContain(`<a href="${href}">${label}</a>`);
    }
  });

  it("opens every page it offers, for every role it offers it to", async () => {
    const personas = [
      await staff("admin", { role: "administrator" }),
      await staff("editor", { role: "editor" }),
      await staff("educator", { role: "educator" }),
      await staff("reviewer", { role: "reviewer", reviewType: "language", languageVariety: "standard-fijian" }),
      await staff("safeguarding", { role: "safeguarding_lead" }),
      await staff("privacy", { role: "privacy_contact" }),
    ];

    for (const person of personas) {
      const home = await page(person, "/admin");
      for (const { href, label } of navLinks(home)) {
        const response = await person.browser.fetch(href);
        expect(response.status, `${label} (${href}) for ${person.email}`).toBe(200);
        await response.arrayBuffer();
      }
    }
  });

  it("keeps the shell around a refused page", async () => {
    const editor = await staff("editor", { role: "editor" });

    const refused = await editor.browser.fetch("/admin/audit");
    const html = await refused.text();

    expect(refused.status).toBe(403);
    expect(html).toContain("Not for your roles");
    expect(html).toContain('<nav aria-label="Staff"');
    expect(html).toContain("<footer");
    expect(html).toContain('<a href="/admin">Back to staff home</a>');
  });

  it("shows only the header before sign-in, with no navigation or sign-out", async () => {
    const response = await SELF.fetch(`${ADMIN}/admin/sign-in`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("NAISEMA");
    expect(html).toContain('<main id="main"');
    expect(html).not.toContain('aria-label="Staff"');
    expect(html).not.toContain("Sign out");
  });
});
