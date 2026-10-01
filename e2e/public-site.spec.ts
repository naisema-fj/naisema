import { expect, type Page, test } from "@playwright/test";
import { expectNoAxeViolations } from "./support";

const ARTICLE = "/ezine/e2e-letter-from-home";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("the homepage, an area, an article and the not-found page pass axe", async ({ page }) => {
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
  ]) {
    await page.goto(path);
    await expectNoAxeViolations(page);
  }
});

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
    for (const path of ["/", "/learn", ARTICLE, "/resources/e2e-dictionary-link", "/topics/e2e-ceremonies"]) {
      await page.goto(path);
      await expectNoHorizontalScroll(page);
    }
  }
});
