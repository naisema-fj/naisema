import { expect, test } from "@playwright/test";
import {
  confirmTwoFactorCode,
  expectNoAxeViolations,
  followSignInLink,
  latestEmailText,
  startTwoFactorSetup,
  stubTurnstile,
} from "./support";

/** A PDF small enough to send in one part. */
const PDF = Buffer.from("%PDF-1.7\nA story from Lakeba.\n");

test("a visitor sends an enquiry: refused answers are kept, success comes once stored", async ({ page }, testInfo) => {
  await stubTurnstile(page);
  const email = `e2e-visitor-${testInfo.project.name}-${Date.now()}@example.com`;
  await page.goto("/");
  await page.getByRole("link", { name: "Send us a message" }).first().click();
  await expect(page.getByRole("heading", { name: "Send us a message" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByLabel("Your name").fill("Mere Vula");
  await page.getByLabel("Your email address").fill(email);
  await page.getByLabel("Your message").fill("Bula! Is there a class in Lauan?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("alert").first()).toContainText("Nothing was sent");
  await expect(page.getByLabel("Your message")).toHaveValue("Bula! Is there a class in Lauan?");
  await expect(page.getByText("We can't take this without your agreement.")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByLabel("NAISEMA may keep what I send and use it to reply to me").check();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: "Thank you, it's been sent" })).toBeVisible();
  await expectNoAxeViolations(page);
  expect(await latestEmailText(email)).toContain("Bula! Is there a class in Lauan?");
});

test("a contributor is sent an upload link and sends their file into quarantine", async ({ page }, testInfo) => {
  await stubTurnstile(page);
  const email = `e2e-contributor-${testInfo.project.name}-${Date.now()}@example.com`;
  await page.goto("/forms/contribute");
  const name = `Litia Vula ${testInfo.project.name} ${Date.now()}`;
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Your email address").fill(email);
  await page.getByLabel("What you'd like to share").fill("My grandmother's meke, recorded in 1998.");
  await page.getByLabel("NAISEMA may keep what I send and use it to reply to me").check();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: "Thank you, it's been sent" })).toBeVisible();

  await followSignInLink(page, `e2e-intake-${testInfo.project.name}@naisema.test`);
  await confirmTwoFactorCode(page, await startTwoFactorSetup(page));
  await page.getByRole("link", { name: "Submissions" }).click();
  await expectNoAxeViolations(page);
  await page.getByRole("link", { name }).click();
  await expect(page.getByText("My grandmother's meke, recorded in 1998.")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Send an upload link" }).click();
  await expect(page.getByRole("status")).toContainText("An upload link has been emailed to them.");

  // The local database file can lag the server by a moment, so wait for the email to show up.
  let link: string | undefined;
  await expect
    .poll(async () => {
      link = (await latestEmailText(email)).match(/https?:\/\/[^/\s]+(\/upload\/\S+)/)?.[1];
      return link;
    })
    .toBeTruthy();
  await page.goto(link as string);
  await expect(page.getByRole("heading", { name: "Upload your files" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page
    .getByLabel("File", { exact: true })
    .setInputFiles({ name: "meke.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("status").first()).toContainText("meke.pdf is uploaded and being scanned for viruses.");
  await expect(page.getByRole("listitem").filter({ hasText: "meke.pdf" })).toContainText("Being checked for viruses");

  await page.getByRole("button", { name: "I've sent everything" }).click();
  await expect(page.getByRole("heading", { name: "Vinaka, that's everything" })).toBeVisible();
  await page.goto(link as string);
  await expect(page.getByRole("heading", { name: "This link no longer works" })).toBeVisible();
});
