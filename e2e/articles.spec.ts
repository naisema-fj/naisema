import { expect, test } from "@playwright/test";
import { ADMIN, confirmTwoFactorCode, expectNoAxeViolations, followSignInLink, startTwoFactorSetup } from "./support";

test("an editor writes an article, revises it, compares revisions and restores one", async ({ page }, testInfo) => {
  const title = `Sevusevu ${testInfo.project.name} ${Date.now()}`;
  await followSignInLink(page, `e2e-editor-${testInfo.project.name}@naisema.test`);
  await confirmTwoFactorCode(page, await startTwoFactorSetup(page));
  await page.getByRole("main").getByRole("link", { name: "Content", exact: true }).click();
  await page.getByRole("link", { name: "Write a new article" }).click();
  await expect(page.getByRole("heading", { name: "New article" })).toBeVisible();

  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Summary").fill("How a visit begins.");
  await page.getByLabel("E2E Ceremonies").check();
  await page.getByLabel("Credit").fill("Words by the E2E suite");
  const body = page.getByRole("textbox", { name: "Body" });
  await expect(page.getByRole("toolbar", { name: "Formatting" })).toBeVisible();
  await body.click();
  await page.getByRole("button", { name: "Heading 2" }).click();
  await expect(page.getByRole("button", { name: "Heading 2" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.type("Bringing yaqona");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Offer the bundle with both hands.");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Callout" }).click();
  await expect(page.getByRole("button", { name: "Callout" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.type("Ask your host first.");
  await expect(body.locator("aside.callout")).toHaveText("Ask your host first.");
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Save first revision" }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("Editing revision 1.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Body" })).toContainText("Offer the bundle with both hands.");
  await expectNoAxeViolations(page);

  // Click at the end of the paragraph's last line: on a phone-width screen the sentence can wrap,
  // and End would only reach the end of the visual line that was clicked.
  const paragraph = page.getByRole("textbox", { name: "Body" }).getByText("Offer the bundle with both hands.");
  const box = await paragraph.boundingBox();
  if (!box) throw new Error("The paragraph to extend isn't on screen");
  await paragraph.click({ position: { x: box.width - 2, y: box.height - 4 } });
  await page.keyboard.press("End");
  await page.keyboard.type(" Then sit and listen.");
  await page.getByRole("button", { name: "Save new revision" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved as revision 2.");

  await page.getByRole("link", { name: "Revision history" }).click();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByText("Removed: Offer the bundle with both hands.")).toBeVisible();
  await expect(page.getByText("Added: Offer the bundle with both hands. Then sit and listen.")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Back to revision history" }).click();
  await page.getByRole("link", { name: "1", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bringing yaqona" })).toBeVisible();
  await expect(page.locator("aside.callout")).toHaveText("Ask your host first.");
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Back to revision history" }).click();
  await page.getByRole("button", { name: "Restore revision 1" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved as revision 3.");
  await expect(page.getByRole("textbox", { name: "Body" })).not.toContainText("Then sit and listen.");

  await page.getByRole("link", { name: "Rights Records" }).click();
  await page.getByLabel("Rights holder").fill("E2E Storyteller");
  await page.getByLabel("Publish", { exact: true }).check();
  await page.getByLabel("Evidence (PDF, JPEG, PNG or WebP, up to 10 MB)").setInputFiles({
    name: "permission.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\n% signed permission\n"),
  });
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Record Rights Record" }).click();
  await expect(page.getByRole("status")).toHaveText("Rights Record recorded.");
  await expect(page.getByRole("heading", { name: "E2E Storyteller: Current" })).toBeVisible();
  await page.getByRole("link", { name: `Back to ${title}` }).click();

  await page.getByRole("link", { name: "Review and publish revision 3" }).click();
  await expectNoAxeViolations(page);

  // What is missing before publishing is a short list near the top, with the action beside each item.
  const missing = page.getByRole("heading", { name: "Before revision 3 can be published" });
  await expect(missing).toBeVisible();
  await expect(page.getByRole("link", { name: "Submit revision 3 for review", exact: true })).toBeVisible();
  // It stays readable at 320 px, with nothing pushing the page sideways.
  await page.setViewportSize({ width: 320, height: 800 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expectNoAxeViolations(page);
  // A refusal appears inside the form it came from, and takes the focus.
  await page.getByRole("button", { name: "Publish revision 3" }).click();
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByRole("alert")).toContainText("hasn't been submitted for review");
  await page.getByRole("button", { name: "Submit revision 3 for review" }).click();
  await expect(page.getByRole("status")).toHaveText("Submitted for review.");
  await page.getByRole("button", { name: "Publish revision 3" }).click();
  await expect(page.getByRole("status")).toHaveText("Published.");
  await expectNoAxeViolations(page);

  // The search box in every page's header takes the person to what they typed, and keeps it.
  await page.getByRole("searchbox", { name: "Search content, media and directories" }).fill(title.toLowerCase());
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/search\?q=/);
  await expect(page.getByRole("heading", { name: "Content Items", level: 2 })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search content, media and directories" })).toHaveValue(
    title.toLowerCase(),
  );
  const found = page.getByRole("link", { name: title });
  await expect(found).toBeVisible();
  const searchOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(searchOverflow).toBeLessThanOrEqual(0);
  await expectNoAxeViolations(page);
  // Nothing found says so, and still passes axe.
  await page.getByRole("searchbox", { name: "Search content, media and directories" }).fill("zzzz-nothing-here");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Nothing found for")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.goBack();
  await found.click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // Several items can be chosen on the content list and withdrawn with one reason; the result says what happened.
  await page.goto(`${ADMIN}/admin/articles`);
  await page.getByLabel(`Choose ${title}`).check();
  await expectNoAxeViolations(page);
  await page.getByLabel("Why (required, kept in the audit log for each one)").fill("Retired by the E2E suite");
  await page.getByRole("button", { name: "Withdraw the Content Items I chose" }).click();
  await expect(page.getByRole("status")).toHaveText("Withdrew 1 of 1 Content Item.");
  await expect(
    page.getByRole("listitem").filter({ hasText: title }).filter({ hasText: "Done: Withdrawn." }),
  ).toBeVisible();
  const bulkOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(bulkOverflow).toBeLessThanOrEqual(0);
  await expectNoAxeViolations(page);
  // Nothing chosen is refused in words, and still passes axe.
  await page.goBack();
  // The browser may bring the earlier choice back with the page.
  await page.getByLabel(`Choose ${title}`).uncheck();
  await page.getByLabel("Why (required, kept in the audit log for each one)").fill("Nothing chosen");
  await page.getByRole("button", { name: "Archive the Content Items I chose" }).click();
  await expect(page.getByRole("alert")).toHaveText("Choose at least one item.");
  await expectNoAxeViolations(page);
});
