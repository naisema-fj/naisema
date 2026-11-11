import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const ADMIN = "http://admin.localhost:4173";

/** Seeded staff (e2e/seed.sql). Locally, this header names the person instead of a signed-in session. */
export const STAFF_HEADER = "X-Dev-Staff-Email";
export const EDITOR = "e2e-editor@naisema.test";

/**
 * Turnstile's script comes from Cloudflare, which the test machine may not reach. This stands in
 * for its test site key's widget: it adds the always-passing token to the form, as the real one
 * would (app/lib/turnstile.ts).
 *
 * React hoists the async script into <head>, in the page's first streamed chunk, while the widget
 * comes in a later one. Fulfilled at once, the stub can run before that chunk arrives, so like the
 * real script it waits for the document to be parsed before it looks for widgets.
 */
const TURNSTILE_STUB = `function render() {
  for (const widget of document.querySelectorAll(".cf-turnstile")) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "cf-turnstile-response";
    input.value = "XXXX.DUMMY.TOKEN.XXXX";
    widget.append(input);
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
else render();`;

export async function stubTurnstile(page: Page) {
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: TURNSTILE_STUB }),
  );
}

export async function expectNoAxeViolations(page: Page) {
  // A click that navigates returns once the new page has committed, which can be before its
  // stylesheets have loaded; axe would then measure unstyled links and fail on target size.
  await page.waitForLoadState("load");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

/**
 * The page reflows at 320 px and at 200% zoom (640 px of a 1280 px window): nothing scrolls
 * sideways and axe still passes. Restores the window afterwards so the journey carries on.
 */
export async function expectReflow(page: Page) {
  const original = page.viewportSize();
  for (const width of [320, 640]) {
    await page.setViewportSize({ width, height: 800 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${page.url()} at ${width}px`).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  }
  if (original) await page.setViewportSize(original);
}
