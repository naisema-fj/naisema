// Measures the spike's player against issue #4's checks, in Chromium through Playwright:
//
//   PLAYWRIGHT_CHROMIUM_EXECUTABLE=... node measure.mjs [vp9|h264]
//
// 1. Cold start: five runs per clip on the agreed profile (1.5 Mbps down, 150 ms latency), each in
//    a fresh browser context; the first playable frame must arrive within 5 s in at least four.
// 2. Loops: one segment played 10 times at 1×, 0.75× and 0.5×; every pass's first and last frame
//    must be within ±100 ms of the segment's start and end, with no drift across passes.
// 3. Quality change: a rendition switch forced mid-segment must keep the playhead in the segment.
// 4. Captions: the native <track> built from the segment data shows the segment's cue throughout.
// Results go to results/<codec>-<time>.json and a summary is printed.
import { createReadStream, mkdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = new URL(".", import.meta.url).pathname;
const CODEC = process.argv[2] ?? "vp9";
const CLIPS = ["landscape", "vertical"];
const SEGMENT = { startMs: 12000, endMs: 15500 };
const SPEEDS = [1, 0.75, 0.5];
const PROFILE = { offline: false, latency: 150, downloadThroughput: (1.5e6 / 8) | 0, uploadThroughput: (0.75e6 / 8) | 0 };
const TOLERANCE_MS = 100;
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".m4s": "video/iso.segment",
  ".mp4": "video/mp4",
};

/** A static server for the spike folder, with byte ranges, as a CDN would answer. */
function serve() {
  const server = createServer((request, response) => {
    const path = normalize(join(ROOT, decodeURIComponent(new URL(request.url, "http://x").pathname)));
    if (!path.startsWith(ROOT)) return response.writeHead(403).end();
    let size;
    try {
      size = statSync(path).size;
    } catch {
      return response.writeHead(404).end();
    }
    const headers = { "Content-Type": TYPES[extname(path)] ?? "application/octet-stream", "Accept-Ranges": "bytes" };
    const range = /bytes=(\d+)-(\d*)/.exec(request.headers.range ?? "");
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Number(range[2]) : size - 1;
      response.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
      return createReadStream(path, { start, end }).pipe(response);
    }
    response.writeHead(200, { ...headers, "Content-Length": size });
    createReadStream(path).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function openPlayer(browser, origin, clip) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", PROFILE);
  page.on("pageerror", (error) => console.error("page error:", error.message));
  await page.goto(`${origin}/index.html?src=./media/${CODEC}/${clip}/master.m3u8`);
  return { context, page };
}

async function coldStarts(browser, origin, clip) {
  const runs = [];
  for (let run = 0; run < 5; run++) {
    const { context, page } = await openPlayer(browser, origin, clip);
    await page.evaluate(() => {
      const video = document.getElementById("video");
      video.muted = true;
      return video.play().catch(() => undefined);
    });
    const firstFrameMs = await page
      .waitForFunction(() => window.spike?.state.firstFrameAt, null, { timeout: 30_000 })
      .then((handle) => handle.jsonValue())
      .catch(() => null);
    runs.push(firstFrameMs === null ? null : Math.round(firstFrameMs));
    await context.close();
  }
  return { runs, within5s: runs.filter((ms) => ms !== null && ms <= 5000).length, passes: runs.filter((ms) => ms !== null && ms <= 5000).length >= 4 };
}

async function loops(page) {
  const results = {};
  for (const speed of SPEEDS) {
    const passes = await page.evaluate(
      async ({ segment, speed }) => {
        const video = document.getElementById("video");
        video.muted = true;
        const cueMisses = [];
        let inside = 0;
        const stop = window.spike.watchFrames((mediaTime) => {
          const ms = mediaTime * 1000;
          // Away from the edges (where "time marches on" may lag a frame or two) the cue must show.
          if (ms > segment.startMs + 250 && ms < segment.endMs - 250) {
            inside += 1;
            if (window.spike.activeCue() !== "s2") cueMisses.push(Math.round(ms));
          }
        });
        const result = await window.spike.playSegment({ ...segment, speed, times: 10 });
        stop();
        return { passes: result, cueFrames: inside, cueMisses };
      },
      { segment: SEGMENT, speed },
    );
    const startErrors = passes.passes.map((pass) => Math.round(pass.firstFrameMs - SEGMENT.startMs));
    const endErrors = passes.passes.map((pass) => Math.round(SEGMENT.endMs - pass.lastFrameMs));
    const worst = Math.max(...startErrors.map(Math.abs), ...endErrors.map(Math.abs));
    results[speed] = {
      startErrors,
      endErrors,
      worstMs: worst,
      passes: worst <= TOLERANCE_MS,
      cueFrames: passes.cueFrames,
      cueMisses: passes.cueMisses,
    };
  }
  return results;
}

async function qualityChange(page) {
  return page.evaluate(async (segment) => {
    const video = document.getElementById("video");
    video.muted = true;
    const outside = [];
    const stop = window.spike.watchFrames((mediaTime) => {
      const ms = mediaTime * 1000;
      if (ms < segment.startMs - 100 || ms > segment.endMs + 100) outside.push(Math.round(ms));
    });
    const before = window.spike.currentLevel();
    let forcedAtMs = null;
    const loop = window.spike.playSegment({ ...segment, speed: 1, times: 3 });
    // Mid-way through the second pass.
    await new Promise((resolve) => setTimeout(resolve, (segment.endMs - segment.startMs) * 1.5));
    forcedAtMs = Math.round(video.currentTime * 1000);
    const forced = window.spike.forceQualityChange();
    const passes = await loop;
    stop();
    return {
      levels: window.spike.levels(),
      before,
      forced,
      after: window.spike.currentLevel(),
      forcedAtMs,
      framesOutsideSegment: outside,
      passes: passes.map((pass) => ({
        startErrorMs: Math.round(pass.firstFrameMs - segment.startMs),
        endErrorMs: Math.round(segment.endMs - pass.lastFrameMs),
      })),
      switches: window.spike.state.levelSwitches,
    };
  }, SEGMENT);
}

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch({ executablePath, args: ["--autoplay-policy=no-user-gesture-required"] });
const server = await serve();
const origin = `http://127.0.0.1:${server.address().port}`;
const report = { codec: CODEC, browser: browser.version(), profile: PROFILE, segment: SEGMENT, clips: {} };
for (const clip of CLIPS) {
  console.log(`${clip}: cold starts`);
  const cold = await coldStarts(browser, origin, clip);
  console.log(`${clip}: loops`);
  const { context, page } = await openPlayer(browser, origin, clip);
  await page.waitForFunction(() => window.spike?.ready(), null, { timeout: 30_000 });
  const loopResults = await loops(page);
  console.log(`${clip}: quality change`);
  const quality = await qualityChange(page);
  await context.close();
  report.clips[clip] = { coldStarts: cold, loops: loopResults, qualityChange: quality };
}
await browser.close();
server.close();

mkdirSync(join(ROOT, "results"), { recursive: true });
const file = join(ROOT, "results", `${CODEC}-${new Date().toISOString().replaceAll(":", "-")}.json`);
writeFileSync(file, JSON.stringify(report, null, 2));
for (const [clip, result] of Object.entries(report.clips)) {
  console.log(`\n${clip}`);
  console.log(`  first frame (ms): ${result.coldStarts.runs.join(", ")} → ${result.coldStarts.within5s}/5 within 5 s`);
  for (const [speed, loop] of Object.entries(result.loops)) {
    console.log(
      `  ${speed}×: worst ${loop.worstMs} ms; start ${loop.startErrors.join(" ")}; end ${loop.endErrors.join(" ")}; cue missing on ${loop.cueMisses.length}/${loop.cueFrames} frames`,
    );
  }
  const q = result.qualityChange;
  console.log(
    `  quality: level ${q.before} → forced ${q.forced} at ${q.forcedAtMs} ms; frames outside segment: ${q.framesOutsideSegment.length}; passes ${JSON.stringify(q.passes)}`,
  );
}
console.log(`\nwritten to ${file}`);
