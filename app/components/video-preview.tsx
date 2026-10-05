import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";

const UNPLAYABLE = "The video couldn't be played. Reload the page and try again.";

/** A caption track for the native player: one language of a Learning Layer, as WebVTT. */
export type CaptionTrack = { src: string; srclang: string; label: string };

/**
 * A Video Asset played through its signed address (ADR-0008), for staff previews and public
 * players: a native `<video>`, fed by hls.js's light build where the browser can't play HLS itself
 * (everywhere but Safari). hls.js is loaded only here, as its own chunk, and without a Web Worker so
 * the page's content security policy needs no `worker-src`. Never forces an immediate quality
 * switch, and recovers from a fatal error once (docs/spikes/stream-timing.md). Nothing plays until
 * the viewer presses play.
 *
 * Signed addresses last about ten minutes. With `refreshPath`, a player that loses its address asks
 * for a new one and carries on from where it was, as it was (playing or paused).
 */
export function VideoPreview({
  src,
  hls,
  label,
  videoRef,
  className = "video-preview",
  tracks = [],
  refreshPath,
  children,
}: {
  src: string;
  hls: boolean;
  label: string;
  /** Given the `<video>` element, for a player that reads and moves the playhead. */
  videoRef?: RefObject<HTMLVideoElement | null>;
  className?: string;
  /** Native caption tracks, all hidden until the page shows one. */
  tracks?: CaptionTrack[];
  /** Where a fresh `{ src, hls }` comes from when the signed address runs out. */
  refreshPath?: string;
  /** Shown over the video, such as the captions of the Segment playing. */
  children?: ReactNode;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [source, setSource] = useState({ src, hls });
  const [error, setError] = useState("");
  /** Where to carry on from once a new address has loaded. */
  const resume = useRef<{ time: number; playing: boolean } | null>(null);
  const lastRefresh = useRef(0);

  useEffect(() => setSource({ src, hls }), [src, hls]);

  useEffect(() => {
    if (videoRef) videoRef.current = video.current;
  }, [videoRef]);

  /** Asks for a new address, at most once every 30 seconds; false if there's none to be had. */
  const refresh = async () => {
    const element = video.current;
    if (!refreshPath || !element || Date.now() - lastRefresh.current < 30_000) return false;
    lastRefresh.current = Date.now();
    try {
      const response = await fetch(refreshPath, { cache: "no-store" });
      if (!response.ok) return false;
      const next = (await response.json()) as { src: string; hls: boolean };
      resume.current = { time: element.currentTime, playing: !element.paused };
      setSource(next);
      return true;
    } catch {
      return false;
    }
  };
  const fail = () => setError(UNPLAYABLE);
  // The hls.js player is built once per address; it reaches the latest `refresh` through this.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const restore = () => {
      const at = resume.current;
      if (!at) return;
      resume.current = null;
      element.currentTime = at.time;
      if (at.playing) element.play().catch(() => undefined);
    };
    element.addEventListener("loadedmetadata", restore);
    return () => element.removeEventListener("loadedmetadata", restore);
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element || !source.hls || element.canPlayType("application/vnd.apple.mpegurl")) return;
    let cancelled = false;
    let player: { destroy(): void } | undefined;
    import("hls.js/light")
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setError("This browser can't play the video.");
          return;
        }
        const instance = new Hls({ enableWorker: false });
        // Recover once from each kind of fatal error, as the spike recommends: restart loading
        // after a lost connection, rebuild the buffer after a media error. A second lost
        // connection is usually an expired address, so a new one is asked for before giving up.
        const recovered = new Set<string>();
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          const recoverable = data.type === Hls.ErrorTypes.NETWORK_ERROR || data.type === Hls.ErrorTypes.MEDIA_ERROR;
          if (recoverable && !recovered.has(data.type)) {
            recovered.add(data.type);
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) instance.startLoad();
            else instance.recoverMediaError();
            return;
          }
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            refreshRef.current().then((renewed) => renewed || setError(UNPLAYABLE));
            return;
          }
          setError(UNPLAYABLE);
        });
        instance.loadSource(source.src);
        instance.attachMedia(element);
        player = instance;
      })
      .catch(() => setError("The video player couldn't be loaded. Reload the page to try again."));
    return () => {
      cancelled = true;
      player?.destroy();
    };
  }, [source]);

  return (
    <figure className={className}>
      {/* biome-ignore lint/a11y/useMediaCaption: captions come from a Learning Layer's reviewed Segments, as tracks when there are any. */}
      <video
        ref={video}
        src={source.hls ? undefined : source.src}
        controls
        playsInline
        preload="metadata"
        aria-label={label}
        onError={() => {
          // The browser plays the file itself here, so an error is most often an expired address.
          if (!source.hls) refresh().then((renewed) => renewed || fail());
        }}
      >
        {tracks.map((track) => (
          <track key={track.srclang} kind="captions" src={track.src} srcLang={track.srclang} label={track.label} />
        ))}
      </video>
      {children}
      {error && <p role="alert">{error}</p>}
    </figure>
  );
}
