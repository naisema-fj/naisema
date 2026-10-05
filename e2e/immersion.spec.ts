import { expect, type Page, test } from "@playwright/test";
import { expectNoAxeViolations } from "./support";

const PLAYER = "/learn/e2e-market-talanoa/language/e2e-layer-public";

const tracks = (page: Page) =>
  page
    .locator("video")
    .evaluate((element: HTMLVideoElement) =>
      Array.from(element.textTracks).map((track) => `${track.language}:${track.mode}`),
    );

const step = (page: Page, name: RegExp) =>
  page.getByRole("navigation", { name: "Steps", exact: true }).getByRole("link", { name }).click();

test("a visitor follows the immersion route: hidden captions, help, Activities, retries and completion (VAC-03)", async ({
  page,
}) => {
  // Every learning event carries the Learning Layer's IDs and fixed names only.
  const events: Record<string, unknown>[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/language/e2e-layer-public/events")) {
      events.push(JSON.parse(request.postData() ?? "{}"));
    }
  });

  // 1. Watch naturally: no captions, no transcript, and no English anywhere on the page.
  await page.goto(PLAYER);
  await expect(page.getByRole("heading", { name: "Step 1 of 8: Watch naturally" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Watch naturally/ })).toHaveAttribute("aria-current", "step");
  await expect.poll(() => tracks(page)).toEqual(["fj:hidden"]);
  await expect(page.getByRole("region", { name: "Transcript" })).toHaveCount(0);
  expect(await page.content()).not.toContain("I come from Suva.");
  await expect(page.getByText("kept only on this device, until you close this tab")).toBeVisible();
  await expectNoAxeViolations(page);

  // Help is always there, and reveals one line's English only when asked.
  await page.getByRole("button", { name: "Need help?" }).click();
  const help = page.locator("#stage-help");
  await expect(help).toContainText("Asking for help never counts against you.");
  await help.getByRole("button", { name: "Show the English for line 1" }).click();
  await expect(help.getByRole("status")).toHaveText("Line 1 in English: Hello.");
  await help.getByRole("button", { name: "Show the transcript" }).click();
  const transcript = page.getByRole("region", { name: "Transcript" });
  await expect(transcript).toContainText("Ni sa bula vinaka.");
  await expect(transcript).toContainText("Hello.");
  await expect(transcript).not.toContainText("I come from Suva.");
  await expectNoAxeViolations(page);

  // 2. Fijian captions on, English still off the page.
  await page.getByRole("link", { name: "Next step: Fijian captions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Step 2 of 8: Fijian captions" })).toBeVisible();
  await expect.poll(() => tracks(page)).toEqual(["fj:showing"]);
  await expect(page.getByRole("button", { name: "English", exact: true })).toHaveCount(0);
  expect(await page.content()).not.toContain("Hello.");

  // 3. Explore the words: meanings, but not the lines' English.
  await page.getByRole("link", { name: "Next step: Explore the words", exact: true }).click();
  await expect(page.getByRole("region", { name: "Words and meanings" })).toContainText("Generally: hello; good health");
  expect(await page.content()).not.toContain("I come from Suva.");

  // 4. English and context support.
  await step(page, /English and context support/);
  await expect.poll(() => tracks(page)).toEqual(["fj:showing", "en:showing"]);
  await expect(page.getByRole("region", { name: "Culture and context" })).toContainText(
    "The market is where families catch up on news.",
  );
  await expect(page.getByRole("region", { name: "Culture and context" })).toContainText(
    "From Mere, a stallholder in Suva",
  );
  await expectNoAxeViolations(page);

  // 5. Listen again without English: captions off, English gone again.
  await step(page, /Listen again without English/);
  await expect.poll(() => tracks(page)).toEqual(["fj:hidden"]);
  expect(await page.content()).not.toContain("I come from Suva.");
  expect(await page.content()).not.toContain("Hello.");

  // 6. Repeat and practise: saying it aloud is never checked or recorded.
  await step(page, /Repeat and practise/);
  const progress = page.getByRole("complementary", { name: "Your progress" });
  await expect(progress.getByRole("status")).toHaveText("0 of 2 needed Activities done.");
  const repeat = page.getByRole("region", { name: "Activity 1" });
  await expect(repeat).toContainText("Listen to Mere, then say her greeting aloud.");
  await repeat.getByRole("button", { name: "I've said it" }).click();
  await expect(repeat.getByRole("status")).toContainText("Say: Ni sa bula vinaka.");
  await expect(progress.getByRole("status")).toHaveText("1 of 2 needed Activities done.");
  // Listening discrimination, optional, checked like a question.
  const discrimination = page.getByRole("region", { name: "Activity 2" });
  await expect(discrimination).toContainText("Which place does Sera name?");
  await expect(discrimination.getByRole("button", { name: "Play the line" })).toBeVisible();
  await discrimination.getByLabel("Suva").check();
  await discrimination.getByRole("button", { name: "Check my answer" }).click();
  await expect(discrimination.getByRole("status")).toContainText("That's right.");
  await expect(progress).toContainText("Answers right: 1 of 1.");
  await expectNoAxeViolations(page);

  // 7. Respond, by the text route: a wrong answer, a retry, then the right one.
  await step(page, /Respond/);
  // The progress shows once the page has read the session, so it is ready to use.
  await expect(progress.getByRole("status")).toHaveText("1 of 2 needed Activities done.");
  const question = page.getByRole("region", { name: "Activity 1" });
  await question.getByLabel("Use the text version").check();
  await expect(question).toContainText("Read the transcript, then choose where Sera comes from.");
  await question.getByLabel("Levuka").check();
  await question.getByRole("button", { name: "Check my answer" }).click();
  // A wrong answer keeps the right one back until asked, so trying again still means something.
  await expect(question.getByRole("status")).toContainText("Not quite.");
  await expect(question.getByRole("status")).not.toContainText("The answer is");
  // Answering, right or not, with its feedback seen completes the Learning Layer.
  await expect(progress.getByRole("status")).toHaveText("You've completed Greetings at the market.");
  await expect(progress).toContainText("Answers right: 1 of 2.");
  await question.getByRole("button", { name: "Show the answer" }).click();
  await expect(question.getByRole("status")).toContainText("The answer is: Suva.");
  await question.getByRole("button", { name: "Try again" }).click();
  await question.getByLabel("Suva").check();
  await question.getByRole("button", { name: "Check my answer" }).click();
  await expect(question.getByRole("status")).toContainText("That's right.");
  await expect(progress).toContainText("Answers right: 2 of 2.");
  await expect(progress.getByRole("status")).toHaveText("You've completed Greetings at the market.");
  // What would you say next: said aloud, then the model response.
  const nextLine = page.getByRole("region", { name: "Activity 2" });
  await expect(nextLine).toContainText("Mere greets you. What would you say back?");
  await nextLine.getByRole("button", { name: "I've said it" }).click();
  await expect(nextLine.getByRole("status")).toContainText("You could say: Io, bula vinaka.");
  await expect(progress).toContainText("Activities tried: 4.");

  // 8. Use it with someone: optional, private, and nothing to fill in about anyone.
  await step(page, /Use it with someone/);
  await expect(progress.getByRole("status")).toHaveText("You've completed Greetings at the market.");
  const prompt = page.getByRole("region", { name: "Activity 1" });
  await expect(prompt).toContainText("Greet someone you know in Fijian this week.");
  await expect(prompt.getByRole("textbox")).toHaveCount(0);
  await prompt.getByLabel("I tried it").check();
  await expect(progress).toContainText("Using it with someone: you tried it.");
  await expectNoAxeViolations(page);

  // Going back keeps everything for the session, and the steps show where the visitor has been.
  await step(page, /Watch naturally/);
  await expect(progress.getByRole("status")).toHaveText("You've completed Greetings at the market.");
  await expect(page.getByRole("link", { name: /Respond \(visited\)/ })).toBeVisible();

  // The accessibility preference keeps captions and the transcript on, even in a listening step.
  await progress.getByLabel("Always show the Fijian captions and the transcript").check();
  await step(page, /Listen again without English/);
  await expect.poll(() => tracks(page)).toEqual(["fj:showing"]);
  await expect(page.getByRole("region", { name: "Transcript" })).toContainText("Au lako mai Suva.");

  await expect.poll(() => events.map((event) => event.name)).toContain("learning_completed");
  expect(events.filter((event) => event.name === "learning_completed")).toHaveLength(1);
  for (const event of events) {
    expect(Object.keys(event).every((key) => ["name", "segmentId", "activityId", "support"].includes(key))).toBe(true);
  }
  expect(events).toContainEqual({ name: "activity_attempted", activityId: "aa1d2c3e-0000-4000-8000-000000000001" });
  expect(events).toContainEqual({ name: "feedback_viewed", activityId: "aa1d2c3e-0000-4000-8000-000000000002" });
  expect(events).toContainEqual({ name: "support_toggled", support: "english-line" });
});
