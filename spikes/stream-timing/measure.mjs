// Measures the spike's player against issue #4's checks, in Chromium through Playwright.
//
// Setup, once: run `pnpm install` at the repository root (this script uses its Playwright), then
// `npm ci` in this folder (hls.js), then build the clips with make-clips.sh. Then:
//
//   PLAYWRIGHT_CHROMIUM_EXECUTABLE=... SEGMENT=s2 node measure.mjs [vp9|h264] [--loops-only]
//
// SEGMENT is one of player.js's segments: s2 starts on a keyframe, s5 between keyframes.
// 1. Cold start: five runs per clip on the agreed profile (1.5 Mbps down, 150 ms latency), each in
//    a fresh browser context; the first frame shown while playing must arrive within 5 s in at
//    least four. Skipped with --loops-only.
// 2. Loops: the segment played 10 times at 1×, 0.75× and 0.5×; the first and last frame shown in
//    every pass (including any shown after the stop) must be within ±100 ms of its start and end.
//    The segment's caption must become active within 100 ms of its start and stay active to within
//    100 ms of its end.
// 3. Quality changes: a rendition switch forced mid-pass, up and then down, at every speed; no
//    frame may be shown outside the segment.
// 4. Interruptions: the network dropped for 4 s while a buffered segment loops, and while seeking
//    to a segment not yet buffered (s6), then restored; playback must carry on or recover.
// Results go to results/<codec>-<segment>-<time>.json and a summary is printed.
import { createReadStream, mkdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";
import { chromium } from "@playwright/test";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const CODEC = process.argv[2] ?? "vp9";
const LOOPS_ONLY = process.argv.includes("--loops-only");
const INTERRUPTIONS_ONLY = process.argv.includes("--interruptions-only");
const QUALITY_ONLY = process.argv.includes("--quality-only");
// MAX_BUFFER=N buffers only N s ahead on the main page, so a smooth switch takes effect within the segment.
const MAIN_QUERY = process.env.MAX_BUFFER ? `&maxBuffer=${Number(process.env.MAX_BUFFER)}` : "";
const MODES = (process.env.MODES ?? "smooth,immediate").split(",");
const SEGMENT_ID = process.env.SEGMENT ?? "s2";
const CLIPS = ["landscape", "vertical"];
const SPEEDS = [1, 0.75, 0.5];
const PROFILE = {
  offline: false,
  latency: 150,
  downloadThroughput: (1.5e6 / 8) | 0,
  uploadThroughput: (0.75e6 / 8) | 0,
};
const OFFLINE = { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
const TOLERANCE_MS = 100;
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".m4s": "video/iso.segment",
  ".mp4": "video/mp4",
};

/** A static server for this folder, compressing text and answering byte ranges, as a CDN would. */
function serve() {
  const server = createServer((request, response) => {
    let path;
    try {
      path = normalize(join(ROOT, decodeURIComponent(new URL(request.url, "http://x").pathname)));
    } catch {
      return response.writeHead(400).end();
    }
    if (!path.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) return response.writeHead(403).end();
    let size;
    try {
      const stats = statSync(path);
      if (!stats.isFile()) return response.writeHead(404).end();
      size = stats.size;
    } catch {
      return response.writeHead(404).end();
    }
    const headers = { "Content-Type": TYPES[extname(path)] ?? "application/octet-stream", "Accept-Ranges": "bytes" };
    const range = /bytes=(\d+)-(\d*)/.exec(request.headers.range ?? "");
    if (range) {
      const start = Number(range[1]);
      const end = Math.min(range[2] ? Number(range[2]) : size - 1, size - 1);
      if (start > end) return response.writeHead(416, { "Content-Range": `bytes */${size}` }).end();
      response.writeHead(206, {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": end - start + 1,
      });
      return createReadStream(path, { start, end }).pipe(response);
    }
    if (/\.(html|m?js|m3u8)$/.test(path) && /gzip/.test(request.headers["accept-encoding"] ?? "")) {
      response.writeHead(200, { ...headers, "Content-Encoding": "gzip" });
      return createReadStream(path).pipe(createGzip()).pipe(response);
    }
    response.writeHead(200, { ...headers, "Content-Length": size });
    createReadStream(path).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function openPlayer(browser, origin, clip, query = "") {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", PROFILE);
  page.on("pageerror", (error) => console.error("page error:", error.message));
  await page.goto(`${origin}/index.html?src=./media/${CODEC}/${clip}/master.m3u8${query}`);
  await page.evaluate(() => {
    document.getElementById("video").muted = true;
  });
  return { context, page, cdp };
}

async function coldStarts(browser, origin, clip) {
  const runs = [];
  for (let run = 0; run < 5; run++) {
    const { context, page } = await openPlayer(browser, origin, clip);
    await page.evaluate(() =>
      document
        .getElementById("video")
        .play()
        .catch(() => undefined),
    );
    const firstFrameMs = await page
      .waitForFunction(() => window.spike?.state.firstPlayingFrameAt, null, { timeout: 30_000 })
      .then((handle) => handle.jsonValue())
      .catch(() => null);
    runs.push(firstFrameMs === null ? null : Math.round(firstFrameMs));
    console.log(`  run ${run + 1}: ${runs.at(-1)} ms`);
    await context.close();
  }
  const within5s = runs.filter((ms) => ms !== null && ms <= 5000).length;
  return { runs, within5s, ok: within5s >= 4 };
}

/** How far each pass's first and last frame, and its caption, were from the segment's edges. */
function boundaries(segment, passes) {
  const completed = passes.filter((pass) => !pass.stalled);
  const startErrors = completed.map((pass) => pass.firstFrameMs - segment.startMs);
  const endErrors = completed.map((pass) => pass.lastFrameMs - segment.endMs);
  const cueEntry = completed.map((pass) => (pass.cueFirstMs === null ? null : pass.cueFirstMs - segment.startMs));
  const cueExit = completed.map((pass) => (pass.cueLastMs === null ? null : pass.cueLastMs - segment.endMs));
  const worst = Math.max(0, ...startErrors.map(Math.abs), ...endErrors.map(Math.abs));
  const cueWorst = Math.max(
    0,
    ...[...cueEntry, ...cueExit].map((ms) => (ms === null ? Number.POSITIVE_INFINITY : Math.abs(ms))),
  );
  const stalled = passes.length - completed.length;
  return {
    startErrors,
    endErrors,
    framesAfterStop: completed.map((pass) => pass.framesAfterStop),
    cueEntry,
    cueExit,
    worstMs: worst,
    cueWorstMs: cueWorst,
    stalled,
    ok: stalled === 0 && worst <= TOLERANCE_MS && cueWorst <= TOLERANCE_MS,
  };
}

const play = (page, segment, speed, times) =>
  page.evaluate(({ segment, speed, times }) => window.spike.playSegment({ ...segment, speed, times }), {
    segment,
    speed,
    times,
  });

async function loops(page, segment) {
  const results = {};
  for (const speed of SPEEDS) {
    console.log(`  loops at ${speed}×`);
    results[speed] = boundaries(segment, await play(page, segment, speed, 10));
  }
  return results;
}

/** Plays three passes, forcing a rendition change half-way through the second, and watches every frame. */
async function forcedChange(page, segment, speed, direction, mode) {
  return page.evaluate(
    async ({ segment, speed, direction, mode }) => {
      const outside = [];
      const video = document.getElementById("video");
      const watch = () => {
        const ms = video.currentTime * 1000;
        if (!video.paused && (ms < segment.startMs - 100 || ms > segment.endMs + 100)) outside.push(Math.round(ms));
      };
      video.addEventListener("timeupdate", watch);
      const before = window.spike.currentLevel();
      const loop = window.spike.playSegment({ ...segment, speed, times: 3 });
      await new Promise((resolve) => setTimeout(resolve, ((segment.endMs - segment.startMs) / speed) * 1.5 + 300));
      const forcedAtMs = Math.round(video.currentTime * 1000);
      const errorsBefore = window.spike.state.errors.length;
      const switchesBefore = window.spike.state.levelSwitches.length;
      const forced = window.spike.forceQualityChange(direction, mode);
      const passes = await loop;
      video.removeEventListener("timeupdate", watch);
      return {
        before,
        forced,
        forcedAtMs,
        outside,
        passes,
        errors: window.spike.state.errors.slice(errorsBefore),
        switches: window.spike.state.levelSwitches.slice(switchesBefore),
      };
    },
    { segment, speed, direction, mode },
  );
}

async function qualityChanges(page, segment) {
  const results = {};
  for (const mode of MODES) {
    for (const speed of SPEEDS) {
      console.log(`  ${mode} quality changes at ${speed}×`);
      const up = await forcedChange(page, segment, speed, 1, mode);
      const down = await forcedChange(page, segment, speed, -1, mode);
      results[`${mode} ${speed}`] = [up, down].map((run) => {
        const checked = boundaries(segment, run.passes);
        const forcedInside = run.forcedAtMs >= segment.startMs && run.forcedAtMs <= segment.endMs;
        return {
          mode,
          levels: `${run.before} → ${run.forced}`,
          forcedAtMs: run.forcedAtMs,
          forcedInside,
          framesOutsideSegment: run.outside.length,
          worstMs: checked.worstMs,
          stalled: checked.stalled,
          startErrors: checked.startErrors,
          endErrors: checked.endErrors,
          largestJumpMs: Math.max(...run.passes.map((pass) => pass.largestJumpMs ?? 0)),
          hlsErrors: run.errors.map((error) => error.details),
          switches: run.switches,
          ok: forcedInside && run.outside.length === 0 && checked.ok,
        };
      });
    }
  }
  return results;
}

/**
 * Drops the network for 4 s during a buffered loop, then while seeking to a segment not yet
 * buffered. A fresh page buffers only 6 s ahead, so the far segment (s6) really is unloaded; that
 * is checked before the network drops.
 */
async function interruptions(browser, origin, clip, segment) {
  console.log("  interruptions");
  const { context, page, cdp } = await openPlayer(browser, origin, clip, "&maxBuffer=6");
  try {
    await page.waitForFunction(() => window.spike?.ready(), null, { timeout: 30_000 });
    const far = await page.evaluate(() => window.spike.segment("s6"));
    const buffered = play(page, segment, 1, 3);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await cdp.send("Network.emulateNetworkConditions", OFFLINE);
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await cdp.send("Network.emulateNetworkConditions", PROFILE);
    const bufferedResult = boundaries(segment, await buffered);

    const farWasBuffered = await page.evaluate((ms) => window.spike.buffered(ms), far.startMs);
    await cdp.send("Network.emulateNetworkConditions", OFFLINE);
    const started = Date.now();
    let finishedAt = null;
    const unbuffered = play(page, far, 1, 1).then((passes) => {
      finishedAt = Date.now();
      return passes;
    });
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const finishedWhileOffline = finishedAt !== null;
    await cdp.send("Network.emulateNetworkConditions", PROFILE);
    const restoredAt = Date.now();
    const farPasses = await unbuffered;
    return {
      whileLoopingBuffered: bufferedResult,
      seekingUnbuffered: {
        ...boundaries(far, farPasses),
        farWasBuffered,
        finishedWhileOffline,
        offlineMs: restoredAt - started,
        finishedAfterRestoreMs: finishedAt - restoredAt,
      },
      hlsErrors: await page.evaluate(() => window.spike.state.errors),
    };
  } finally {
    await context.close();
  }
}

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch({ executablePath, args: ["--autoplay-policy=no-user-gesture-required"] });
const server = await serve();
const origin = `http://127.0.0.1:${server.address().port}`;
const report = {
  codec: CODEC,
  segmentId: SEGMENT_ID,
  maxBuffer: process.env.MAX_BUFFER ?? null,
  modes: MODES,
  browser: browser.version(),
  profile: PROFILE,
  clips: {},
};
try {
  for (const clip of CLIPS) {
    console.log(`${clip}: cold starts`);
    const only = INTERRUPTIONS_ONLY || QUALITY_ONLY;
    const cold = LOOPS_ONLY || only ? null : await coldStarts(browser, origin, clip);
    const { context, page } = await openPlayer(browser, origin, clip, MAIN_QUERY);
    await page.waitForFunction(() => window.spike?.ready(), null, { timeout: 30_000 });
    const segment = await page.evaluate((id) => window.spike.segment(id), SEGMENT_ID);
    if (!segment) throw new Error(`No segment "${SEGMENT_ID}" in player.js`);
    report.segment = segment;
    report.clips[clip] = {
      coldStarts: cold,
      loops: only ? {} : await loops(page, segment),
      qualityChanges: INTERRUPTIONS_ONLY ? {} : await qualityChanges(page, segment),
    };
    await context.close();
    if (!QUALITY_ONLY) report.clips[clip].interruptions = await interruptions(browser, origin, clip, segment);
  }
} finally {
  await browser.close();
  server.close();
}

mkdirSync(join(ROOT, "results"), { recursive: true });
const file = join(ROOT, "results", `${CODEC}-${SEGMENT_ID}-${new Date().toISOString().replaceAll(":", "-")}.json`);
writeFileSync(file, JSON.stringify(report, null, 2));
for (const [clip, result] of Object.entries(report.clips)) {
  console.log(`\n${clip}`);
  if (result.coldStarts) {
    console.log(
      `  first frame playing (ms): ${result.coldStarts.runs.join(", ")} → ${result.coldStarts.within5s}/5 within 5 s`,
    );
  }
  for (const [speed, loop] of Object.entries(result.loops)) {
    console.log(
      `  ${speed}×: worst ${loop.worstMs} ms, ${loop.stalled} stalled; start ${loop.startErrors.join(" ")}; end ${loop.endErrors.join(" ")}; after stop ${loop.framesAfterStop.join(" ")}; caption in ${loop.cueEntry.join(" ")}, out ${loop.cueExit.join(" ")}`,
    );
  }
  for (const [key, runs] of Object.entries(result.qualityChanges)) {
    for (const run of runs) {
      console.log(
        `  quality ${key}× ${run.levels} (largest jump ${run.largestJumpMs} ms) at ${run.forcedAtMs} ms: outside ${run.framesOutsideSegment}, worst ${run.worstMs} ms, ${run.stalled} stalled, ${run.ok ? "ok" : "FAILED"}; start ${run.startErrors.join(" ")}; end ${run.endErrors.join(" ")}; switched ${run.switches.map((change) => `${change.level}@${change.atMs}`).join(" ")}; hls ${run.hlsErrors.join(" ") || "none"}`,
      );
    }
  }
  const drop = result.interruptions;
  if (!drop) continue;
  const seek = drop.seekingUnbuffered;
  console.log(
    `  offline while looping: worst ${drop.whileLoopingBuffered.worstMs} ms, ${drop.whileLoopingBuffered.stalled} stalled; offline seek (far segment buffered beforehand: ${seek.farWasBuffered}): ${seek.stalled ? "stalled" : seek.finishedWhileOffline ? "finished while still offline" : `finished ${seek.finishedAfterRestoreMs} ms after restore, worst ${seek.worstMs} ms`}; hls errors ${drop.hlsErrors.map((error) => error.details + (error.fatal ? "!" : "")).join(", ") || "none"}`,
  );
}
console.log(`\nwritten to ${file}`);
