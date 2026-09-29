import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("public page responses", () => {
  it("carry a strict content security policy and baseline security headers", async () => {
    const response = await SELF.fetch("https://naisema.test/");
    const csp = response.headers.get("Content-Security-Policy") ?? "";

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+'/);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("give every inline script the policy's nonce", async () => {
    const response = await SELF.fetch("https://naisema.test/no-such-page");
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
    const first = (await SELF.fetch("https://naisema.test/")).headers.get("Content-Security-Policy");
    const second = (await SELF.fetch("https://naisema.test/")).headers.get("Content-Security-Policy");

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
