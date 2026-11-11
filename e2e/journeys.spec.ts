import { expect, test } from "@playwright/test";
import { ADMIN, EDITOR, expectNoAxeViolations, expectReflow, STAFF_HEADER, stubTurnstile } from "./support";

test("a visitor finds a Video and learns from its Learning Layer through all eight steps (VAC-02)", async ({
  page,
}) => {
  // A long journey: eight steps, each checked by axe, and reflow at two widths. 30 s is too tight on a busy runner.
  test.setTimeout(90_000);
  await page.goto("/learn");
  await expectNoAxeViolations(page);
  await page.getByRole("link", { name: "Talanoa at the market" }).click();
  await expect(page.getByRole("heading", { name: "Talanoa at the market", level: 1 })).toBeVisible();
  await expect(page.getByText("Language reviewed · Standard Fijian")).toBeVisible();
  // The labels explain themselves, on tap, with no hover needed.
  const labelHelp = page.getByText("What do these labels mean?");
  await labelHelp.click();
  await expect(page.getByText("someone who knows that form of Fijian checked the language")).toBeVisible();
  await expectNoAxeViolations(page);
  await expectReflow(page);

  await page.getByRole("link", { name: "Greetings at the market" }).click();
  await expect(page.getByRole("heading", { name: "Step 1 of 8: Watch naturally" })).toBeVisible();
  // Watching naturally sends no English at all.
  expect(await page.content()).not.toContain("Hello there");
  await expect
    .poll(() => page.locator("video").evaluate((element: HTMLVideoElement) => element.readyState))
    .toBeGreaterThan(0);
  await page.getByText("What do these controls do?").click();
  await expect(page.getByText("slow the video down to catch each word")).toBeVisible();
  await expectNoAxeViolations(page);

  const steps = page.getByRole("navigation", { name: "Steps", exact: true });
  // The player's progress appears once its script has started. Touching the page before then is
  // undone when the script takes over, so each step waits for it before using the player.
  const playerReady = () =>
    expect(page.getByRole("complementary", { name: "Your progress" }).getByRole("status")).toBeVisible();
  await steps.getByRole("link", { name: /English and context support/ }).click();
  await expect(page.getByRole("heading", { name: "Step 4 of 8: English and context support" })).toBeVisible();
  await expect(page.locator(".transcript-english").first()).toHaveText("Hello there");
  await expect(page.getByText("Markets open early on Saturday mornings.")).toBeVisible();
  await playerReady();
  await page.getByRole("button", { name: "ika", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Meaning of ika" })).toContainText("fish, at the market stall");
  await page.keyboard.press("Escape");
  await expectReflow(page);

  await steps.getByRole("link", { name: /Respond/ }).click();
  await expect(page.getByRole("heading", { name: /Step 7 of 8/ })).toBeVisible();
  await playerReady();
  // A wrong answer still counts as trying it: right answers aren't needed to complete.
  await page.getByRole("radio", { name: "Taro" }).check();
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(page.getByText("Not quite.")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "You've completed Greetings at the market." })).toBeVisible();
  await expectNoAxeViolations(page);

  // Progress stays on this device, through a reload.
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "You've completed Greetings at the market." })).toBeVisible();

  for (const step of [
    "Fijian captions",
    "Explore the words",
    "Listen again",
    "Repeat and practise",
    "Use it with someone",
  ]) {
    await steps.getByRole("link", { name: new RegExp(step) }).click();
    await expect(page.getByRole("heading", { level: 2, name: new RegExp(`Step \\d of 8: ${step}`) })).toBeVisible();
    await expectNoAxeViolations(page);
  }
});

test("a first-time visitor finds how NAISEMA works from the home page, and reaches the steps from the player", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "See how NAISEMA works" }).click();
  await expect(page.getByRole("heading", { name: "How NAISEMA works", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Learn from a video", level: 2 })).toBeVisible();
  // All eight steps are listed, and the page is usable by everyone.
  await expect(page.locator(".guide-steps li")).toHaveCount(8);
  await expectNoAxeViolations(page);
  await expectReflow(page);

  // From a step in the player, the same guide is one link away.
  await page.goto("/learn");
  await page.getByRole("link", { name: "Talanoa at the market" }).click();
  await page.getByRole("link", { name: "Greetings at the market" }).click();
  await page.getByRole("link", { name: "How the steps work" }).click();
  await expect(page).toHaveURL(/\/how-it-works#learn$/);
});

test("someone sends a message through a public form", async ({ page }) => {
  await stubTurnstile(page);
  await page.goto("/forms/enquiry");
  await expectNoAxeViolations(page);
  await page.getByLabel("Your name").fill("Mere");
  await page.getByLabel("Your email address").fill("mere@example.org");
  await page.getByLabel("Your message").fill("Bula! When do the first lessons open?");
  await page.getByLabel("I've read how NAISEMA keeps what I send").check();
  // Turnstile's script loads after the page and then adds its token; a person waits for the check
  // to finish before sending, so the test does too, or the form is rightly refused.
  await expect(page.locator('input[name="cf-turnstile-response"]')).toBeAttached();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: "Thank you, it's been sent" })).toBeVisible();
});

test.describe("the staff site", () => {
  test.use({ extraHTTPHeaders: { [STAFF_HEADER]: EDITOR } });

  test("an editor sees what needs them and opens the Video's Learning Layer", async ({ page }) => {
    await page.goto(`${ADMIN}/admin`);
    await expect(page.getByRole("heading", { name: "Bula, E2E Editor" })).toBeVisible();
    // Help sits on the page, opens on tap, and says what the person's own roles allow.
    await page.getByText("How this page works").click();
    await expect(page.getByText("Adds and edits content")).toBeVisible();
    await expectNoAxeViolations(page);
    // On a phone the navigation is inside the Menu disclosure; the page is the same either way.
    await page.goto(`${ADMIN}/admin/items`);
    await expect(page.getByRole("heading", { name: "Content", level: 1 })).toBeVisible();
    await expectReflow(page);
    await page.getByRole("link", { name: "Talanoa at the market" }).click();
    await expect(page.getByText("This version is published.")).toBeVisible();
    await page.getByText("What does this mean?").click();
    await expect(page.getByText("Nobody can approve a version they wrote")).toBeVisible();
    await page.getByText("What do the flags do?").click();
    await expect(page.getByText("Adds a Knowledge Holder Approval")).toBeVisible();
    await expectNoAxeViolations(page);
    await page.getByRole("link", { name: "Learning Layer" }).click();
    await expect(page.getByRole("heading", { name: "Learning Layer for Talanoa at the market" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("Greetings at the market");
  });
});

test("a staff member signs in with an emailed link and signs out", async ({ page }) => {
  await page.goto(`${ADMIN}/admin/items`);
  await expect(page.getByRole("heading", { name: "Sign in to NAISEMA staff" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByLabel("Your email address").fill(EDITOR);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expectNoAxeViolations(page);
  // Development sends no email, so the page offers the link itself.
  await page.getByRole("link", { name: "open the sign-in link" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Bula, E2E Editor" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to NAISEMA staff" })).toBeVisible();
  await page.goto(`${ADMIN}/admin`);
  await expect(page.getByRole("heading", { name: "Sign in to NAISEMA staff" })).toBeVisible();
});
