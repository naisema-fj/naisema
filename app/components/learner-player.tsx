import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { Annotation, ExpressionDetails } from "~/lib/annotations";
import { vocabularyList } from "~/lib/annotations";
import {
  annotatedRuns,
  currentSegment,
  PLAYBACK_SPEEDS,
  type PlaybackSpeed,
  type Replay,
  replayStep,
} from "~/lib/player-rules";
import { formatTimecode, type Segment } from "~/lib/segment-rules";
import { type CaptionTrack, VideoPreview } from "./video-preview";

/**
 * The immersion player for one Learning Layer (VID-02–07): the video in its own shape, Fijian and
 * English captions switched independently, a transcript that follows the video and seeks from any
 * Segment without taking focus, word and phrase meanings opened by tap, click or keyboard, the
 * vocabulary list as the accessible way to reach every meaning, replaying a Segment once or on a
 * loop, and three speeds. An Excerpt plays only between its in and out times. Captions are native
 * tracks generated from the published Segments. The transcript is server-rendered, so it can be
 * read even if the video never plays.
 */

type Props = {
  title: string;
  videoTitle: string;
  storyPath: string;
  playback: { src: string; hls: boolean } | null;
  refreshPath: string;
  width: number;
  height: number;
  orientation: "landscape" | "portrait" | "square";
  /** The part of the video the Learning Layer plays, in video time. */
  window: { startMs: number; endMs: number };
  segments: Segment[];
  annotations: Annotation[];
  expressions: Record<string, ExpressionDetails>;
  tracks: { fijian: string; english: string };
};

const SPEED_NAMES: Record<PlaybackSpeed, string> = { 1: "Normal", 0.75: "Slower (0.75×)", 0.5: "Slowest (0.5×)" };

export function LearnerPlayer(props: Props) {
  const { window: span, segments, annotations, expressions } = props;
  const video = useRef<HTMLVideoElement | null>(null);
  const [fijian, setFijian] = useState(true);
  const [english, setEnglish] = useState(true);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [clipMs, setClipMs] = useState(0);
  const [replay, setReplay] = useState<(Replay & { segmentId: string }) | null>(null);
  const replayRef = useRef(replay);
  replayRef.current = replay;
  const [open, setOpen] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const playing = currentSegment(segments, clipMs);
  const vocabulary = vocabularyList(segments, annotations, expressions);

  // Captions: the native tracks, each shown or hidden by its own switch, kept through a new address.
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const apply = () => {
      for (const track of Array.from(element.textTracks)) {
        const on = track.language === "fj" ? fijian : track.language === "en" ? english : false;
        track.mode = on ? "showing" : "hidden";
      }
      element.playbackRate = speed;
    };
    apply();
    element.addEventListener("loadedmetadata", apply);
    element.textTracks.addEventListener?.("addtrack", apply);
    return () => {
      element.removeEventListener("loadedmetadata", apply);
      element.textTracks.removeEventListener?.("addtrack", apply);
    };
  }, [fijian, english, speed]);

  // Follow the playhead in clip time, keep playback inside the Excerpt, and run a replay.
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const element = video.current;
      if (element) {
        const videoMs = element.currentTime * 1000;
        if (!element.seeking && videoMs < span.startMs - 250) element.currentTime = span.startMs / 1000;
        else if (videoMs >= span.endMs && !element.paused) element.pause();
        const clip = Math.max(0, Math.min(span.endMs - span.startMs, Math.round(videoMs - span.startMs)));
        setClipMs(clip);
        const current = replayRef.current;
        if (current && !element.seeking) {
          const step = replayStep(current, clip);
          if (step === "stop") {
            element.pause();
            setReplay(null);
          } else if (step === "restart") {
            element.currentTime = (span.startMs + current.startMs) / 1000;
          } else if (step === "abandon") {
            setReplay(null);
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [span.startMs, span.endMs]);

  const seek = (segment: Segment) => {
    if (video.current) video.current.currentTime = (span.startMs + segment.startMs) / 1000;
  };

  const startReplay = (segment: Segment, loop: boolean) => {
    const element = video.current;
    if (!element) return;
    const next = { segmentId: segment.id, startMs: segment.startMs, endMs: segment.endMs, loop };
    // Set before playing, so the first frame already knows where to stop.
    replayRef.current = next;
    setReplay(next);
    element.currentTime = (span.startMs + segment.startMs) / 1000;
    element.play().catch(() => {
      setReplay(null);
      setStatus("The video couldn't play. Press play on the video first.");
    });
  };

  const stopReplay = () => {
    video.current?.pause();
    setReplay(null);
  };

  const segmentLabel = (segment: Segment) => `Segment ${segments.indexOf(segment) + 1}`;

  return (
    <div className="learner-player">
      <p>
        <Link to={props.storyPath} reloadDocument>
          Back to the story: {props.videoTitle}
        </Link>
      </p>
      <h1>{props.title}</h1>

      <div className="player-stage">
        {props.playback ? (
          <div
            className={`video-frame video-${props.orientation}`}
            style={{ aspectRatio: `${props.width} / ${props.height}` }}
          >
            <VideoPreview
              src={props.playback.src}
              hls={props.playback.hls}
              label={props.videoTitle}
              videoRef={video}
              className="public-video"
              refreshPath={props.refreshPath}
              tracks={
                [
                  { src: props.tracks.fijian, srclang: "fj", label: "Fijian" },
                  { src: props.tracks.english, srclang: "en", label: "English" },
                ] satisfies CaptionTrack[]
              }
            />
          </div>
        ) : (
          <p role="alert">The video can't be played right now. The transcript below has every word.</p>
        )}

        <div className="player-controls">
          <fieldset className="caption-switches">
            <legend>Captions</legend>
            <button type="button" aria-pressed={fijian} onClick={() => setFijian(!fijian)}>
              Fijian: {fijian ? "on" : "off"}
            </button>
            <button type="button" aria-pressed={english} onClick={() => setEnglish(!english)}>
              English: {english ? "on" : "off"}
            </button>
          </fieldset>
          <fieldset className="speed-choice">
            <legend>Speed</legend>
            {PLAYBACK_SPEEDS.map((value) => (
              <label key={value} className="checkbox">
                <input type="radio" name="speed" checked={speed === value} onChange={() => setSpeed(value)} />{" "}
                {SPEED_NAMES[value]}
              </label>
            ))}
          </fieldset>
          {replay && (
            <p role="status" className="replay-status">
              {`${replay.loop ? "Looping" : "Replaying"} ${segmentLabel(segments.find((item) => item.id === replay.segmentId) as Segment)}.`}{" "}
              <button type="button" onClick={stopReplay}>
                Stop
              </button>
            </p>
          )}
          {status && <p role="status">{status}</p>}
        </div>
      </div>

      <section aria-labelledby="transcript-heading" className="transcript">
        <h2 id="transcript-heading">Transcript</h2>
        <p className="hint">Underlined words open their meaning. Each Segment's time plays the video from there.</p>
        <ol className="transcript-list">
          {segments.map((segment) => {
            const label = segmentLabel(segment);
            const runs = annotatedRuns(
              segment,
              annotations.filter((annotation) => annotation.segmentId === segment.id),
            );
            const isPlaying = playing?.id === segment.id;
            return (
              <li
                key={segment.id}
                className={isPlaying ? "transcript-segment playing" : "transcript-segment"}
                aria-current={isPlaying ? "true" : undefined}
                aria-label={label}
              >
                <div className="segment-tools">
                  <button type="button" onClick={() => seek(segment)}>
                    {formatTimecode(segment.startMs)}
                    <span className="visually-hidden">: play from {label}</span>
                  </button>
                  <button type="button" onClick={() => startReplay(segment, false)}>
                    Replay<span className="visually-hidden"> {label}</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={replay?.segmentId === segment.id && replay.loop}
                    onClick={() =>
                      replay?.segmentId === segment.id && replay.loop ? stopReplay() : startReplay(segment, true)
                    }
                  >
                    Loop<span className="visually-hidden"> {label}</span>
                  </button>
                </div>
                {segment.speaker && <p className="speaker">{segment.speaker}</p>}
                {fijian && (
                  <p lang="fj" className="transcript-fijian">
                    {runs.map((run, index) =>
                      run.annotationId ? (
                        <MeaningButton
                          // Runs are fixed for a Segment, so their order is a stable key.
                          // biome-ignore lint/suspicious/noArrayIndexKey: see above.
                          key={index}
                          run={run.text}
                          annotation={annotations.find((item) => item.id === run.annotationId) as Annotation}
                          expressions={expressions}
                          open={open === run.annotationId}
                          onToggle={(next) => setOpen(next ? run.annotationId : null)}
                        />
                      ) : (
                        // biome-ignore lint/suspicious/noArrayIndexKey: see above.
                        <span key={index}>{run.text}</span>
                      ),
                    )}
                  </p>
                )}
                {english && segment.english && <p className="transcript-english">{segment.english}</p>}
                {!fijian && !english && <p className="hint">Captions are off. Turn one on to read along.</p>}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="vocabulary-heading" className="vocabulary">
        <h2 id="vocabulary-heading">Vocabulary</h2>
        {vocabulary.length ? (
          <dl className="vocabulary-list">
            {vocabulary.map((entry) => (
              <div key={entry.expressionId}>
                <dt lang="fj">{entry.headword}</dt>
                <dd>
                  {entry.generalMeaning}
                  <ul className="occurrences">
                    {entry.occurrences.map((occurrence) => {
                      const segment = segments.find((item) => item.id === occurrence.segmentId) as Segment;
                      return (
                        <li key={`${occurrence.segmentId}-${occurrence.text}`}>
                          <button type="button" onClick={() => seek(segment)}>
                            <span lang="fj">“{occurrence.text}”</span> at {formatTimecode(occurrence.startMs)}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>This Learning Layer has no vocabulary list.</p>
        )}
      </section>

      <p>
        <Link to={props.storyPath} reloadDocument>
          Back to the story: {props.videoTitle}
        </Link>
      </p>
    </div>
  );
}

/**
 * An annotated word or phrase in the transcript, which opens its meaning beside it. Opening moves
 * focus into the meaning; closing it (its button or Escape) returns focus to the word.
 */
function MeaningButton({
  run,
  annotation,
  expressions,
  open,
  onToggle,
}: {
  run: string;
  annotation: Annotation;
  expressions: Record<string, ExpressionDetails>;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const expression = expressions[annotation.expressionId];
  const id = `meaning-${annotation.id}`;
  const close = () => {
    onToggle(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="meaning-word"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onToggle(!open)}
      >
        {run}
      </button>
      {open && expression && (
        <span
          ref={panel}
          id={id}
          role="dialog"
          aria-label={`Meaning of ${run}`}
          tabIndex={-1}
          className="meaning-popover"
          lang="en"
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
        >
          <span className="meaning-headword" lang="fj">
            {expression.headword}
          </span>
          <span className="meaning-line">Here: {annotation.contextualMeaning}</span>
          <span className="meaning-line">Generally: {expression.generalMeaning}</span>
          {expression.literalMeaning && <span className="meaning-line">Literally: {expression.literalMeaning}</span>}
          {(annotation.grammarNote || expression.grammarNote) && (
            <span className="meaning-line">Grammar: {annotation.grammarNote || expression.grammarNote}</span>
          )}
          {expression.pronunciation && <span className="meaning-line">Said: {expression.pronunciation}</span>}
          <button type="button" onClick={close}>
            Close<span className="visually-hidden"> the meaning of {run}</span>
          </button>
        </span>
      )}
    </>
  );
}
