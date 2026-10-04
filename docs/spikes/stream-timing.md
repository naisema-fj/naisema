# Spike: segment replay and loop timing with hls.js (issue #4)

**Question (PRD §31, ADR-0008):** can a native `<video>` element fed by hls.js, rather than Stream's iframe player, replay and loop an exact segment at 1×, 0.75× and 0.5× without drift? Does it survive quality changes and interruptions, keep a WebVTT track from our own segment data aligned, and start fast enough on the agreed network profile?

**Short answer:** on the player side, yes, with one rule production must follow. Every boundary measured was within one frame (33 ms), against a ±100 ms tolerance. Captions turned on and off with the segment's frames. Playback came through the network dropping. hls.js's own quality switching never disturbed a segment.

The rule is that forcing an *immediate* quality switch (`hls.currentLevel`) mid-segment can skip a whole 2-second fragment and overshoot the segment by 500 ms, so production must not use it (see "Quality changes").

Cloudflare Stream itself, H.264, Safari and real phones are still untested. See "Not yet tested".

The prototype and the measurement harness are in `spikes/stream-timing/` (throwaway code). The raw results are in `docs/spikes/stream-timing-results/`.

## What was measured

| | |
| --- | --- |
| Player | Native `<video>`, hls.js 1.6.13 light build (minified, compressed), captions as a native `<track>` built from in-memory segment data |
| Browser | Chromium 141 (Playwright), headless |
| Network | Chrome's network emulation: 1.5 Mbps down, 0.75 Mbps up, 150 ms latency, cache disabled. No packet loss or jitter. |
| Clips | Placeholder test pattern with a tone, 60 s at 30 fps: landscape 1280×720 and vertical 720×1280 |
| Encoding | HLS, fMP4, 2 s segments, keyframe every 2 s; three renditions (about 350 kbps, 800 kbps and 1.8 Mbps), **VP9 and Opus** (see "Not yet tested") |
| Segments | `s2`: 12 000 → 15 500 ms, starting on a keyframe and ending on a frame. `s5`: 27 340 → 30 890 ms, starting between keyframes and ending between frames (the hard case) |

**How each pass is measured.** The player seeks to the segment's start and plays at once. It records, from `requestVideoFrameCallback`, the media time of every frame actually shown:
- **first frame:** the first frame shown after the seek, whether presented while still paused or once playing;
- **last frame:** the last frame shown, including any shown after the stop, watched for 300 ms;
- **caption timing:** the first and last frame on which the segment's cue was active.

It stops on the last frame that starts at or before the segment's end, judged from the frame interval.

## Results

**First playable frame:** the first frame shown *while playing*, from navigation start. Five cold runs per clip, each in a fresh browser context:

| Clip | Runs (ms) | Within 5 s |
| --- | --- | --- |
| Landscape | 3318, 3319, 3331, 3330, 3337 (and 3525, 3334, 3328, 3316, 3339 in the second run) | 10 of 10 |
| Vertical | 3329, 3333, 3311, 3312, 3301 (and 3310, 3313, 3324, 3305, 3300) | 10 of 10 |

The target is at least 4 of 5 within 5 s, so both clips pass.

**Loops:** 10 passes at each speed, both clips. Errors are the frame's media time minus the segment's edge: negative means before it.

| Segment | Speed | First frame | Last frame | Frames after the stop | Caption on | Caption off | Stalls |
| --- | --- | --- | --- | --- | --- | --- | --- |
| s2 | 1× | 0 or +33 | 0 | 0 | 0 or +33 | 0 | 0 |
| s2 | 0.75× | 0 | 0 | 0 | 0 | 0 or −33 | 0 |
| s2 | 0.5× | 0 | 0 | 0 | 0 | 0 | 0 |
| s5 | 1× | −7 or +27 | −23 | 0 | −7 or +27 | −23 | 0 |
| s5 | 0.75× | −7 (vertical also +27) | −23 | 0 | −7 (vertical also +27) | −23 | 0 |
| s5 | 0.5× | −7 | −23 | 0 | −7 | −23 | 0 |

- **Every boundary was within one frame, and there was no drift.** Each pass seeks afresh, so drift couldn't build up between passes. What the ten passes show is that every pass lands the same way. A seek between keyframes landed on the right frame: −7 ms is the frame at 27 333 ms, which is showing at 27 340.
- **No frame was shown after a stop.** The stop rule ends on the last frame that starts before the end: on s5 that is the frame at 30 867 ms, 23 ms before the 30 890 ms end.
- **Sometimes the first frame reported is the next one** (+33 or +27 ms), at 1× and 0.75× but never at 0.5×. `requestVideoFrameCallback` can't tell whether the earlier frame was shown without being reported, or skipped as playback started. Either way the error is one frame.
- **Captions turned on with the segment's first frame and off with its last.** The −33 ms "off" on s2 is correct WebVTT behaviour: a cue isn't active at exactly its end time, so the frame at 15 500 ms shows no caption. The track was in `hidden` mode, so this measures when the browser treats the cue as active, not how it draws captions on screen.

**Quality changes:** a rendition change forced mid-way through the second of three passes, up and then down, at every speed, on both clips.

| Kind of switch | Result |
| --- | --- |
| Smooth (`hls.nextLevel`, how hls.js's own adaptive switching works): switches at the next fragment and keeps what is buffered | All 24 runs passed (s2, both clips, with the usual 30 s buffer and with only 4 s buffered ahead). No step between frames was larger than 67 ms, and boundaries stayed within one frame. Already-buffered content plays out at its old quality, so in a short looping segment the new quality only arrives later. |
| Immediate (`hls.currentLevel`): empties the buffer and reloads from the playhead | Fails when the switch lands near a fragment boundary (here, about 14.0 s). The playhead skipped a whole fragment, jumping about 2 s from 14 to 16, and the last frame shown was 16 000 ms, **500 ms past the segment's end**. This happened in 7 of 12 runs on s2 at 1×, 0.75× and 0.5×, and in none of the 12 on s5, whose switch fell mid-fragment. |

**Interruptions:** the network was dropped for 4 s twice per clip.

- **While a buffered segment looped:** all three passes completed normally, worst boundary 33 ms. Playback runs from the buffer.
- **While seeking to a segment not yet buffered** (s6, 55 000 → 58 000 ms, on a page buffering only 6 s ahead, confirmed unbuffered first): playback waited, then recovered by itself once the network returned. The 3-second segment finished 4.6–4.7 s after the network came back, with exact boundaries. hls.js reported only retryable errors (`fragLoadError`, `bufferStalledError`), none fatal, so the spike's recovery code was never needed.

## What production should do

1. **Never force an immediate quality switch.** A quality menu should set `hls.nextLevel` (or `loadLevel`), never `hls.currentLevel`. As a guard, the segment player should treat any frame past the segment's end as the end: stop there, and seek back if the frame is more than one frame beyond it.
2. **Ship the light hls.js build as a lazy, compressed chunk.** The first spike runs loaded the unminified module (1.3 MB) and took 10.1 s to a first frame, about 7 s of it downloading the script. The light build (108 KB compressed) brought it to about 3.3 s. Captions are our own `<track>`, so we need none of the full build's DRM or subtitle parsing.
3. **Start playing straight after a seek.** Waiting, while paused, for the frame a seek presents can hang: that frame may be presented before the `seeked` event fires, after which nothing more is presented. The first spike run hung this way.
4. **Take boundaries from `requestVideoFrameCallback`'s `mediaTime`,** and stop on the last frame that starts at or before the end. `timeupdate` fires only every 15–250 ms, too coarse for ±100 ms; a browser without `requestVideoFrameCallback` would need timers scheduled against `currentTime`.
5. **Keep hls.js's error recovery** (restart loading after a fatal network error, `recoverMediaError` after a fatal media error). It wasn't needed here, but longer outages than 4 s will reach it.
6. **Video pages need content security policy additions.** hls.js attaches media through a `blob:` URL (Media Source Extensions), so they need `media-src blob:`. They also need `connect-src` for Stream's hosts. The spike's caption track was a `blob:` URL; production can add cues with the `TextTrack` API (`addCue` with `VTTCue`) instead.
7. **Segments need no keyframe alignment.** A segment can start and end wherever the Educator puts it.

## Not yet tested (needs a person, an account or a device)

- **Cloudflare Stream:** signed playback URLs, Stream's own encoding ladder, its segment length and its CDN. This sandbox can't reach Cloudflare and has no credentials, so the clips were local HLS ladders served by a local server. Stream's segment length and renditions will change the start-up time and where fragment boundaries fall, but not the browser-side looping.
- **H.264:** Stream delivers H.264, which open-source Chromium can't play, so these runs used VP9. Seeking and playback rate should behave the same, but the H.264 path should be measured: `make-clips.sh h264` builds the same ladders.
- **Safari's native HLS:** `player.js` uses it automatically where hls.js isn't needed. That path also needs its `preservesPitch`, `requestVideoFrameCallback` and caption behaviour checked, and whether an immediate switch can happen there at all.
- **Real devices on the agreed profile:** a mid-range Android phone and an older iPhone, five cold runs each (docs/decision-log.md, "Test profile"). These runs used headless Chromium with network emulation, which has no packet loss or jitter.
- **Audio boundaries:** whether the segment's sound starts and stops with its frames was not measured. Nor was whether pitch is preserved at 0.75× and 0.5×: the code sets `preservesPitch`, which Chromium honours, but it needs a listener.
- **Captions on screen:** how the browser draws them, and the outages longer than 4 s that would reach the fatal-error recovery.

To repeat the automated runs, follow the setup at the top of `spikes/stream-timing/measure.mjs`. To check a real Stream clip by hand, open `spikes/stream-timing/index.html?src=<signed HLS URL>` in each browser and use its Replay, Loop and quality buttons.

## Recommendation

**ADR-0008 holds for the player, on one condition: never force an immediate quality switch.**
- A native `<video>` with hls.js replays and loops exact segments at every required speed, within one frame and with no drift.
- It keeps our own WebVTT aligned to the frame.
- It rides out network drops, and it isn't disturbed by hls.js's own quality switching, on the agreed network profile in Chromium.

The remaining risk is Stream-specific (signed playback, its encodes and start-up time) and device-specific (Safari, real phones). Neither changes the architecture, but both should be checked with a Stream account before #16 relies on them.
