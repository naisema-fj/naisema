import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { purgePublicPages } from "~/lib/public-cache.server";

async function setSiteSetting(key: string, value: string) {
  await env.DB.prepare(
    "INSERT INTO site_settings (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = ?2",
  )
    .bind(key, value, Date.now())
    .run();
}

describe("public home page", () => {
  beforeEach(async () => {
    await env.DB.exec("DELETE FROM site_settings");
    // Public pages are edge-cached; site settings have no admin page to purge them yet.
    await purgePublicPages(env, ["/"]);
  });

  it("shows the welcome statement stored in the database", async () => {
    await setSiteSetting("welcome_statement", "A connection space for Fijians abroad, open to all.");

    const response = await SELF.fetch("https://naisema.test/");

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("A connection space for Fijians abroad, open to all.");
  });

  it("uses the site name stored in the database as the page title and the welcome's sign-off", async () => {
    await setSiteSetting("site_name", "Na iSema Staging");

    const html = await (await SELF.fetch("https://naisema.test/")).text();

    expect(html).toContain("<title>Na iSema Staging</title>");
    expect(html).toContain('<span class="signature">Na iSema Staging</span>');
  });

  it("still renders with the default name before any settings exist", async () => {
    const response = await SELF.fetch("https://naisema.test/");

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<span class="signature">Na iSema</span>');
  });
});

describe("unknown pages", () => {
  it("respond with 404 and a way back home", async () => {
    const response = await SELF.fetch("https://naisema.test/no-such-page");

    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain("We couldn&#x27;t find that page");
    expect(html).toContain('href="/"');
  });
});
