import { expect, type Page, test } from "@playwright/test";
import { expectNoAxeViolations } from "./support";

const STORY = "/learn/e2e-market-talanoa";

const videoState = (page: Page) =>
  page.locator("video").evaluate((element: HTMLVideoElement) => ({
    time: element.currentTime,
    paused: element.paused,
    rate: element.playbackRate,
    tracks: Array.from(element.textTracks).map((track) => `${track.language}:${track.mode}`),
  }));

test("a visitor explores a video story's language: captions, transcript, meanings, replay, loop and speed (VAC-02)", async ({
  page,
}) => {
  // The story plays its footage and offers its Learning Layer; no account is needed.
  await page.goto(STORY);
  await expect(page.getByRole("heading", { name: "Talanoa at the market", level: 1 })).toBeVisible();
  await expect(page.locator("video")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("link", { name: "Greetings at the market" }).click();
  await expect(page.getByRole("heading", { name: "Greetings at the market", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to the story: Talanoa at the market" }).first()).toBeVisible();
  await page
    .locator("video")
    .evaluate((element: HTMLVideoElement) =>
      element.readyState >= 1 ? null : new Promise((done) => element.addEventListener("loadedmetadata", done)),
    );
  await expectNoAxeViolations(page);

  // Fijian and English captions switch independently, in all four combinations.
  const fijian = page.getByRole("button", { name: /^Fijian: / });
  const english = page.getByRole("button", { name: /^English: / });
  const transcript = page.getByRole("region", { name: "Transcript" });
  await expect(fijian).toHaveAttribute("aria-pressed", "true");
  await expect(english).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await videoState(page)).tracks).toEqual(["fj:showing", "en:showing"]);
  await english.click();
  await expect(english).toHaveText("English: off");
  await expect(transcript.getByText("I come from Suva.")).toHaveCount(0);
  await expect.poll(async () => (await videoState(page)).tracks).toEqual(["fj:showing", "en:hidden"]);
  await fijian.click();
  await expect.poll(async () => (await videoState(page)).tracks).toEqual(["fj:hidden", "en:hidden"]);
  await expect(transcript.getByText("Captions are off").first()).toBeVisible();
  await english.click();
  await expect.poll(async () => (await videoState(page)).tracks).toEqual(["fj:hidden", "en:showing"]);
  await expect(transcript.getByText("I come from Suva.")).toBeVisible();
  await fijian.click();

  // A Segment's time seeks the video there, and the transcript follows it.
  const second = transcript.getByRole("listitem", { name: "Segment 2" });
  await second.getByRole("button", { name: /0:02.000/ }).click();
  await expect.poll(async () => (await videoState(page)).time).toBeCloseTo(2, 1);
  await expect(second).toHaveAttribute("aria-current", "true");
  await expect(second.getByRole("button", { name: /0:02.000/ })).toBeFocused();

  // Replay plays one Segment and stops at its end; a loop goes round until stopped.
  const first = transcript.getByRole("listitem", { name: "Segment 1" });
  await first.getByRole("button", { name: "Replay Segment 1" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Replaying Segment 1." })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Replaying Segment 1." })).toHaveCount(0, { timeout: 6_000 });
  const stopped = await videoState(page);
  expect(stopped.paused).toBe(true);
  expect(stopped.time).toBeGreaterThan(1.8);
  expect(stopped.time).toBeLessThan(2.3);

  await first.getByRole("button", { name: "Loop Segment 1" }).click();
  const looping = page.getByRole("status").filter({ hasText: "Looping Segment 1." });
  await expect(looping).toBeVisible();
  await page.waitForTimeout(3_000);
  await expect(looping).toBeVisible();
  expect((await videoState(page)).time).toBeLessThan(2.3);
  await looping.getByRole("button", { name: "Stop" }).click();
  await expect(looping).toHaveCount(0);
  expect((await videoState(page)).paused).toBe(true);

  // Speed.
  await page.getByLabel("Slowest (0.5×)").check();
  await expect.poll(async () => (await videoState(page)).rate).toBe(0.5);

  // A word's meaning opens from the keyboard, takes focus, and Escape gives it back.
  const word = first.getByRole("button", { name: "bula vinaka" });
  await word.focus();
  await page.keyboard.press("Enter");
  const meaning = page.getByRole("dialog", { name: "Meaning of bula vinaka" });
  await expect(meaning).toBeFocused();
  await expect(meaning).toContainText("Here: Hello, to a friend");
  await expect(meaning).toContainText("Said: mBOO-la vee-NAH-ka");
  await expectNoAxeViolations(page);
  await page.keyboard.press("Escape");
  await expect(meaning).toHaveCount(0);
  await expect(word).toBeFocused();

  // Every meaning is also in the vocabulary list.
  await expect(page.getByRole("region", { name: "Vocabulary" })).toContainText("hello; good health");

  // It reflows at 320 px without sideways scrolling.
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("link", { name: "Back to the story: Talanoa at the market" }).first().click();
  await expect(page).toHaveURL(new RegExp(`${STORY}$`));
});
