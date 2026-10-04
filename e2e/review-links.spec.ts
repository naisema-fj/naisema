import { expect, test } from "@playwright/test";
import { confirmTwoFactorCode, expectNoAxeViolations, followSignInLink, startTwoFactorSetup } from "./support";

// Its own client address per project, so this journey's sign-in doesn't use up the sign-in limit
// the other journeys share.
test.use({
  extraHTTPHeaders: async ({ baseURL: _ }, use, testInfo) => {
    await use({ "CF-Connecting-IP": testInfo.project.name === "desktop-chromium" ? "203.0.113.12" : "203.0.113.22" });
  },
});

const PDF = Buffer.from("%PDF-1.7\n% signed approval\n");

test("an editor shares a Learning Layer through a Review Link and records the Knowledge Holder's approval", async ({
  page,
  context,
}, testInfo) => {
  const project = testInfo.project.name.split("-")[0];
  await followSignInLink(page, `e2e-kh-editor-${testInfo.project.name}@naisema.test`);
  await confirmTwoFactorCode(page, await startTwoFactorSetup(page));

  // The editors' queue lists what is waiting for review.
  await page.getByRole("link", { name: "Learning Layers" }).click();
  const waiting = page.getByRole("region", { name: "Waiting for review" });
  await expect(waiting).toContainText("still needs Language review (standard-fijian), Knowledge Holder Approval");
  await waiting.getByRole("link", { name: `Review ${project}, revision 1` }).click();
  await expect(page.getByRole("heading", { name: `Review ${project}`, level: 1 })).toBeVisible();
  await expect(page.getByText("Issue a Review Link first")).toBeVisible();
  await expectNoAxeViolations(page);

  // A Review Link is shown once, to copy.
  await page.getByLabel("Who it is for").fill("Ratu Joni");
  await page.getByRole("button", { name: "Issue a Review Link" }).click();
  const issued = page.getByRole("status").filter({ hasText: "Copy it now" });
  await expect(issued).toBeVisible();
  const address = (await issued.locator("code").textContent()) as string;

  // The Knowledge Holder opens it: no sign-in, watermarked, the exact words and Activities.
  // Locally the address names the dev server's origin; the suite serves the public site at its base URL.
  const review = await context.newPage();
  await review.goto(new URL(address).pathname);
  await expect(review.getByText("Draft for review. Not published.")).toBeVisible();
  await expect(review.getByRole("heading", { name: `Review ${project}`, level: 1 })).toBeVisible();
  await expect(review.getByText("Listen, then say it aloud.")).toBeVisible();
  await expectNoAxeViolations(review);
  await review.close();

  // Back on the revision, the opened link is how the approval says they saw it.
  await page.reload();
  await expect(page.getByRole("table").filter({ hasText: "Ratu Joni" })).toContainText("Once");
  await page.getByLabel("The Review Link they saw it through").selectOption({ index: 0 });
  await page.getByLabel("Knowledge Holder", { exact: true }).fill("Ratu Joni Madraiwiwi");
  await page.getByLabel("How they gave approval").fill("In person at Lomanikoro");
  await page.getByLabel("Conditions").fill("Not for advertising.");
  await page
    .getByLabel(/Evidence \(optional/)
    .setInputFiles({ name: "approval.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByRole("button", { name: "Record approval" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Knowledge Holder Approval recorded." })).toBeVisible();
  await expect(page.getByText(/seen through the Review Link for Ratu Joni/).first()).toBeVisible();
  await expectNoAxeViolations(page);
});
