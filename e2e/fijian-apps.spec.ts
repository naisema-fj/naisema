import { expect, type Page, test } from "@playwright/test";
import { expectNoAxeViolations, stubTurnstile } from "./support";

/**
 * The Fijian apps, brought over from apps.naisema.com (docs/decision-log.md, "The Fijian apps join
 * NAISEMA"): every page runs its own scripts under the strict policy without an error, and what a
 * visitor sends from an app reaches the team through NAISEMA's forms.
 */

const APP_PAGES = [
  "/apps/dictionary/",
  "/apps/dictionary/pronunciation/",
  "/apps/lessons/",
  "/apps/lessons/body-parts/",
  "/apps/vale-vakaviti/",
  "/apps/waqa-vakaviti/",
  "/apps/translation/",
];

/** Every script error, refused request and policy violation on the page, as it happens. */
function watchForProblems(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`script error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
  });
  return problems;
}

async function sendWhenChecked(page: Page, button: string) {
  // Turnstile's script loads after the page and adds its token; a person waits for it, so the test does.
  await expect(page.locator('input[name="cf-turnstile-response"]')).toBeAttached();
  await page.getByRole("button", { name: button }).click();
  await expect(page.getByRole("heading", { name: "Thank you, it's been sent" })).toBeVisible();
}

test("each app page runs its scripts with no errors, inside NAISEMA's header and footer", async ({ page }) => {
  await stubTurnstile(page);
  for (const path of APP_PAGES) {
    const problems = watchForProblems(page);
    await page.goto(path);
    await page.waitForLoadState("load");
    await expect(page.getByRole("link", { name: "NAISEMA" }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Apps navigation" })).toBeVisible();
    expect(problems, path).toEqual([]);
    page.removeAllListeners("pageerror");
    page.removeAllListeners("console");
    page.removeAllListeners("response");
  }
});

test("an address without its closing slash goes to the app page", async ({ page }) => {
  await page.goto("/apps/dictionary");
  await expect(page).toHaveURL(/\/apps\/dictionary\/$/);
});

test("someone suggests a word from the apps' home", async ({ page }) => {
  await stubTurnstile(page);
  await page.goto("/apps");
  await expectNoAxeViolations(page);
  await page.getByRole("link", { name: "Open the dictionary" }).click();
  await expect(page).toHaveURL(/\/apps\/dictionary\/$/);
  await page.goto("/apps#suggest");
  await page.getByLabel("The Fijian word or phrase").fill("vakarorogo");
  await page.getByLabel("What it means in English").fill("To listen carefully.");
  await page.getByLabel("I've read how NAISEMA keeps what I send").check();
  await sendWhenChecked(page, "Send for review");
});

test("a reader finds a word in Vosa and sends a correction about it", async ({ page }) => {
  await stubTurnstile(page);
  await page.goto("/apps/dictionary/");
  await page.getByLabel("Search Fijian and English words").fill("baca");
  await expect(page.locator("#entry-list .entry-row").first()).toContainText("Baca");
  await expect(page.locator("#entry-detail")).toContainText("Bait");
  await page.locator("#entry-detail").getByRole("link", { name: "Suggest a correction" }).first().click();
  await expect(page).toHaveURL(/\/forms\/correct-word\?word=Baca/);
  await expect(page.getByLabel("The word")).toHaveValue("Baca");
  await page.getByLabel("What it should say").fill("Baca is also used for earthworms in our village.");
  await page.getByLabel("I've read how NAISEMA keeps what I send").check();
  await sendWhenChecked(page, "Send");
});

test("a reader browses Vosa's themes, Tuvavosa, sayings and the cultural guide", async ({ page }) => {
  await page.goto("/apps/dictionary/");
  await page.locator(".tab", { hasText: "Themes" }).click();
  await expect(page.locator("#theme-list li").first()).toBeVisible();
  await page.locator(".tab", { hasText: "Tuvavosa" }).click();
  await expect(page.locator("#grammar-list .entry-row").first()).toBeVisible();
  await page.locator(".tab", { hasText: "Vosavosavakaviti" }).click();
  await expect(page.locator("#proverb-list .entry-row").first()).toBeVisible();
  await page.locator(".tab", { hasText: "Vakavanua" }).click();
  await expect(page.locator("#culture-view")).not.toBeEmpty();
});

test("someone adds a missing icavuti from Vosa", async ({ page }) => {
  await stubTurnstile(page);
  await page.goto("/apps/dictionary/?view=icavuti");
  await expect(page.locator("#icavuti-count")).toContainText("place records available");
  await page.locator("#icavuti-add").click();
  await page.getByLabel("What does this title belong to?").selectOption("koro");
  await page.locator("#icavuti-form-province").fill("Ba");
  await page.locator("#icavuti-form-district").fill("Nadi");
  await page.locator("#icavuti-form-title").fill("A test title");
  await page.locator("#icavuti-form-villages").fill("Narewa");
  await page.locator("#icavuti-form").getByLabel("I've read how NAISEMA keeps what I send").check();
  await sendWhenChecked(page, "Send for review");
});

test("someone drafts a Fijian expression for the water cycle and sends it to the team", async ({ page }) => {
  await stubTurnstile(page);
  await page.goto("/apps/translation/");
  await page.getByRole("link", { name: "Explore evaporation" }).click();
  await page.getByLabel("Fijian expression").fill("vakacegu ni wai");
  await page.getByLabel("Approach").selectOption("descriptive");
  await page.getByLabel("Why this wording?").fill("It describes the water rising as vapour.");
  await page.getByRole("button", { name: "Save my draft" }).click();
  await page.getByRole("link", { name: /Send this draft to the team/ }).click();
  await expect(page.getByLabel("The idea")).toHaveValue("Evaporation (water cycle)");
  await expect(page.getByLabel("Your Fijian wording, and why it fits")).toHaveValue(/vakacegu ni wai/);
  await page.getByLabel("I've read how NAISEMA keeps what I send").check();
  await sendWhenChecked(page, "Send");
});

test("an app page's correction note opens the correction form for that page", async ({ page }) => {
  await stubTurnstile(page);
  await page.goto("/apps/vale-vakaviti/");
  await page.getByRole("link", { name: "Suggest a correction" }).click();
  await expect(page.getByLabel("The page it's on")).toHaveValue("/apps/vale-vakaviti/");
  await page.getByLabel("Which word, image, or explanation?").fill("The bou pointer");
  await page.getByLabel("What should we correct or investigate?").fill("The bou is the main house post.");
  await page.getByLabel("I've read how NAISEMA keeps what I send").check();
  await sendWhenChecked(page, "Send");
});
