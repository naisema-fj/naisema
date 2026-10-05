import { expect, type Page, test } from "@playwright/test";
import { expectNoAxeViolations, latestEmailText, stubTurnstile } from "./support";

const PLAYER = "/learn/e2e-market-talanoa/language/e2e-layer-public";

/** Signs in through the form and the emailed link, as a learner would on any device. */
async function signIn(page: Page, email: string) {
  await stubTurnstile(page);
  await page.goto("/account/sign-in");
  await page.getByLabel("Your email address").fill(email);
  await page.getByLabel("I am 18 or older").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const link = (await latestEmailText(email)).match(/https?:\/\/\S+/)?.[0];
  expect(link).toBeTruthy();
  await page.goto(link as string);
  await expect(page.getByRole("heading", { name: "Your learning" })).toBeVisible();
}

const acknowledged = (page: Page) =>
  page.waitForResponse((response) => response.url().endsWith("/account/events") && response.ok());

test("a learner saves their learning, carries on from another device, and offline changes wait to be saved (VAC-04)", async ({
  page,
  browser,
}, testInfo) => {
  const email = `e2e-learner-${testInfo.project.name}-${Date.now()}@example.com`;

  // A visitor finds the optional account from the player. It is for adults only.
  await stubTurnstile(page);
  await page.goto(`${PLAYER}?stage=respond`);
  await page.getByRole("link", { name: "Save your learning with an optional account" }).click();
  await expect(page.getByRole("heading", { name: "Save your learning" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByLabel("Your email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("Learning accounts are for people aged 18 or older.")).toBeVisible();
  await expectNoAxeViolations(page);

  await signIn(page, email);
  await expect(page.getByText("your account is ready")).toBeVisible();
  await expect(page.getByText("Nothing yet.")).toBeVisible();
  await expectNoAxeViolations(page);

  // An answer in the player is saved to the account, and only then said to be saved.
  await page.goto(`${PLAYER}?stage=respond`);
  const progress = page.getByRole("complementary", { name: "Your progress" });
  await expect(progress.getByRole("status")).toHaveText("0 of 2 needed Activities done.");
  const question = page.getByRole("region", { name: "Activity 1" });
  await question.getByLabel("Suva").check();
  const answerSaved = acknowledged(page);
  await question.getByRole("button", { name: "Check my answer" }).click();
  await answerSaved;
  await expect(progress.getByRole("status")).toHaveText("1 of 2 needed Activities done.");
  await expect(page.getByText("Everything is saved to your account.")).toBeVisible();
  await expectNoAxeViolations(page);

  // Offline, a change waits on this device, says so, and is sent once the connection is back.
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Save this video" }).click();
  await expect(page.getByRole("button", { name: "Saved to your learning" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/^Not yet saved: \d+ changes? waiting\./)).toBeVisible();
  await expect(page.getByText("Everything is saved to your account.")).toHaveCount(0);
  await expectNoAxeViolations(page);
  await page.context().setOffline(false);
  await expect(page.getByText("Everything is saved to your account.")).toBeVisible({ timeout: 15_000 });

  // A word saved from Explore the words.
  await page
    .getByRole("link", { name: /Explore the words/ })
    .first()
    .click();
  // The progress shows once the page has read the account, so it is ready to use.
  await expect(progress.getByRole("status")).toHaveText("1 of 2 needed Activities done.");
  const words = page.getByRole("region", { name: "Words and meanings" });
  const wordSaved = acknowledged(page);
  await words.getByRole("button", { name: "Save bula vinaka" }).click();
  await wordSaved;
  await expect(words.getByRole("button", { name: "Saved bula vinaka" })).toHaveAttribute("aria-pressed", "true");

  // Another device: sign in there, and carry on from where they were.
  const other = await browser.newContext({ extraHTTPHeaders: testInfo.project.use.extraHTTPHeaders });
  const phone = await other.newPage();
  await signIn(phone, email);
  const learning = phone.getByRole("region", { name: "Carry on learning" });
  await expect(learning).toContainText("1 of 2 needed Activities done.");
  await expect(phone.getByRole("region", { name: "Saved videos" })).toContainText("Talanoa at the market");
  await expect(phone.getByRole("region", { name: "Saved words" })).toContainText("hello; good health");
  await expectNoAxeViolations(phone);
  await learning.getByRole("link", { name: "Greetings at the market" }).click();
  await expect(phone.getByRole("heading", { name: "Step 3 of 8: Explore the words" })).toBeVisible();
  const phoneProgress = phone.getByRole("complementary", { name: "Your progress" });
  await expect(phoneProgress.getByRole("status")).toHaveText("1 of 2 needed Activities done.");
  await expect(phoneProgress).toContainText("Answers right: 1 of 1.");

  // Signing out on the phone leaves the account, and its learning, as it was.
  await phone.goto("/account");
  await phone.getByRole("button", { name: "Sign out" }).click();
  await expect(phone).toHaveURL(/\/$/);
  await phone.goto("/account");
  await expect(phone.getByRole("heading", { name: "Save your learning" })).toBeVisible();
  await other.close();
  await page.goto("/account");
  await expect(page.getByRole("region", { name: "Carry on learning" })).toContainText("1 of 2 needed Activities done.");
});
