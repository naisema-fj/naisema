// The spike's player (issue #4, ADR-0008): a native <video> fed by hls.js, or by the browser's
// own HLS where it has one (Safari), replaying and looping one segment exactly. Throwaway code;
// it records what it sees on `window.spike` for measure.mjs and shows it on the page.
import Hls from "./node_modules/hls.js/dist/hls.mjs";

const video = document.getElementById("video");
const log = document.getElementById("log");
const params = new URLSearchParams(location.search);
const src = params.get("src") ?? "./media/vp9/landscape/master.m3u8";

/** In-memory segment data, as a Learning Layer Revision would hold it (ms). */
const segments = [
  { id: "s1", startMs: 4000, endMs: 7200, text: "Bula vinaka." },
  { id: "s2", startMs: 12000, endMs: 15500, text: "Au lako mai Suva." },
  { id: "s3", startMs: 21000, endMs: 23800, text: "Vinaka vakalevu." },
  { id: "s4", startMs: 40500, endMs: 44250, text: "Sa moce." },
];

const say = (line) => {
  log.textContent = `${line}\n${log.textContent}`.slice(0, 4000);
};

const state = {
  /** Milliseconds from navigation start to the first frame presented: the first playable frame. */
  firstFrameAt: null,
  levelSwitches: [],
  native: false,
};
let hls = null;

// --- Loading: hls.js where Media Source Extensions exist, else native HLS (Safari) ---
if (Hls.isSupported() && params.get("native") !== "1") {
  hls = new Hls({ capLevelToPlayerSize: false, startLevel: -1 });
  hls.loadSource(src);
  hls.attachMedia(video);
  hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
    state.levelSwitches.push({ level: data.level, at: video.currentTime });
    say(`level ${data.level} at ${video.currentTime.toFixed(3)} s`);
  });
  hls.on(Hls.Events.ERROR, (_event, data) => say(`hls error: ${data.type} ${data.details}${data.fatal ? " (fatal)" : ""}`));
} else if (video.canPlayType("application/vnd.apple.mpegurl")) {
  state.native = true;
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

// --- Frame-accurate observation: requestVideoFrameCallback where it exists, else timeupdate ---
const frameListeners = new Set();
if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
  const onFrame = (_now, metadata) => {
    if (state.firstFrameAt === null) {
      state.firstFrameAt = performance.now();
      say(`first frame after ${Math.round(state.firstFrameAt)} ms`);
    }
    for (const listener of frameListeners) listener(metadata.mediaTime);
    video.requestVideoFrameCallback(onFrame);
  };
  video.requestVideoFrameCallback(onFrame);
} else {
  video.addEventListener("timeupdate", () => {
    if (state.firstFrameAt === null && video.currentTime > 0) state.firstFrameAt = performance.now();
    for (const listener of frameListeners) listener(video.currentTime);
  });
}

/** Resolves once a seek has finished and the first frame at the new position is presented. */
function seekTo(seconds) {
  return new Promise((resolve) => {
    const onFrame = (mediaTime) => {
      frameListeners.delete(onFrame);
      resolve(mediaTime);
    };
    video.addEventListener("seeked", () => frameListeners.add(onFrame), { once: true });
    video.currentTime = seconds;
  });
}

/**
 * Plays one segment from its start to its end, `times` over, at a speed. Each pass records the
 * media time of the first frame shown after the seek to the start, and of the last frame shown
 * before stopping at the end, so the boundaries can be checked against the segment's own times.
 */
async function playSegment({ startMs, endMs, speed = 1, times = 1, onPass }) {
  video.defaultPlaybackRate = speed;
  video.playbackRate = speed;
  video.preservesPitch = true;
  const passes = [];
  const start = startMs / 1000;
  const end = endMs / 1000;
  for (let pass = 0; pass < times; pass++) {
    video.pause();
    const firstFrame = await seekTo(start);
    const lastFrame = await new Promise((resolve) => {
      let last = firstFrame;
      // Stop on the last frame that starts before the end: one more frame would overshoot.
      const onFrame = (mediaTime) => {
        last = mediaTime;
        if (mediaTime >= end - 1 / 60) {
          video.pause();
          frameListeners.delete(onFrame);
          resolve(last);
        }
      };
      frameListeners.add(onFrame);
      video.play().catch((error) => say(`play refused: ${error.message}`));
    });
    const result = { pass, speed, firstFrameMs: firstFrame * 1000, lastFrameMs: lastFrame * 1000 };
    passes.push(result);
    onPass?.(result);
    say(`pass ${pass + 1} at ${speed}×: ${result.firstFrameMs.toFixed(0)} → ${result.lastFrameMs.toFixed(0)} ms`);
  }
  return passes;
}

/** The caption the browser shows now (active cue), as the track sees it. */
const activeCue = () => {
  const cues = track.track.activeCues;
  return cues?.length ? cues[0].id : null;
};

/** Forces a different rendition at once (hls.js flushes the buffer and reloads from the playhead). */
function forceQualityChange() {
  if (!hls || hls.levels.length < 2) return null;
  const next = (hls.currentLevel + 1) % hls.levels.length;
  hls.currentLevel = next;
  say(`forcing level ${next}`);
  return next;
}

document.getElementById("replay").addEventListener("click", () => {
  playSegment({
    startMs: Number(document.getElementById("start").value),
    endMs: Number(document.getElementById("end").value),
    speed: Number(document.getElementById("speed").value),
  });
});
document.getElementById("loop").addEventListener("click", () => {
  playSegment({
    startMs: Number(document.getElementById("start").value),
    endMs: Number(document.getElementById("end").value),
    speed: Number(document.getElementById("speed").value),
    times: 10,
  });
});
document.getElementById("switch").addEventListener("click", forceQualityChange);

window.spike = {
  state,
  segments,
  playSegment,
  forceQualityChange,
  activeCue,
  levels: () => (hls ? hls.levels.map((level) => level.height) : []),
  currentLevel: () => (hls ? hls.currentLevel : null),
  ready: () => video.readyState >= 2,
  /** Calls `listener` with the media time of every frame presented, until the returned function is called. */
  watchFrames: (listener) => {
    frameListeners.add(listener);
    return () => frameListeners.delete(listener);
  },
};
