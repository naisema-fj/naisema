# Spike: segment replay and loop timing with hls.js (issue #4)

**Question (PRD §31, ADR-0008):** can a native `<video>` element fed by hls.js, rather than Stream's iframe player, replay and loop an exact segment at 1×, 0.75× and 0.5× without drift? Does it survive quality changes, keep a WebVTT track from our own segment data aligned, and start fast enough on the agreed network profile?

**Short answer:** on the player side, yes, comfortably: every boundary measured was within 33 ms, against a ±100 ms tolerance. Cloudflare Stream itself, Safari and real phones are still untested. See "Not yet tested" below.

The prototype and the measurement harness are in `spikes/stream-timing/` (throwaway code; see its `make-clips.sh`, `player.js` and `measure.mjs`). The raw results are in `docs/spikes/stream-timing-results/`.

## What was measured

| | |
| --- | --- |
| Player | Native `<video>`, hls.js 1.6.13 light build (minified, compressed), captions as a native `<track>` built from in-memory segment data |
| Browser | Chromium 141 (Playwright), headless |
| Network | Chrome's network emulation: 1.5 Mbps down, 0.75 Mbps up, 150 ms latency, cache disabled |
| Clips | Placeholder test pattern with a tone, 60 s at 30 fps: landscape 1280×720 and vertical 720×1280 |
| Encoding | HLS, fMP4, 2 s segments, keyframe every 2 s; three renditions (about 350 kbps, 800 kbps and 1.8 Mbps), **VP9 and Opus** (see caveats) |
| Segments | `s2`: 12 000 → 15 500 ms, starting on a keyframe and ending on a frame. `s5`: 27 340 → 30 890 ms, starting between keyframes and ending between frames (the hard case) |

## Results

**First playable frame**, five cold runs per clip, each in a fresh browser context, from navigation start:

| Clip | Runs (ms) | Within 5 s |
| --- | --- | --- |
| Landscape | 3309, 3328, 3544, 3304, 3312 | 5 of 5 |
| Vertical | 3287, 3297, 3307, 3309, 3289 | 5 of 5 |

The target is at least 4 of 5 within 5 s, so both clips pass.

**Loops:** 10 passes of each segment at each speed. The figures are the error between each pass's first and last frame shown and the segment's start and end. A negative start error means the first frame shown starts slightly before the segment; a negative end error means the last frame shown starts slightly after it.

| Segment | Speed | Start error (ms) | End error (ms) | Worst | Stalls | Caption missing |
| --- | --- | --- | --- | --- | --- | --- |
| s2, landscape | 1× | 0 or 33 | 0 | 33 | 0 | 0 of 900 frames |
| s2, landscape | 0.75× | 0 | 0 | 0 | 0 | 0 of 900 |
| s2, landscape | 0.5× | 0 | 0 | 0 | 0 | 0 of 900 |
| s2, vertical | 1× | 0 or 33 | 0 | 33 | 0 | 0 of 900 |
| s2, vertical | 0.75× | 0 | 0 | 0 | 0 | 0 of 899 |
| s2, vertical | 0.5× | 0 | 0 | 0 | 0 | 0 of 900 |
| s5, landscape | 1× | −7 or 27 | −10 | 27 | 0 | 0 of 920 |
| s5, landscape | 0.75× | −7 or 27 | −10 | 27 | 0 | 0 of 920 |
| s5, landscape | 0.5× | −7 | −10 | 10 | 0 | 0 of 920 |
| s5, vertical | 1× | −7 or 27 | −10 | 27 | 0 | 0 of 920 |
| s5, vertical | 0.75× | −7 | −10 | 10 | 0 | 0 of 920 |
| s5, vertical | 0.5× | −7 | −10 | 10 | 0 | 0 of 920 |

- **Boundaries stayed within one frame** (33 ms at 30 fps), and the errors did not grow across ten passes, so there is no drift. Neither speed nor the position of keyframes made a difference: a seek between keyframes landed on the right frame.
- **The 0-or-33 ms start errors are the measurement, not the player.** Sometimes the frame at the start is shown while still paused, before the listener sees it, so the first frame observed is the next one.
- **The −10 ms end is the stop rule:** it shows the frame at 30 900 ms, which starts 10 ms after the 30 890 ms end. The production rule should stop on the last frame that starts at or before the end.
- **Quality changes:** a rendition switch forced mid-way through the second of three passes (level 1 to level 2, at about 13.75 s and 29.0 s) left no frame outside the segment, and the passes either side kept the same boundaries. hls.js's ABR also moved from the lowest to the middle rendition at startup without disturbing anything.
- **Captions:** the cue built from the segment data was active on every frame inside the segment, at every speed, away from the 250 ms at each edge where "time marches on" may lag. The edges themselves weren't measured.

## What the spike changed, and what production should do

1. **The player script is most of the cold start.** The first runs, which loaded the unminified hls.js module (1.3 MB), took 10.1 s, about 7 s of it downloading the script. The light build is 108 KB compressed and brought the first frame to about 3.3 s. Production should ship the light build (we need no DRM or subtitle parsing, because captions are our own `<track>`), compressed, as a cacheable chunk loaded only on pages with a video.
2. **Start playing straight after a seek.** Waiting, while paused, for the frame a seek presents can hang. That frame may be presented before the `seeked` event fires, after which nothing more is presented. The first spike run hung this way.
3. **Use `requestVideoFrameCallback`'s `mediaTime` for boundaries.** It reports each frame actually shown. `timeupdate` fires only every 15–250 ms, which is too coarse at ±100 ms; a browser without `requestVideoFrameCallback` would need timers scheduled against `currentTime`.
4. **The content security policy needs additions for video pages.** hls.js attaches media through a `blob:` URL (Media Source Extensions), so it needs `media-src blob:`. It fetches playlists and segments from Stream's hosts, so it needs `connect-src` for them. The caption track was a `blob:` URL in the spike; production can avoid that by adding cues through the `TextTrack` API (`addCue` with `VTTCue`) instead.
5. **Segments need no keyframe alignment.** Segment boundaries can stay wherever the Educator places them; nothing in the encode needs to match them.

## Not yet tested (needs a person, an account or a device)

- **Cloudflare Stream:** signed playback URLs, Stream's own encoding ladder, its segment length and its CDN. This sandbox can't reach Cloudflare and has no credentials, so the clips were local HLS ladders served by a local server. Stream's segment length and rendition ladder will change the start-up time, but not the looping, which happens in the browser.
- **H.264:** Stream delivers H.264, but open-source Chromium can't play it, so these runs used VP9. Seeking and playback rate should behave the same, but the H.264 path should be measured. `make-clips.sh h264` builds the same ladders in H.264 for Chrome, Safari and Firefox.
- **Safari's native HLS** (`player.js` uses it automatically where hls.js isn't needed), and its `preservesPitch`, `requestVideoFrameCallback` and caption behaviour.
- **Real devices on the agreed profile:** a mid-range Android phone and an older iPhone, five cold runs each (docs/decision-log.md, "Test profile"). Chrome's network emulation has no packet loss or jitter.
- **Pitch:** whether pitch is preserved at 0.75× and 0.5× has to be judged by ear. The code sets `preservesPitch`, which Chromium honours.

To repeat the measurements with a real Stream clip, open `spikes/stream-timing/index.html?src=<signed HLS URL>` in each browser and use the Replay, Loop and quality buttons. To repeat the automated runs, generate the clips with `make-clips.sh` and run `node measure.mjs` (see the comments at the top of each file).

## Recommendation

**ADR-0008 holds for the player.** A native `<video>` with hls.js replays and loops exact segments at every required speed, with no drift. It also survives quality changes and keeps our own WebVTT aligned, on the agreed network profile. The remaining risk is Stream-specific (signed playback, its encodes and start-up time) and device-specific (Safari, real phones). Neither changes the architecture, but both should be checked with a Stream account before #16 relies on them.
