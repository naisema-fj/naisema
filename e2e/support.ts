import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { expect, type Page } from "@playwright/test";

export const ADMIN = "http://admin.localhost:4173";

/**
 * Reads the outbox from the local D1 file. The preview server writes to the same file, so a read can
 * meet its lock (SQLITE_BUSY); it is tried again after a short wait.
 */
export function latestEmailText(email: string, attempts = 4): string {
  let output: string;
  try {
    output = queryOutbox(email);
  } catch (error) {
    if (attempts <= 1 || !String(error).includes("SQLITE_BUSY")) throw error;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    return latestEmailText(email, attempts - 1);
  }
  return JSON.parse(output.slice(output.indexOf("[")))[0].results[0].text;
}

function queryOutbox(email: string) {
  return execFileSync(
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
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

/** Opens the emailed sign-in link for a seeded staff account. */
export async function followSignInLink(page: Page, email: string) {
  await page.goto(`${ADMIN}/admin/sign-in`);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const link = latestEmailText(email).match(/https?:\/\/\S+/)?.[0];
  expect(link).toBeTruthy();
  await page.goto(link as string);
}

/** Starts authenticator setup and returns the key the page shows, as a person would scan it. */
export async function startTwoFactorSetup(page: Page) {
  await page.getByRole("button", { name: "Start setup" }).click();
  await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
  return (await page.locator("[data-totp-secret]").getAttribute("data-totp-secret")) as string;
}

/** Enters the code an authenticator app holding `key` would show right now. */
export async function confirmTwoFactorCode(page: Page, key: string) {
  const code = await createOTP(new TextDecoder().decode(base32.decode(key))).totp();
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Confirm" }).click();
}
