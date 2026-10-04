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

test("an Educator builds Segments and Activities in the timeline editor: checked as they type, previewed and saved", async ({
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

  // Annotate "Bula vinaka" with a new Expression, and add a cultural note with who it comes from.
  await first.getByRole("button", { name: "Bula", exact: true }).click();
  await first.getByRole("button", { name: "vinaka", exact: true }).click();
  await first.getByRole("button", { name: "Annotate “Bula vinaka”" }).click();
  // The library may already hold it from another run, which the form would choose; define one here.
  await first.getByLabel("Expression", { exact: true }).selectOption({ label: "A new Expression…" });
  await first.getByLabel("General meaning").fill(`hello; good health (${project})`);
  await first.getByLabel("What it means here").fill("A warm hello to a friend");
  await first.getByRole("button", { name: "Add the Annotation" }).click();
  await expect(first.getByRole("list", { name: "Annotations in Segment 1" })).toContainText("A warm hello to a friend");
  await first.getByRole("button", { name: /Add a cultural or context note/ }).click();
  await first.getByLabel("Note", { exact: true }).fill("Said with a smile and a nod.");
  await first.getByLabel("From (who the knowledge comes from)").fill("Mere Vula");
  const vocabulary = page.getByRole("region", { name: "Vocabulary list" });
  await expect(vocabulary).toContainText("bula vinaka");
  await expect(vocabulary).toContainText("“Bula vinaka” at 0:00.000");

  // The preview shows the captions in either layout.
  await page.getByLabel("Landscape").check();
  await expect(page.locator(".layout-frame")).toHaveClass(/layout-landscape/);
  await page.getByLabel("Vertical (phone)").check();
  await expect(page.locator(".layout-frame")).toHaveClass(/layout-portrait/);

  // A listen-and-repeat Activity needs its Segment, and the editor says so for that Activity.
  const activities = page.getByRole("region", { name: "Activities" });
  await expect(activities).toContainText("Nothing is required yet");
  await activities.getByLabel("New Activity").selectOption({ label: "Listen and repeat" });
  await activities.getByRole("button", { name: "Add an Activity" }).click();
  const repeat = activities.getByRole("listitem", { name: "Activity 1" });
  await expect(page.getByRole("link", { name: "Activity 1 needs the Segment to listen to and repeat." })).toBeVisible();
  await repeat.getByLabel("Practises").selectOption({ index: 1 });
  await repeat.getByLabel("Prompt").fill("Listen, then say it aloud.");
  await repeat.getByLabel("Words to repeat (Fijian)").fill("Bula vinaka");
  await repeat.getByLabel("Pronunciation guidance (optional)").fill("mBOO-la vee-NAH-ka");
  await repeat.getByLabel("Feedback (shown once the learner has answered)").fill("Soften the b, like mb.");
  await repeat.getByLabel(/Text alternative/).fill("Read “Bula vinaka” and write it out.");
  await expect(page.getByRole("region", { name: "Activities to check" })).toHaveCount(0);
  await expect(activities).toContainText("once they have tried the required Activity");

  // A real-world prompt is never required.
  await activities.getByLabel("New Activity").selectOption({ label: "Real-world prompt" });
  await activities.getByRole("button", { name: "Add an Activity" }).click();
  const realWorld = activities.getByRole("listitem", { name: "Activity 2" });
  await expect(realWorld.getByText("A real-world prompt is always optional")).toBeVisible();
  await expect(realWorld.getByLabel(/Required for completion/)).toHaveCount(0);
  await realWorld.getByLabel("Prompt").fill("Greet someone in Fijian this week.");
  await realWorld.getByLabel(/Text alternative/).fill("Write a greeting you could send to someone.");

  // The learner preview: saying it aloud (nothing is recorded) shows the model and the feedback,
  // which meets the Completion Rule; the text version is there too.
  await repeat.getByRole("button", { name: "Preview as a learner (Activity 1)" }).click();
  const preview = repeat.getByRole("region", { name: "Learner preview of Activity 1" });
  await expect(preview).toContainText("Nothing is recorded.");
  await preview.getByRole("button", { name: "I've said it" }).click();
  await expect(preview).toContainText("Pronunciation: mBOO-la vee-NAH-ka");
  await expect(activities.getByText("In your preview: the Learning Layer is complete.")).toBeVisible();
  await preview.getByLabel("Use the text version").check();
  await expect(preview).toContainText("Read “Bula vinaka” and write it out.");
  await expect(preview.getByLabel("Write it out")).toBeVisible();

  await page.getByRole("button", { name: "Save a new revision" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved as revision 2." })).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Segment 2" }).getByLabel("Fijian")).toHaveValue("Ni sa yadra.");
  await expect(page.getByRole("list", { name: "Annotations in Segment 1" })).toContainText("bula vinaka");
  await expect(page.getByRole("listitem", { name: "Activity 1" }).getByLabel("Prompt")).toHaveValue(
    "Listen, then say it aloud.",
  );
  await expect(page.getByRole("listitem", { name: "Activity 2" })).toContainText("Real-world prompt");
  await expectNoAxeViolations(page);

  // The new Expression is in the library for every Learning Layer to reuse.
  await page.goto(`${page.url().split("/admin/")[0]}/admin/expressions?q=bula`);
  await expect(page.getByRole("link", { name: "bula vinaka" }).first()).toBeVisible();
});
