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
  // The story plays its footage and offers its Learning Layer; no account is needed. Its first
  // address fails, as an expired one would, and the player asks for a new one.
  let failed = false;
  await page.route("**/videos/*/stream*", (route) => {
    if (failed) return route.continue();
    failed = true;
    return route.fulfill({ status: 403, body: "expired" });
  });
  const renewed = page.waitForRequest((request) => /\/videos\/[^/]+\/playback$/.test(request.url()));
  await page.goto(STORY);
  await renewed;
  await expect
    .poll(() => page.locator("video").evaluate((element: HTMLVideoElement) => element.readyState))
    .toBeGreaterThan(0);
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
  const fijian = page.getByRole("button", { name: "Fijian", exact: true });
  const english = page.getByRole("button", { name: "English", exact: true });
  const transcript = page.getByRole("region", { name: "Transcript" });
  await expect(fijian).toHaveAttribute("aria-pressed", "true");
  await expect(english).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await videoState(page)).tracks).toEqual(["fj:showing", "en:showing"]);
  await english.click();
  await expect(english).toHaveText("English: off");
  await expect(english).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await videoState(page)).tracks).toEqual(["fj:showing", "en:hidden"]);
  await fijian.click();
  await expect.poll(async () => (await videoState(page)).tracks).toEqual(["fj:hidden", "en:hidden"]);
  // The transcript keeps both languages whatever the captions show.
  await expect(transcript.getByText("I come from Suva.")).toBeVisible();
  await english.click();
  await expect.poll(async () => (await videoState(page)).tracks).toEqual(["fj:hidden", "en:showing"]);
  await fijian.click();

  // A Segment's time seeks the video there, and the transcript follows it.
  const line = (name: string) =>
    transcript.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
  const second = line("Line 2");
  await second.getByRole("button", { name: /0:02.000/ }).click();
  await expect.poll(async () => (await videoState(page)).time).toBeCloseTo(2, 1);
  await expect(second).toHaveAttribute("aria-current", "true");
  await expect(second.getByRole("button", { name: /0:02.000/ })).toBeFocused();

  // Replay plays one line and stops at its end, at normal speed and at half speed.
  const first = line("Line 1");
  const replayed = page.getByRole("status").filter({ hasText: "Replaying line 1." });
  for (const speed of ["Normal", "Slowest (0.5×)"]) {
    await page.getByLabel(speed).check();
    await first.getByRole("button", { name: "Replay line 1" }).click();
    await expect(replayed).toBeVisible();
    await expect(replayed).toHaveCount(0, { timeout: 8_000 });
    const stopped = await videoState(page);
    expect(stopped.paused).toBe(true);
    expect(stopped.time).toBeGreaterThan(1.8);
    expect(stopped.time).toBeLessThan(2.3);
  }
  expect((await videoState(page)).rate).toBe(0.5);

  // A loop goes round until stopped: the playhead passes through the line, then starts it again.
  await page.getByLabel("Normal").check();
  await first.getByRole("button", { name: "Loop line 1" }).click();
  const looping = page.getByRole("status").filter({ hasText: "Looping line 1." });
  await expect(looping).toBeVisible();
  const times: number[] = [];
  for (let sample = 0; sample < 20; sample++) {
    times.push((await videoState(page)).time);
    await page.waitForTimeout(200);
  }
  expect(Math.max(...times)).toBeGreaterThan(1.2);
  expect(times.some((time, at) => at > 0 && time < times[at - 1] - 0.5)).toBe(true);
  expect(Math.max(...times)).toBeLessThan(2.3);
  await looping.getByRole("button", { name: "Stop" }).click();
  await expect(looping).toHaveCount(0);
  expect((await videoState(page)).paused).toBe(true);

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

  // Every meaning is also listed beside the transcript.
  const meanings = page.getByRole("region", { name: "Words and meanings" });
  await expect(meanings).toContainText("Generally: hello; good health");
  await expect(meanings).toContainText("Here: Hello, to a friend");

  await page.getByRole("link", { name: "Back to the story: Talanoa at the market" }).first().click();
  await expect(page).toHaveURL(new RegExp(`${STORY}$`));
});
