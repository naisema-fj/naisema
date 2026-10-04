import { expect, test } from "@playwright/test";
import { confirmTwoFactorCode, expectNoAxeViolations, followSignInLink, startTwoFactorSetup } from "./support";

// Its own client address per project, so this journey's sign-in doesn't use up the sign-in limit
// (5 email links a minute from one address) the other journeys share.
test.use({
  extraHTTPHeaders: async ({ baseURL: _ }, use, testInfo) => {
    await use({ "CF-Connecting-IP": testInfo.project.name === "desktop-chromium" ? "203.0.113.11" : "203.0.113.21" });
  },
});

/** An English WebVTT file with one cue at the first Segment's times. */
const ENGLISH = Buffer.from("WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHello, good to see you.\n");

test("an Educator builds Segments in the timeline editor: checked as they type, nudged, imported and saved", async ({
  page,
}, testInfo) => {
  const project = testInfo.project.name.split("-")[0];
  await followSignInLink(page, `e2e-author-${testInfo.project.name}@naisema.test`);
  await confirmTwoFactorCode(page, await startTwoFactorSetup(page));
  await page.getByRole("link", { name: "Learning Layers" }).click();
  await page.getByRole("link", { name: `Greetings ${project}` }).click();
  await expect(page.getByRole("heading", { name: `Greetings ${project}`, level: 1 })).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Segment 1" })).toBeVisible();
  await expectNoAxeViolations(page);

  // A new Segment needs its Fijian text, and the editor says so for that exact Segment.
  await page.getByRole("button", { name: "Add a Segment" }).click();
  const second = page.getByRole("listitem", { name: "Segment 2" });
  await expect(page.getByRole("link", { name: "Segment 2 needs its Fijian text." })).toBeVisible();
  await second.getByLabel("Fijian").fill("Ni sa yadra.");
  await expect(page.getByRole("link", { name: "Segment 2 needs its Fijian text." })).toHaveCount(0);

  // The up arrow moves a time 100 ms.
  const start = second.getByLabel("Start", { exact: true });
  await expect(start).toHaveValue("0:02.000");
  await start.press("ArrowUp");
  await start.press("ArrowUp");
  await expect(start).toHaveValue("0:02.200");

  // English imported from WebVTT fills the matching Segment as an unreviewed draft.
  await page.getByLabel("Import English translations").setInputFiles({
    name: "english.vtt",
    mimeType: "text/vtt",
    buffer: ENGLISH,
  });
  await expect(page.getByRole("status").filter({ hasText: "Filled 1 English translations" })).toBeVisible();
  const first = page.getByRole("listitem", { name: "Segment 1" });
  await expect(first.getByLabel("English translation")).toHaveValue("Hello, good to see you.");
  await expect(first.getByText("Unreviewed draft")).toBeVisible();

  // The preview shows the captions in either layout.
  await page.getByLabel("Landscape").check();
  await expect(page.locator(".layout-frame")).toHaveClass(/layout-landscape/);
  await page.getByLabel("Vertical (phone)").check();
  await expect(page.locator(".layout-frame")).toHaveClass(/layout-portrait/);

  await page.getByRole("button", { name: "Save a new revision" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved as revision 2." })).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Segment 2" }).getByLabel("Fijian")).toHaveValue("Ni sa yadra.");
  await expectNoAxeViolations(page);
});
