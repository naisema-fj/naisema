import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { signedInStaff } from "./support/staff";

/** A page that hydrates: the article editor, behind the staff sign-in. */
async function hydratingPage() {
  const editor = await signedInStaff(`csp-${crypto.randomUUID()}@naisema.test`, [{ role: "editor" }]);
  return editor.browser.fetch("/admin/articles/new");
}

describe("public page responses", () => {
  it("carry a strict content security policy and baseline security headers", async () => {
    const response = await SELF.fetch("https://naisema.test/");
    const csp = response.headers.get("Content-Security-Policy") ?? "";

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    // Public pages ship no JavaScript, so they allow none.
    expect(csp).toContain("script-src 'none'");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("give every inline script on a hydrating page the policy's nonce", async () => {
    const response = await hydratingPage();
    const nonce = response.headers.get("Content-Security-Policy")?.match(/'nonce-([^']+)'/)?.[1];
    const html = await response.text();

    const inlineScripts = html.match(/<script(?![^>]*\bsrc=)[^>]*>/g) ?? [];
    expect(nonce).toBeTruthy();
    expect(inlineScripts.length).toBeGreaterThan(0);
    for (const tag of inlineScripts) {
      expect(tag).toContain(`nonce="${nonce}"`);
    }
  });

  it("use a fresh nonce for every response", async () => {
    const first = (await hydratingPage()).headers.get("Content-Security-Policy");
    const second = (await hydratingPage()).headers.get("Content-Security-Policy");

    expect(first).not.toBe(second);
  });
});

describe("search engine indexing", () => {
  it("is refused unless the environment explicitly allows it", async () => {
    const home = await SELF.fetch("https://naisema.test/");
    const missing = await SELF.fetch("https://naisema.test/no-such-page");

    expect(home.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(missing.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
});

describe("static pages", () => {
  it("ship no client JavaScript on the home page", async () => {
    const html = await (await SELF.fetch("https://naisema.test/")).text();

    expect(html).not.toContain("<script");
  });
});
