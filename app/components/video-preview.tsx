import { useEffect, useRef, useState } from "react";

/**
 * A staff preview of a Video Asset through its signed playback address (ADR-0008): a native
 * `<video>`, fed by hls.js's light build where the browser can't play HLS itself (everywhere but
 * Safari). hls.js is loaded only here, as its own chunk, and without a Web Worker so the page's
 * content security policy needs no `worker-src`. Never forces an immediate quality switch
 * (docs/spikes/stream-timing.md).
 */
export function VideoPreview({ src, hls, label }: { src: string; hls: boolean; label: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const element = video.current;
    if (!element || !hls || element.canPlayType("application/vnd.apple.mpegurl")) return;
    let cancelled = false;
    let player: { destroy(): void } | undefined;
    import("hls.js/light")
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setError("This browser can't play the preview.");
          return;
        }
        const instance = new Hls({ enableWorker: false });
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setError("The preview couldn't be played. Reload the page for a new link and try again.");
        });
        instance.loadSource(src);
        instance.attachMedia(element);
        player = instance;
      })
      .catch(() => setError("The video player couldn't be loaded. Reload the page to try again."));
    return () => {
      cancelled = true;
      player?.destroy();
    };
  }, [src, hls]);

  return (
    <figure className="video-preview">
      {/* biome-ignore lint/a11y/useMediaCaption: a master's captions come from its reviewed Learning Layer Segments, not the file. */}
      <video ref={video} src={hls ? undefined : src} controls playsInline preload="metadata" aria-label={label} />
      {error && <p role="alert">{error}</p>}
    </figure>
  );
}
