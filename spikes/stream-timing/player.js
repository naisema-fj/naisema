// The spike's player (issue #4, ADR-0008): a native <video> fed by hls.js, or by the browser's
// own HLS where it has one (Safari), replaying and looping one segment exactly. Throwaway code;
// it records what it sees on `window.spike` for measure.mjs and shows it on the page.
/* global Hls: the light build, loaded by index.html as an app would ship it. */

const video = document.getElementById("video");
const log = document.getElementById("log");
const params = new URLSearchParams(location.search);
const src = params.get("src") ?? "./media/vp9/landscape/master.m3u8";

/** In-memory segment data, as a Learning Layer Revision would hold it (ms). */
const segments = [
  // Starts on a keyframe (every 2 s) and ends on a frame (every 33.3 ms).
  { id: "s2", startMs: 12000, endMs: 15500, text: "Au lako mai Suva." },
  // Starts between keyframes and ends between frames: the hard case.
  { id: "s5", startMs: 27340, endMs: 30890, text: "Ni sa bula." },
  // Well past what has been buffered from the start, for the interruption test.
  { id: "s6", startMs: 55000, endMs: 58000, text: "Moce mada." },
];

const say = (line) => {
  log.textContent = `${line}\n${log.textContent}`.slice(0, 4000);
};

const state = {
  /** Milliseconds from navigation start to the first frame presented, playing or not. */
  firstFrameAt: null,
  /** Milliseconds from navigation start to the first frame presented while playing: the first playable frame. */
  firstPlayingFrameAt: null,
  levelSwitches: [],
  errors: [],
};
let hls = null;

// --- Loading: hls.js where Media Source Extensions exist, else native HLS (Safari) ---
if (Hls.isSupported() && params.get("native") !== "1") {
  // ?maxBuffer=N shortens how far ahead hls.js buffers, so a seek can land somewhere not yet loaded.
  const maxBuffer = Number(params.get("maxBuffer")) || 30;
  hls = new Hls({
    capLevelToPlayerSize: false,
    startLevel: -1,
    maxBufferLength: maxBuffer,
    maxMaxBufferLength: maxBuffer,
  });
  hls.loadSource(src);
  hls.attachMedia(video);
  hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
    state.levelSwitches.push({ level: data.level, atMs: Math.round(video.currentTime * 1000) });
    say(`level ${data.level} at ${video.currentTime.toFixed(3)} s`);
  });
  // Recovery, as production needs it: a fatal network error (the connection dropped for longer
  // than hls.js retries) restarts loading; a fatal media error asks hls.js to rebuild the buffer.
  hls.on(Hls.Events.ERROR, (_event, data) => {
    state.errors.push({ details: data.details, fatal: data.fatal });
    say(`hls error: ${data.type} ${data.details}${data.fatal ? " (fatal)" : ""}`);
    if (!data.fatal) return;
    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) setTimeout(() => hls.startLoad(), 1000);
    else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
  });
} else if (video.canPlayType("application/vnd.apple.mpegurl")) {
  video.src = src;
} else {
  say("This browser can play neither hls.js nor native HLS.");
}

// --- WebVTT built from the segment data, attached as a native <track> ---
const vttTime = (ms) => {
  const hours = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
  const minutes = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0");
  const seconds = String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}.${String(ms % 1000).padStart(3, "0")}`;
};
const vtt = `WEBVTT\n\n${segments
  .map((segment) => `${segment.id}\n${vttTime(segment.startMs)} --> ${vttTime(segment.endMs)}\n${segment.text}\n`)
  .join("\n")}`;
const track = document.createElement("track");
track.kind = "captions";
track.label = "Fijian";
track.srclang = "fj";
track.default = true;
track.src = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
video.append(track);
track.track.mode = "hidden";

/** The caption the browser treats as showing now (its active cue). */
const activeCue = () => {
  const cues = track.track.activeCues;
  return cues?.length ? cues[0].id : null;
};

// --- Frame-accurate observation: requestVideoFrameCallback where it exists, else timeupdate ---
const frameListeners = new Set();
const noteFrame = (mediaTime) => {
  const now = performance.now();
  if (state.firstFrameAt === null) state.firstFrameAt = now;
  if (state.firstPlayingFrameAt === null && !video.paused && mediaTime > 0) {
    state.firstPlayingFrameAt = now;
    say(`first frame while playing after ${Math.round(now)} ms`);
  }
  for (const listener of frameListeners) listener(mediaTime);
};
if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
  const onFrame = (_now, metadata) => {
    noteFrame(metadata.mediaTime);
    video.requestVideoFrameCallback(onFrame);
  };
  video.requestVideoFrameCallback(onFrame);
} else {
  video.addEventListener("timeupdate", () => noteFrame(video.currentTime));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Plays one segment from its start to its end, `times` over, at a speed, and records for each
 * pass what was actually on screen:
 * - the first frame presented after the seek to the start, whether it came while still paused or
 *   once playing (frames from before the seek are told apart by being nowhere near the start);
 * - the last frame presented, including any presented after the stop, watched for 300 ms;
 * - when the segment's caption became active and when it was last active.
 * It stops on the last frame that starts at or before the end, judged from the frame interval, so
 * the next frame would overshoot. A pass that doesn't reach its end in time is recorded as stalled.
 */
async function playSegment({ id, startMs, endMs, speed = 1, times = 1 }) {
  video.defaultPlaybackRate = speed;
  video.playbackRate = speed;
  video.preservesPitch = true;
  const passes = [];
  const start = startMs / 1000;
  const end = endMs / 1000;
  const allowanceMs = (endMs - startMs) / speed + 15_000;
  for (let pass = 0; pass < times; pass++) {
    video.pause();
    let first = null;
    let last = null;
    let previous = null;
    let step = 1 / 30;
    let cueFirst = null;
    let cueLast = null;
    let stopped = false;
    let afterStop = 0;
    let largestJump = 0;
    let reachedEnd = null;
    const ended = new Promise((resolve) => {
      reachedEnd = resolve;
    });
    const onFrame = (mediaTime) => {
      if (first === null) {
        if (Math.abs(mediaTime - start) > 0.5) return;
        first = mediaTime;
      }
      if (stopped) afterStop += 1;
      if (previous !== null) largestJump = Math.max(largestJump, mediaTime - previous);
      if (previous !== null && mediaTime - previous > 0 && mediaTime - previous < 0.2) step = mediaTime - previous;
      previous = mediaTime;
      last = Math.max(last ?? mediaTime, mediaTime);
      if (activeCue() === id) {
        cueFirst ??= mediaTime;
        cueLast = mediaTime;
      }
      if (!stopped && mediaTime + step > end + 0.001) {
        stopped = true;
        video.pause();
        reachedEnd();
      }
    };
    frameListeners.add(onFrame);
    const seeked = new Promise((resolve) => video.addEventListener("seeked", resolve, { once: true }));
    video.currentTime = start;
    await seeked;
    video.play().catch((error) => say(`play refused: ${error.message}`));
    const stalled = await Promise.race([ended.then(() => false), wait(allowanceMs).then(() => true)]);
    video.pause();
    await wait(300);
    frameListeners.delete(onFrame);
    const ms = (seconds) => (seconds === null ? null : Math.round(seconds * 1000));
    const result = {
      pass,
      speed,
      stalled,
      firstFrameMs: ms(first),
      lastFrameMs: ms(last),
      framesAfterStop: afterStop,
      /** The largest step forward between two frames shown: one frame normally, more after a skip. */
      largestJumpMs: Math.round(largestJump * 1000),
      cueFirstMs: ms(cueFirst),
      cueLastMs: ms(cueLast),
    };
    passes.push(result);
    say(
      stalled
        ? `pass ${pass + 1} at ${speed}×: stalled at ${video.currentTime.toFixed(3)} s`
        : `pass ${pass + 1} at ${speed}×: ${result.firstFrameMs} → ${result.lastFrameMs} ms`,
    );
  }
  return passes;
}

/**
 * Forces a different rendition. "immediate" (hls.currentLevel) switches now, emptying the buffer
 * and reloading from the playhead; "smooth" (hls.nextLevel) switches at the next fragment and keeps
 * what is buffered, as hls.js's own adaptive switching does.
 */
function forceQualityChange(direction = 1, mode = "immediate") {
  if (!hls || hls.levels.length < 2) return null;
  const count = hls.levels.length;
  const next = (((hls.currentLevel + direction) % count) + count) % count;
  if (mode === "smooth") hls.nextLevel = next;
  else hls.currentLevel = next;
  say(`forcing level ${next} (${mode})`);
  return next;
}

const fromForm = (times) => () =>
  playSegment({
    startMs: Number(document.getElementById("start").value),
    endMs: Number(document.getElementById("end").value),
    speed: Number(document.getElementById("speed").value),
    times,
  });
document.getElementById("replay").addEventListener("click", fromForm(1));
document.getElementById("loop").addEventListener("click", fromForm(10));
document.getElementById("switch").addEventListener("click", () => forceQualityChange());

window.spike = {
  state,
  segment: (id) => segments.find((segment) => segment.id === id) ?? null,
  playSegment,
  forceQualityChange,
  levels: () => (hls ? hls.levels.map((level) => level.height) : []),
  currentLevel: () => (hls ? hls.currentLevel : null),
  ready: () => video.readyState >= 2,
  /** Whether the media at this time is already buffered. */
  buffered: (ms) => {
    const seconds = ms / 1000;
    for (let range = 0; range < video.buffered.length; range++) {
      if (video.buffered.start(range) <= seconds && seconds <= video.buffered.end(range)) return true;
    }
    return false;
  },
};
