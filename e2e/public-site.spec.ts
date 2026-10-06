import { expect, type Page, test } from "@playwright/test";
import { expectNoAxeViolations } from "./support";

const ARTICLE = "/ezine/e2e-letter-from-home";
const EPISODE = "/voices/e2e-talanoa";
const PROVIDER = "/connect/providers/e2e-lami-language-school";
const CREATOR = "/connect/creators/e2e-litia-vula";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

// Every public page type passes axe: one test per page, so each has its own time budget and a
// failure names the page.
for (const path of [
  "/",
  "/ezine",
  "/learn",
  ARTICLE,
  "/about",
  "/nowhere",
  "/search?q=village",
  "/search?q=zzzz",
  "/resources/e2e-dictionary-link",
  "/topics/e2e-ceremonies",
  "/topics",
  "/voices",
  EPISODE,
  "/connect",
  "/connect/providers",
  PROVIDER,
  "/connect/offerings",
  "/connect/offerings?cost=paid",
  "/connect/creators",
  CREATOR,
  "/forms/contribute",
  "/forms/teach",
  "/forms/consultation",
  "/newsletter",
  "/newsletter/unsubscribe",
  "/report",
  "/privacy/request",
  "/community-standards",
]) {
  test(`${path} passes axe`, async ({ page }) => {
    await page.goto(path);
    await expectNoAxeViolations(page);
  });
}

test("a visitor searches, narrows by area, finds nothing, and starts again", async ({ page }) => {
  await page.goto("/search");

  await page.getByLabel("Search for").fill("village greets");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("link", { name: "A letter from home" })).toBeVisible();

  await page.getByLabel("Area").selectOption("learn");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=village\+greets&area=learn/);
  await expect(page.getByText("Nothing matched your search.")).toBeVisible();

  await page.getByRole("link", { name: "Search all areas, topics and formats" }).click();
  await expect(page.getByRole("link", { name: "A letter from home" })).toBeVisible();

  await page.getByRole("link", { name: "Clear the search and filters" }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByLabel("Search for")).toHaveValue("");
});

test("a visitor reads an article: who it is from, when, and what it was reviewed for", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "E-zine" }).first().click();
  await page.getByRole("link", { name: "A letter from home" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "A letter from home" })).toBeVisible();
  await expect(page.getByText("Words by the E2E suite")).toBeVisible();
  await expect(page.getByRole("list", { name: "Review Labels" })).toContainText("Opinion or personal experience");
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("E-zine");
});

test("a visitor opens a Voices Episode: nothing plays until they choose, and the transcript is always there", async ({
  page,
}) => {
  await page.goto("/voices");
  await page.getByRole("link", { name: "Talanoa: coming home to Levuka" }).click();

  const player = page.locator("audio");
  await expect(player).toHaveCount(1);
  await expect(player).toHaveAttribute("preload", "none");
  expect(await player.evaluate((audio: HTMLAudioElement) => audio.paused && !audio.autoplay)).toBe(true);
  await page.getByRole("link", { name: "Read the transcript" }).click();
  await expect(page).toHaveURL(/#transcript$/);
  const transcript = page.getByRole("region", { name: "Transcript" });
  await expect(transcript).toContainText("Ratu Joni: Bula, Mere. It has been a long time.");
  await expect(page.getByText("open.spotify.com, another website")).toBeVisible();
});

test("a visitor finds a class under Connect, sees who offers it and where its link goes", async ({ page }) => {
  await page.goto("/connect");
  await page.getByRole("link", { name: "Classes and courses" }).click();
  await page.getByLabel("Cost").selectOption("paid");
  await page.getByRole("button", { name: "Show" }).click();

  await expect(page).toHaveURL(/cost=paid/);
  const offering = page.getByRole("region", { name: "Conversational Fijian, evenings" });
  await expect(offering).toContainText("AUD 120");
  await expect(offering).toContainText("lami.example, another website");
  await offering.getByRole("link", { name: "Lami Language School" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lami Language School" })).toBeVisible();
  await expect(page.getByText("A NAISEMA Partner, under a recorded Partnership Agreement.")).toBeVisible();
});

test("the menu works by keyboard on a phone-width screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");

  const menu = page.getByText("Menu", { exact: true });
  await menu.focus();
  await page.keyboard.press("Enter");
  const areas = page.getByRole("navigation", { name: "Main menu" });
  await expect(areas.getByRole("link", { name: "Voices" })).toBeVisible();
  await areas.getByRole("link", { name: "Voices" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/voices$/);
});

test("pages reflow at 320 px and at 200% zoom without sideways scrolling", async ({ page }) => {
  // 320 CSS px is WCAG's reflow width; 640 px is a 1280 px window at 200% zoom.
  for (const width of [320, 640]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of [
      "/",
      "/learn",
      ARTICLE,
      "/resources/e2e-dictionary-link",
      "/topics/e2e-ceremonies",
      EPISODE,
      PROVIDER,
      CREATOR,
      // A Video's page and its Learning Layer's player.
      "/learn/e2e-market-talanoa",
      "/learn/e2e-market-talanoa/language/e2e-layer-public",
      "/learn/e2e-market-talanoa/language/e2e-layer-public?stage=support",
      "/learn/e2e-market-talanoa/language/e2e-layer-public?stage=respond",
    ]) {
      await page.goto(path);
      await expectNoHorizontalScroll(page);
    }
  }
});
