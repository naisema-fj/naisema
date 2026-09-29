import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("home page shows the stored welcome statement", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "NAISEMA" })).toBeVisible();
  await expect(page.getByText("Welcome to the NAISEMA test build.")).toBeVisible();
});

test("home page has no automatically detectable WCAG 2.2 AA violations", async ({ page }) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("keyboard users can skip straight to the main content", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();
});
