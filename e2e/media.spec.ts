import { expect, test } from "@playwright/test";
import { confirmTwoFactorCode, expectNoAxeViolations, followSignInLink, startTwoFactorSetup } from "./support";

/** A 1×1 PNG. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("an Educator uploads to the media library: refused files never start, others wait for their scan", async ({
  page,
}, testInfo) => {
  await followSignInLink(page, `e2e-educator-${testInfo.project.name}@naisema.test`);
  await confirmTwoFactorCode(page, await startTwoFactorSetup(page));
  await page.getByRole("link", { name: "Media library" }).click();
  await expect(page.getByRole("heading", { name: "Media library" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page
    .getByLabel("File", { exact: true })
    .setInputFiles({ name: "setup.exe", mimeType: "application/x-msdownload", buffer: PNG });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("alert")).toContainText("Upload an MP4, MOV, MP3, M4A, PDF, JPEG, PNG or WebP file.");

  const name = `drua-${testInfo.project.name}-${Date.now()}.png`;
  await page.getByLabel("File", { exact: true }).setInputFiles({ name, mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("status").first()).toContainText(`${name} is uploaded and being scanned for viruses.`);
  const row = page.getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText("PNG image");
  await expect(row).toContainText("Being scanned for viruses");
  await expectNoAxeViolations(page);
});
