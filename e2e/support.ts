import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import AxeBuilder from "@axe-core/playwright";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { expect, type Page } from "@playwright/test";

export const ADMIN = "http://admin.localhost:4173";

/** Where the preview server keeps its local D1 database (miniflare's state under .wrangler). */
const D1_DIRECTORY = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";

/**
 * The text of the latest email sent to `email`, from the local outbox.
 *
 * The preview server's workerd owns the live database file, and a second process opening it
 * (as `wrangler d1 execute --local` does) makes the server's own queries fail now and then with
 * an internal error. So the file and its write-ahead log are copied with plain file reads, which
 * take no SQLite locks, and the copy is queried. A copy taken before the email was written is
 * tried again.
 */
export async function latestEmailText(email: string, attempts = 10): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const text = readOutboxCopy(email);
    if (text !== null) return text;
    if (attempt >= attempts) throw new Error(`No email to ${email} in the local outbox`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

function readOutboxCopy(email: string): string | null {
  const name = readdirSync(D1_DIRECTORY).find((file) => /^[0-9a-f]{64}\.sqlite$/.test(file));
  if (!name) throw new Error(`No local D1 database in ${D1_DIRECTORY}`);
  const copy = mkdtempSync(join(tmpdir(), "naisema-outbox-"));
  try {
    for (const suffix of ["", "-wal"]) {
      const source = join(D1_DIRECTORY, `${name}${suffix}`);
      if (existsSync(source)) copyFileSync(source, join(copy, `outbox.sqlite${suffix}`));
    }
    const db = new DatabaseSync(join(copy, "outbox.sqlite"));
    try {
      const row = db.prepare('SELECT text FROM email_outbox WHERE "to" = ? ORDER BY id DESC LIMIT 1').get(email) as
        | { text: string }
        | undefined;
      return row?.text ?? null;
    } finally {
      db.close();
    }
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
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
  const link = (await latestEmailText(email)).match(/https?:\/\/\S+/)?.[0];
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
