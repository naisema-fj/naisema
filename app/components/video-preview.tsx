import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";

const UNPLAYABLE = "The video couldn't be played. Reload the page and try again.";

/** A caption track for the native player: one language of a Learning Layer, as WebVTT. */
export type CaptionTrack = { src: string; srclang: string; label: string };

/**
 * An MP4 clip played by the browser itself from NAISEMA's own address, with byte ranges so it
 * seeks (ADR-0015), for staff previews and the learner player. Nothing plays until the viewer
 * presses play. Caption tracks start hidden; the page decides which to show.
 */
export function VideoPreview({
  src,
  type,
  label,
  videoRef,
  className = "video-preview",
  tracks = [],
  aspectRatio,
  children,
}: {
  src: string;
  type: string;
  label: string;
  /** Given the `<video>` element, for a player that reads and moves the playhead. */
  videoRef?: RefObject<HTMLVideoElement | null>;
  className?: string;
  tracks?: CaptionTrack[];
  /** The footage's own shape, as "width / height", so it is never cropped. */
  aspectRatio?: string;
  /** Shown over the video, such as the captions of the Segment playing. */
  children?: ReactNode;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (videoRef) videoRef.current = video.current;
  }, [videoRef]);
  return (
    <div className={className}>
      <video
        ref={video}
        style={aspectRatio ? { aspectRatio } : undefined}
        controls
        playsInline
        preload="metadata"
        aria-label={label}
        onError={() => setError(UNPLAYABLE)}
      >
        <source src={src} type={type} />
        {tracks.map((track) => (
          <track key={track.srclang} kind="captions" src={track.src} srcLang={track.srclang} label={track.label} />
        ))}
      </video>
      {children}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
