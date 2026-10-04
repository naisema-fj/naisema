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

  // A video master Stream couldn't process: staff see why, and try again.
  const video = `e2e-vale-${testInfo.project.name.split("-")[0]}.mp4`;
  await page.getByRole("link", { name: `Video: Processing failed (${video})` }).click();
  await expect(page.getByRole("heading", { name: video })).toBeVisible();
  await expect(page.getByRole("status").first()).toContainText("The file was not recognized as a video.");
  await expect(page.getByText("720 × 1280 (Vertical)")).toBeVisible();
  await expectNoAxeViolations(page);
  // Here the local stand-in processes it at once; the preview plays through a short-lived link.
  await page.getByRole("button", { name: "Try processing again" }).click();
  await expect(page.getByRole("status").first()).toContainText("Ready to play");
  await expect(page.getByLabel(`Preview of ${video}`)).toHaveAttribute("src", /\/video\/master\?token=/);
  await expectNoAxeViolations(page);
});
