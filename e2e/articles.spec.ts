import { expect, test } from "@playwright/test";
import { confirmTwoFactorCode, expectNoAxeViolations, followSignInLink, startTwoFactorSetup } from "./support";

test("an editor writes an article, revises it, compares revisions and restores one", async ({ page }, testInfo) => {
  const title = `Sevusevu ${testInfo.project.name} ${Date.now()}`;
  await followSignInLink(page, `e2e-editor-${testInfo.project.name}@naisema.test`);
  await confirmTwoFactorCode(page, await startTwoFactorSetup(page));
  await page.getByRole("link", { name: "Content", exact: true }).click();
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

  await page.getByRole("textbox", { name: "Body" }).getByText("Offer the bundle with both hands.").click();
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
  await page.getByRole("button", { name: "Submit revision 3 for review" }).click();
  await expect(page.getByRole("status")).toHaveText("Submitted for review.");
  await page.getByRole("button", { name: "Publish revision 3" }).click();
  await expect(page.getByRole("status")).toHaveText("Published.");
  await expectNoAxeViolations(page);
});
