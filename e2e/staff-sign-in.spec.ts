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

  await expect(page.getByRole("heading", { name: "Na iSema staff" })).toBeVisible();
  await expect(page.getByText("Administrator")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Manage staff and roles" }).click();
  await expect(page.getByRole("heading", { name: "Staff and roles" })).toBeVisible();
  await expectNoAxeViolations(page);
});
