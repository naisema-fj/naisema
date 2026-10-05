import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import type { Annotation, ExpressionDetails } from "~/lib/annotations";
import {
  annotatedRuns,
  currentSegment,
  meaningsList,
  PLAYBACK_SPEEDS,
  type PlaybackSpeed,
  type Replay,
  replayStep,
} from "~/lib/player-rules";
import { formatTimecode, type Segment } from "~/lib/segment-rules";
import { type CaptionTrack, VideoPreview } from "./video-preview";

/**
 * The immersion player for one Learning Layer (VID-02–07): the video in its own shape, captions in
 * the language taught and in English switched independently, a transcript that follows the video
 * and seeks from any line without taking focus, word and phrase meanings opened by tap, click or
 * keyboard, a list of every word and phrase with all its meanings as the way to reach them without
 * opening them in place, replaying a line once or on a loop, and three speeds. An Excerpt plays
 * only between its in and out times. Captions are native tracks generated from the published
 * Segments. The transcript is server-rendered and always shows both languages, so it can be read
 * even if the video never plays.
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
  span: { startMs: number; endMs: number };
  /** The language taught: its tag for `lang` and its tracks, and its name as visitors read it. */
  language: { tag: string; name: string };
  segments: Segment[];
  annotations: Annotation[];
  expressions: Record<string, ExpressionDetails>;
  tracks: { taught: string; english: string };
};

const SPEED_NAMES: Record<PlaybackSpeed, string> = { 1: "Normal", 0.75: "Slower (0.75×)", 0.5: "Slowest (0.5×)" };

/** How a line of the transcript is named to visitors. */
const lineName = (index: number) => `Line ${index + 1}`;

export function LearnerPlayer(props: Props) {
  const { span, segments, expressions, language } = props;
  // Only Annotations whose Expression the Revision carries can open a meaning.
  const annotations = useMemo(
    () => props.annotations.filter((annotation) => expressions[annotation.expressionId]),
    [props.annotations, expressions],
  );
  const video = useRef<HTMLVideoElement | null>(null);
  const [taught, setTaught] = useState(true);
  const [english, setEnglish] = useState(true);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  // The line playing is state; the playhead itself is read every frame and kept in a ref.
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [replay, setReplay] = useState<(Replay & { segmentId: string }) | null>(null);
  const replayRef = useRef(replay);
  useEffect(() => {
    replayRef.current = replay;
  }, [replay]);
  const [open, setOpen] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const clipLengthMs = span.endMs - span.startMs;
  const runsBySegment = useMemo(
    () =>
      new Map(
        segments.map((segment) => [
          segment.id,
          annotatedRuns(
            segment,
            annotations.filter((annotation) => annotation.segmentId === segment.id),
          ),
        ]),
      ),
    [segments, annotations],
  );
  const meanings = useMemo(
    () => meaningsList(segments, annotations, expressions),
    [segments, annotations, expressions],
  );
  const lineOf = (segmentId: string) => lineName(segments.findIndex((segment) => segment.id === segmentId));

  // Captions: the native tracks, each shown or hidden by its own switch, kept through a new address.
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const apply = () => {
      for (const track of Array.from(element.textTracks)) {
        const on = track.language === language.tag ? taught : track.language === "en" ? english : false;
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
  }, [taught, english, speed, language.tag]);

  // Pressing play at the end of an Excerpt starts it again from its in time.
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const fromStart = () => {
      if (element.currentTime * 1000 >= span.endMs - 50 && !replayRef.current) {
        element.currentTime = span.startMs / 1000;
      }
    };
    element.addEventListener("play", fromStart);
    return () => element.removeEventListener("play", fromStart);
  }, [span.startMs, span.endMs]);

  // Follow the playhead, run a replay, and keep playback inside the Excerpt. The replay is checked
  // first, so a loop on the last line goes round rather than stopping at the Excerpt's end.
  useEffect(() => {
    let frame = 0;
    let shown: string | null = null;
    const tick = () => {
      const element = video.current;
      if (element) {
        const videoMs = element.currentTime * 1000;
        const clip = Math.max(0, Math.min(clipLengthMs, Math.round(videoMs - span.startMs)));
        const current = replayRef.current;
        let handled = false;
        if (current && !element.seeking) {
          // A video that ended by itself has reached the line's end too.
          const step = element.ended ? (current.loop ? "restart" : "stop") : replayStep(current, clip);
          if (step === "stop") {
            element.pause();
            replayRef.current = null;
            setReplay(null);
            handled = true;
          } else if (step === "restart") {
            element.currentTime = (span.startMs + current.startMs) / 1000;
            element.play().catch(() => undefined);
            handled = true;
          } else if (step === "abandon") {
            replayRef.current = null;
            setReplay(null);
          }
        }
        if (!handled) {
          if (!element.seeking && videoMs < span.startMs - 250) element.currentTime = span.startMs / 1000;
          else if (videoMs >= span.endMs && !element.paused) element.pause();
        }
        const playing = currentSegment(segments, clip)?.id ?? null;
        if (playing !== shown) {
          shown = playing;
          setPlayingId(playing);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [span.startMs, span.endMs, clipLengthMs, segments]);

  const seek = (segment: Segment) => {
    if (video.current) video.current.currentTime = (span.startMs + segment.startMs) / 1000;
  };

  const startReplay = (segment: Segment, loop: boolean) => {
    const element = video.current;
    if (!element) return;
    // A line can't run past the end of what the Learning Layer plays.
    const next = {
      segmentId: segment.id,
      startMs: segment.startMs,
      endMs: Math.min(segment.endMs, clipLengthMs),
      loop,
    };
    replayRef.current = next;
    setReplay(next);
    setStatus("");
    element.currentTime = (span.startMs + segment.startMs) / 1000;
    element.play().catch(() => {
      replayRef.current = null;
      setReplay(null);
      setStatus("The video couldn't play. Press play on the video first.");
    });
  };

  const stopReplay = () => {
    video.current?.pause();
    replayRef.current = null;
    setReplay(null);
  };

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
          <div className={`video-frame video-${props.orientation}`}>
            <VideoPreview
              src={props.playback.src}
              hls={props.playback.hls}
              label={props.videoTitle}
              videoRef={video}
              className="public-video"
              aspectRatio={`${props.width} / ${props.height}`}
              refreshPath={props.refreshPath}
              tracks={
                [
                  { src: props.tracks.taught, srclang: language.tag, label: language.name },
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
            <button type="button" aria-pressed={taught} onClick={() => setTaught(!taught)}>
              {language.name}
              <span aria-hidden="true">{taught ? ": on" : ": off"}</span>
            </button>
            <button type="button" aria-pressed={english} onClick={() => setEnglish(!english)}>
              English
              <span aria-hidden="true">{english ? ": on" : ": off"}</span>
            </button>
          </fieldset>
          <fieldset className="speed-choice">
            <legend>Speed</legend>
            {PLAYBACK_SPEEDS.map((value) => (
              <label key={value}>
                <input type="radio" name="speed" checked={speed === value} onChange={() => setSpeed(value)} />{" "}
                {SPEED_NAMES[value]}
              </label>
            ))}
          </fieldset>
          {replay && (
            <p role="status" className="replay-status">
              {`${replay.loop ? "Looping" : "Replaying"} ${lineOf(replay.segmentId).toLowerCase()}.`}{" "}
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
        <p className="hint">Underlined words open their meaning. A line's time plays the video from there.</p>
        <ol className="transcript-list">
          {segments.map((segment, index) => {
            const label = lineName(index);
            const runs = runsBySegment.get(segment.id) ?? [];
            const isPlaying = playingId === segment.id;
            return (
              <li
                key={segment.id}
                className={isPlaying ? "transcript-segment playing" : "transcript-segment"}
                aria-current={isPlaying ? "true" : undefined}
              >
                <h3 className="visually-hidden">{label}</h3>
                <div className="segment-tools">
                  <button type="button" onClick={() => seek(segment)}>
                    {formatTimecode(segment.startMs)}
                    <span className="visually-hidden">: play from {label.toLowerCase()}</span>
                  </button>
                  <button type="button" onClick={() => startReplay(segment, false)}>
                    Replay<span className="visually-hidden"> {label.toLowerCase()}</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={replay?.segmentId === segment.id && replay.loop}
                    onClick={() =>
                      replay?.segmentId === segment.id && replay.loop ? stopReplay() : startReplay(segment, true)
                    }
                  >
                    Loop<span className="visually-hidden"> {label.toLowerCase()}</span>
                  </button>
                </div>
                {segment.speaker && <p className="speaker">{segment.speaker}</p>}
                <div lang={language.tag} className="transcript-fijian">
                  {runs.map((run, at) =>
                    run.annotationId ? (
                      <MeaningButton
                        // Runs are fixed for a line, so their order is a stable key.
                        // biome-ignore lint/suspicious/noArrayIndexKey: see above.
                        key={at}
                        run={run.text}
                        languageTag={language.tag}
                        annotation={annotations.find((item) => item.id === run.annotationId) as Annotation}
                        expression={
                          expressions[
                            (annotations.find((item) => item.id === run.annotationId) as Annotation).expressionId
                          ]
                        }
                        open={open === run.annotationId}
                        onToggle={(next) => setOpen(next ? run.annotationId : null)}
                      />
                    ) : (
                      // biome-ignore lint/suspicious/noArrayIndexKey: see above.
                      <span key={at}>{run.text}</span>
                    ),
                  )}
                </div>
                {segment.english && <p className="transcript-english">{segment.english}</p>}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="meanings-heading" className="vocabulary">
        <h2 id="meanings-heading">Words and meanings</h2>
        {meanings.length ? (
          <dl className="vocabulary-list">
            {meanings.map(({ expressionId, expression, keyWord, places }) => (
              <div key={expressionId}>
                <dt>
                  <span lang={language.tag}>{expression.headword}</span>
                  {keyWord && <span className="key-word"> Key word</span>}
                </dt>
                <dd>
                  <p>Generally: {expression.generalMeaning}</p>
                  {expression.literalMeaning && <p>Literally: {expression.literalMeaning}</p>}
                  {expression.grammarNote && <p>Grammar: {expression.grammarNote}</p>}
                  {expression.pronunciation && <p>Said: {expression.pronunciation}</p>}
                  <ul className="occurrences">
                    {places.map((place) => (
                      <li key={place.annotationId}>
                        <button
                          type="button"
                          onClick={() => seek(segments.find((item) => item.id === place.segmentId) as Segment)}
                        >
                          <span lang={language.tag}>“{place.text}”</span> at {formatTimecode(place.startMs)}
                        </button>{" "}
                        Here: {place.meaning}
                        {place.grammarNote && `. Grammar: ${place.grammarNote}`}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>No words are explained in this lesson yet.</p>
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
 * focus into the meaning; closing it (its button or Escape) returns focus to the word, and moving
 * focus elsewhere closes it.
 */
function MeaningButton({
  run,
  languageTag,
  annotation,
  expression,
  open,
  onToggle,
}: {
  run: string;
  languageTag: string;
  annotation: Annotation;
  expression: ExpressionDetails;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
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
        aria-controls={open ? id : undefined}
        onClick={() => onToggle(!open)}
      >
        {run}
      </button>
      {open && (
        <div
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
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null;
            if (next !== trigger.current && !panel.current?.contains(next)) onToggle(false);
          }}
        >
          <span className="meaning-headword" lang={languageTag}>
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
        </div>
      )}
    </>
  );
}
