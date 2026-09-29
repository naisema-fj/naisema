import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { expect, type Page, test } from "@playwright/test";

const ADMIN = "http://admin.localhost:4173";

function latestEmailText(email: string): string {
  const output = execFileSync(
    "pnpm",
    [
      "--silent",
      "wrangler",
      "d1",
      "execute",
      "DB",
      "--local",
      "--json",
      "--config",
      "wrangler.jsonc",
      "--command",
      `SELECT text FROM email_outbox WHERE "to" = '${email}' ORDER BY id DESC LIMIT 1`,
    ],
    { encoding: "utf8" },
  );
  return JSON.parse(output.slice(output.indexOf("[")))[0].results[0].text;
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

test("a staff member signs in with an email link and an authenticator code", async ({ page }, testInfo) => {
  // Each browser project uses its own seeded account (e2e/seed.sql).
  const email = `e2e-admin-${testInfo.project.name}@naisema.test`;

  await page.goto(`${ADMIN}/admin`);
  await expect(page).toHaveURL(`${ADMIN}/admin/sign-in`);
  await expectNoAxeViolations(page);

  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  const link = latestEmailText(email).match(/https?:\/\/\S+/)?.[0];
  expect(link).toBeTruthy();
  await page.goto(link as string);
  await expect(page).toHaveURL(`${ADMIN}/admin/two-factor/setup`);
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Start setup" }).click();
  await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
  await expectNoAxeViolations(page);
  const key = (await page.locator("[data-totp-secret]").getAttribute("data-totp-secret")) as string;
  const code = await createOTP(new TextDecoder().decode(base32.decode(key))).totp();

  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByRole("heading", { name: "NAISEMA staff" })).toBeVisible();
  await expect(page.getByText("Administrator")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Manage staff and roles" }).click();
  await expect(page.getByRole("heading", { name: "Staff and roles" })).toBeVisible();
  await expectNoAxeViolations(page);
});
