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

  it("keeps the nav on pages under another, and on the home page lists the same pages", async () => {
    const editor = await staff("editor", { role: "editor" });

    const history = await page(editor, "/admin/articles/anything/history");
    const home = await page(editor, "/admin");

    // The article doesn't exist (404), so there is no shell around the error; the home page has it.
    expect(history).not.toContain('aria-label="Staff"');
    for (const { href, label } of navLinks(home).filter((link) => link.href !== "/admin")) {
      expect(home, label).toContain(`<a href="${href}">${label}</a>`);
    }
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
