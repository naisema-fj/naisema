import { expect, test } from "@playwright/test";
import { ADMIN, confirmTwoFactorCode, expectNoAxeViolations, followSignInLink, startTwoFactorSetup } from "./support";

test("a staff member signs in with an email link and an authenticator code", async ({ page }, testInfo) => {
  // Each browser project uses its own seeded account (e2e/seed.sql).
  const email = `e2e-admin-${testInfo.project.name}@naisema.test`;

  await page.goto(`${ADMIN}/admin`);
  await expect(page).toHaveURL(`${ADMIN}/admin/sign-in`);
  await expectNoAxeViolations(page);

  await followSignInLink(page, email);
  await expect(page).toHaveURL(`${ADMIN}/admin/two-factor/setup`);
  await expectNoAxeViolations(page);

  const key = await startTwoFactorSetup(page);
  await expectNoAxeViolations(page);
  await confirmTwoFactorCode(page, key);

  await expect(page.getByRole("heading", { name: "NAISEMA staff" })).toBeVisible();
  await expect(page.getByText("Administrator")).toBeVisible();
  await expectNoAxeViolations(page);

  // The shell's navigation is a sidebar on a wide screen and a Menu on a narrow one.
  // (Decided by the window's width, not by asking whether the Menu is visible, which would race
  // the stylesheet.) The sidebar appears from 56rem, which is 896 px.
  const menu = page.locator("summary", { hasText: "Menu" });
  const narrow = (page.viewportSize()?.width ?? 0) < 896;
  if (narrow) await menu.click();
  const nav = page.getByRole("navigation", { name: /^Staff( menu)?$/ });
  await expect(nav.getByRole("link", { name: "Staff and roles" })).toBeVisible();
  await expectNoAxeViolations(page);

  await nav.getByRole("link", { name: "Staff and roles" }).click();
  await expect(page.getByRole("heading", { name: "Staff and roles" })).toBeVisible();
  if (narrow) await menu.click();
  await expect(nav.getByRole("link", { name: "Staff and roles" })).toHaveAttribute("aria-current", "page");
  await expectNoAxeViolations(page);

  // The shell and the pages in it reflow at 320 px and at 200% zoom (640 px of a 1280 px window).
  for (const width of [320, 640]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of [
      "/admin",
      "/admin/staff",
      "/admin/audit",
      "/admin/exports",
      "/admin/usage",
      "/admin/restore",
      "/admin/consents",
      "/admin/submissions",
      "/admin/cases",
      "/admin/media",
    ]) {
      await page.goto(`${ADMIN}${path}`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
      await expectNoAxeViolations(page);
    }
  }
});
