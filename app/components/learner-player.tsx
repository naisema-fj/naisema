import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import type { Annotation, ExpressionDetails } from "~/lib/annotations";
import { NOTE_KINDS } from "~/lib/annotations";
import {
  IMMERSION_STAGES,
  type LearnerView,
  progressSummary,
  type RealWorldChoice,
  recordAnswer,
  recordRealWorld,
  recordVisit,
  type StageId,
  stageHasActivities,
  stageNeighbours,
  stageText,
} from "~/lib/immersion";
import { LEARNER_PATHS, type LearnerLayerState } from "~/lib/learner-progress";
import {
  captionsFor,
  DEFAULT_PREFERENCES,
  type LayerSession,
  newLayerSession,
  type SupportPreferences,
} from "~/lib/learner-session";
import { type LearningEvent, type Support, sendLearningEvent } from "~/lib/learning-events";
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
import { ActivityCard } from "./activity-card";
import { SaveStatus, SaveToggle, useLearnerStore, useQueueStatus } from "./learner-account";
import { type CaptionTrack, VideoPreview } from "./video-preview";

/**
 * The immersion player for one Learning Layer (VID-02–09, VID-12, §05A). It guides a learner
 * through eight stages, from watching naturally to using what they learned with someone, and any
 * stage can be opened, skipped or revisited, and help asked for, without penalty. Each stage is its
 * own page and is sent only what it shows (app/lib/immersion.ts), so English a stage leaves out
 * comes only when the learner asks for it. Around the stages: the video in its own shape, captions
 * in the language taught and in English switched independently, a transcript that follows the
 * video and seeks from any line without taking focus, word and phrase meanings, replaying a line
 * once or on a loop, three speeds, and the Activities with feedback and retries. An Excerpt plays
 * only between its in and out times. Progress and support choices are kept in a learner store
 * (app/lib/learner-store.ts): the tab's for a visitor; for a signed-in learner, their account's,
 * through the progress queue, which says when each change is saved. Learning events carry IDs only.
 */

type Props = {
  layerId: string;
  /** The published Revision shown; progress belongs to it. */
  revisionId: string;
  /** The player's address, without a stage. */
  playerPath: string;
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
  /** What this stage shows. */
  view: LearnerView;
  /** The caption tracks; English only in stages that show it. */
  tracks: { taught: string; english: string | null };
  /** The Video the Learning Layer is on, which a learner can save. */
  contentItemId: string;
  /** A signed-in learner's account state, or null for a visitor. */
  learner: (LearnerLayerState & { userId: string }) | null;
};

const SPEED_NAMES: Record<PlaybackSpeed, string> = { 1: "Normal", 0.75: "Slower (0.75×)", 0.5: "Slowest (0.5×)" };

/** How a line of the transcript is named to visitors. */
const lineName = (index: number) => `Line ${index + 1}`;

const REAL_WORLD_SAID: Record<RealWorldChoice, string> = {
  reflect: "you'll reflect on it",
  tried: "you tried it",
  later: "maybe later",
  skip: "you skipped it",
};

export function LearnerPlayer(props: Props) {
  const { span, view, language, layerId } = props;
  const { segments, expressions, stage } = view;
  const stageAt = IMMERSION_STAGES.findIndex((item) => item.id === stage);
  const text = stageText(stage, language.name);
  const nameOf = (id: StageId) => stageText(id, language.name).name;
  const stagePath = (id: StageId) => `${props.playerPath}?stage=${id}`;
  const { previous, next } = stageNeighbours(stage);

  // Only Annotations whose Expression the Revision carries can open a meaning.
  const annotations = useMemo(
    () => view.annotations.filter((annotation) => expressions[annotation.expressionId]),
    [view.annotations, expressions],
  );

  // What the learner has done and chosen, from the learner store (app/lib/learner-store.ts): for a
  // visitor, kept for this tab only; for a signed-in learner, what their account holds with anything
  // still queued on top. Read after hydration, so the server's page and the first render match.
  const { learner, contentItemId } = props;
  const userId = learner?.userId ?? null;
  const [session, setSession] = useState<LayerSession>(() => newLayerSession(props.revisionId));
  const [support, setSupport] = useState<SupportPreferences>(DEFAULT_PREFERENCES);
  const [saved, setSaved] = useState({ words: learner?.savedWords ?? [], video: learner?.videoSaved ?? false });
  const [loaded, setLoaded] = useState(false);
  const store = useLearnerStore({ layerId, revisionId: props.revisionId, contentItemId }, learner, segments);
  const record = store.record;
  const queueStatus = useQueueStatus(userId);
  // The place in the clip the learner was last at, kept so opening a stage doesn't lose it.
  const place = useRef({ positionMs: learner?.resumeMs ?? 0, segmentId: null as string | null });
  // biome-ignore lint/correctness/useExhaustiveDependencies: read once per stage; the store comes with the page.
  useEffect(() => {
    let live = true;
    store.load().then((start) => {
      if (!live) return;
      // Completing is announced once: not again for progress already complete.
      const complete = progressSummary(view.required, start.progress).completion.complete;
      setSession({
        revisionId: props.revisionId,
        progress: recordVisit(start.progress, stage),
        completedSent: complete,
        captions: start.captions,
      });
      setSupport(start.preferences);
      setSaved({ words: start.savedWords, video: start.videoSaved });
      setLoaded(true);
      if (start.place) place.current = start.place;
      record({ type: "position", layerId, revisionId: props.revisionId, stage, ...place.current });
    });
    return () => {
      live = false;
    };
  }, [store, stage]);
  const send = useCallback((event: LearningEvent) => sendLearningEvent(layerId, event), [layerId]);
  const toggled = (name: Support) => send({ name: "support_toggled", support: name });
  const updateSupport = (change: Partial<SupportPreferences>) => {
    const next = { ...support, ...change };
    setSupport(next);
    record({ type: "preferences", ...next });
  };
  const onLayer = { layerId, revisionId: props.revisionId };
  // A save the server refuses (what it was about is no longer public) is undone on the page too.
  const undoIfRefused = useRef(new Map<string, () => void>());
  useEffect(() => {
    for (const id of queueStatus.refused) {
      undoIfRefused.current.get(id)?.();
      undoIfRefused.current.delete(id);
    }
  }, [queueStatus.refused]);
  const saveWords = (change: (words: string[]) => string[]) =>
    setSaved((current) => ({ ...current, words: change(current.words) }));
  const saveVideo = async (on: boolean) => {
    setSaved((current) => ({ ...current, video: on }));
    const id = await record({ type: on ? "save-video" : "unsave-video", contentItemId });
    if (id && on) undoIfRefused.current.set(id, () => setSaved((current) => ({ ...current, video: false })));
  };
  const saveWord = async (expressionId: string, on: boolean) => {
    const without = (words: string[]) => words.filter((word) => word !== expressionId);
    saveWords((words) => (on ? [...without(words), expressionId] : without(words)));
    const id = await record(
      on ? { type: "save-word", ...onLayer, expressionId } : { type: "unsave-word", revisionId: null, expressionId },
    );
    if (id && on) undoIfRefused.current.set(id, () => saveWords(without));
  };

  const captions = captionsFor(view.captions, session.captions[stage], support.alwaysCaptions);
  const taught = captions.taught;
  const english = Boolean(props.tracks.english) && captions.english;
  const setCaptions = (change: Partial<typeof captions>) => {
    const chosen = { ...captions, ...change, underAlways: support.alwaysCaptions };
    setSession((current) => ({ ...current, captions: { ...current.captions, [stage]: chosen } }));
    record({ type: "captions", ...onLayer, stage, ...chosen });
  };
  const speed = support.speed;

  // The listening stages hide the transcript until the learner asks for it.
  const [transcriptAsked, setTranscriptAsked] = useState(false);
  const transcriptShown = !view.listening || support.alwaysCaptions || transcriptAsked;
  // English a stage left off the page, fetched a line at a time when the learner asks for it.
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpStatus, setHelpStatus] = useState("");
  const englishOf = (segment: Segment) => segment.english || revealed[segment.id] || "";

  const video = useRef<HTMLVideoElement | null>(null);
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

  // A signed-in learner's place in the clip: sent when they pause, and every 15 seconds while playing.
  useEffect(() => {
    const element = video.current;
    if (!element || !userId) return;
    let lastSent = 0;
    const note = (now: boolean) => {
      const clip = Math.max(0, Math.min(clipLengthMs, Math.round(element.currentTime * 1000 - span.startMs)));
      place.current = { positionMs: clip, segmentId: currentSegment(segments, clip)?.id ?? null };
      if (!now && Date.now() - lastSent < 15_000) return;
      lastSent = Date.now();
      record({ type: "position", layerId, revisionId: props.revisionId, stage, ...place.current });
    };
    const playing = () => {
      if (!element.paused) note(false);
    };
    const paused = () => note(true);
    element.addEventListener("timeupdate", playing);
    element.addEventListener("pause", paused);
    return () => {
      element.removeEventListener("timeupdate", playing);
      element.removeEventListener("pause", paused);
    };
  }, [userId, record, layerId, props.revisionId, stage, span.startMs, clipLengthMs, segments]);

  const carryOn = () => {
    const element = video.current;
    if (!element || !learner?.resumeMs) return;
    element.currentTime = (span.startMs + learner.resumeMs) / 1000;
    element.play().catch(() => setStatus("The video couldn't play. Press play on the video first."));
  };

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
    send({ name: "segment_replayed", segmentId: segment.id });
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

  const playClip = () => {
    const element = video.current;
    if (!element) return;
    element.currentTime = span.startMs / 1000;
    element.play().catch(() => setStatus("The video couldn't play. Press play on the video first."));
  };

  // The line the learner is on: the one playing, or the last one played, or the first.
  const [lastLine, setLastLine] = useState<string | null>(null);
  useEffect(() => {
    if (playingId) setLastLine(playingId);
  }, [playingId]);
  const helpLine = segments.find((segment) => segment.id === (playingId ?? lastLine)) ?? segments[0];

  const revealEnglish = async () => {
    if (!helpLine) return;
    toggled("english-line");
    let words = revealed[helpLine.id];
    if (words === undefined) {
      try {
        const response = await fetch(`/language/${layerId}/english/${helpLine.id}`);
        if (!response.ok) throw new Error(String(response.status));
        words = ((await response.json()) as { english: string }).english;
        setRevealed((current) => ({ ...current, [helpLine.id]: words as string }));
      } catch {
        setHelpStatus("The English couldn't be fetched just now. Try again in a moment.");
        return;
      }
    }
    setHelpStatus(
      words ? `${lineOf(helpLine.id)} in English: ${words}` : `${lineOf(helpLine.id)} has no English translation yet.`,
    );
  };

  // Answering an Activity: progress, its events, and completion, sent once.
  const answered = (activityId: string, correct: boolean | null) => {
    send({ name: "activity_attempted", activityId });
    send({ name: "feedback_viewed", activityId });
    record({ type: "attempt", ...onLayer, activityId, correct });
    const progress = recordAnswer(session.progress, activityId, correct);
    const done = progressSummary(view.required, progress).completion.complete;
    if (done && !session.completedSent) send({ name: "learning_completed" });
    setSession({ ...session, progress, completedSent: session.completedSent || done });
  };

  const summary = progressSummary(view.required, session.progress);
  const remaining = IMMERSION_STAGES.flatMap(({ id }) => {
    const left = view.required.filter(
      (activity) => activity.stage === id && !session.progress.activities[activity.id]?.attempted,
    ).length;
    return left ? [{ id, left }] : [];
  });
  const notesFor = (segmentId: string | null) =>
    view.notes.filter((note) =>
      segmentId === null
        ? note.segmentId === null || !segments.some((segment) => segment.id === note.segmentId)
        : note.segmentId === segmentId,
    );

  return (
    <div className="learner-player">
      <p>
        <Link to={props.storyPath} reloadDocument>
          Back to the story: {props.videoTitle}
        </Link>
      </p>
      <h1>{props.title}</h1>
      {learner && (
        <div className="account-bar">
          <SaveToggle
            saved={saved.video}
            status={queueStatus}
            onChange={saveVideo}
            label={{ save: "Save this video", saving: "Saving this video…", saved: "Saved to your learning" }}
          />
          <SaveStatus status={queueStatus} />
        </div>
      )}

      <nav aria-label="Steps" className="stage-steps">
        <ol>
          {IMMERSION_STAGES.map(({ id }, index) => {
            const visited = loaded && session.progress.visited.includes(id) && id !== stage;
            return (
              <li key={id} className={id === stage ? "current" : visited ? "visited" : undefined}>
                <Link to={stagePath(id)} reloadDocument aria-current={id === stage ? "step" : undefined}>
                  <span className="step-number">{index + 1}</span> {nameOf(id)}
                  {visited && <span className="visually-hidden"> (visited)</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>

      <section aria-labelledby="stage-heading" className="stage-intro">
        <h2 id="stage-heading">
          Step {stageAt + 1} of {IMMERSION_STAGES.length}: {text.name}
        </h2>
        <p>{text.guide}</p>
      </section>

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
              tracks={[
                { src: props.tracks.taught, srclang: language.tag, label: language.name } satisfies CaptionTrack,
                ...(props.tracks.english
                  ? [{ src: props.tracks.english, srclang: "en", label: "English" } satisfies CaptionTrack]
                  : []),
              ]}
            />
          </div>
        ) : (
          <p role="alert">The video can't be played right now. The transcript below has every word.</p>
        )}

        <div className="player-controls">
          <fieldset className="caption-switches">
            <legend>Captions</legend>
            <button
              type="button"
              aria-pressed={taught}
              onClick={() => {
                setCaptions({ taught: !taught });
                toggled("fijian-captions");
              }}
            >
              {language.name}
              <span aria-hidden="true">{taught ? ": on" : ": off"}</span>
            </button>
            {props.tracks.english && (
              <button
                type="button"
                aria-pressed={english}
                onClick={() => {
                  setCaptions({ english: !english });
                  toggled("english-captions");
                }}
              >
                English
                <span aria-hidden="true">{english ? ": on" : ": off"}</span>
              </button>
            )}
          </fieldset>
          <fieldset className="speed-choice">
            <legend>Speed</legend>
            {PLAYBACK_SPEEDS.map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="speed"
                  checked={speed === value}
                  onChange={() => {
                    updateSupport({ speed: value });
                    toggled("speed");
                  }}
                />{" "}
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
          {learner?.resumeMs ? (
            <p>
              <button type="button" onClick={carryOn}>
                Carry on from {formatTimecode(learner.resumeMs)}
              </button>
            </p>
          ) : null}
          {status && <p role="status">{status}</p>}

          <div className="help-control">
            <button
              type="button"
              aria-expanded={helpOpen}
              aria-controls="stage-help"
              onClick={() => {
                if (!helpOpen) toggled("help");
                setHelpOpen(!helpOpen);
              }}
            >
              Need help?
            </button>
            <div id="stage-help" hidden={!helpOpen} className="stage-help">
              <p>Asking for help never counts against you.</p>
              <ul>
                {view.listening && !transcriptShown && (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setTranscriptAsked(true);
                        toggled("transcript");
                      }}
                    >
                      Show the transcript
                    </button>
                  </li>
                )}
                {!taught && (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setCaptions({ taught: true });
                        toggled("fijian-captions");
                      }}
                    >
                      Show the {language.name} captions
                    </button>
                  </li>
                )}
                {!props.tracks.english && helpLine && (
                  <li>
                    <button type="button" onClick={revealEnglish}>
                      Show the English for {lineOf(helpLine.id).toLowerCase()}
                    </button>
                  </li>
                )}
                {!view.meanings && (
                  <li>
                    <Link to={stagePath("words")} reloadDocument>
                      Word meanings are in step 3: {nameOf("words")}
                    </Link>
                  </li>
                )}
                {previous && (
                  <li>
                    <Link to={stagePath(previous)} reloadDocument>
                      Go back a step: {nameOf(previous)}
                    </Link>
                  </li>
                )}
                {next && (
                  <li>
                    <Link to={stagePath(next)} reloadDocument>
                      Skip to the next step: {nameOf(next)}
                    </Link>
                  </li>
                )}
              </ul>
              <p role="status" className="help-status">
                {helpStatus}
              </p>
            </div>
          </div>
        </div>
      </div>

      {view.activities.length > 0 ? (
        <section aria-labelledby="activities-heading" className="learner-activities">
          <h2 id="activities-heading">Activities</h2>
          <ol className="activity-list">
            {view.activities.map((activity, index) => {
              const label = `Activity ${index + 1}`;
              const segment = segments.find((item) => item.id === activity.segmentId);
              return (
                <li key={activity.id}>
                  <h3>
                    {label}
                    <span className="meta">
                      {activity.kind === "real-world"
                        ? " · optional and private"
                        : activity.required
                          ? " · needed to complete"
                          : " · optional"}
                    </span>
                  </h3>
                  <ActivityCard
                    id={`activity-${activity.id}`}
                    label={label}
                    activity={activity}
                    languageTag={language.tag}
                    initialViaText={support.textRoute}
                    onPlay={() => (segment ? startReplay(segment, false) : playClip())}
                    onAnswer={(correct) => answered(activity.id, correct)}
                    onRouteChange={() => toggled("text-route")}
                    onReflect={(choice) => {
                      record({ type: "real-world", ...onLayer, activityId: activity.id, choice });
                      setSession((current) => ({
                        ...current,
                        progress: recordRealWorld(current.progress, activity.id, choice),
                      }));
                    }}
                  />
                </li>
              );
            })}
          </ol>
        </section>
      ) : (
        stageHasActivities(stage) && (
          <p>
            There's nothing to do in this step here.{" "}
            {next && (
              <Link to={stagePath(next)} reloadDocument>
                Go on to {nameOf(next)}
              </Link>
            )}
          </p>
        )
      )}

      {view.notes.length > 0 && (
        <section aria-labelledby="notes-heading" className="context-notes">
          <h2 id="notes-heading">Culture and context</h2>
          <ul>
            {[null, ...segments.map((segment) => segment.id)].flatMap((segmentId) =>
              notesFor(segmentId).map((note) => (
                <li key={note.id}>
                  <p>
                    <strong>{NOTE_KINDS[note.kind]}</strong>
                    {segmentId && ` on ${lineOf(segmentId).toLowerCase()}`}: {note.text}
                  </p>
                  <p className="meta">From {note.attribution}</p>
                </li>
              )),
            )}
          </ul>
        </section>
      )}

      {transcriptShown ? (
        <section aria-labelledby="transcript-heading" className="transcript">
          <h2 id="transcript-heading">Transcript</h2>
          <p className="hint">
            {annotations.length ? "Underlined words open their meaning. " : ""}A line's time plays the video from there.
          </p>
          <ol className="transcript-list">
            {segments.map((segment, index) => {
              const label = lineName(index);
              const runs = runsBySegment.get(segment.id) ?? [];
              const isPlaying = playingId === segment.id;
              const translation = englishOf(segment);
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
                  {translation && <p className="transcript-english">{translation}</p>}
                </li>
              );
            })}
          </ol>
        </section>
      ) : (
        <p className="hint">
          The transcript is hidden while you listen. Choose "Need help?" to show it, or the {language.name} captions.
        </p>
      )}

      {view.meanings && (
        <section aria-labelledby="meanings-heading" className="vocabulary">
          <h2 id="meanings-heading">Words and meanings</h2>
          {meanings.length ? (
            <dl className="vocabulary-list">
              {meanings.map(({ expressionId, expression, keyWord, places }) => (
                <div key={expressionId}>
                  <dt>
                    <span lang={language.tag}>{expression.headword}</span>
                    {keyWord && <span className="key-word"> Key word</span>}
                    {learner && (
                      <>
                        {" "}
                        <SaveToggle
                          saved={saved.words.includes(expressionId)}
                          status={queueStatus}
                          onChange={(on) => saveWord(expressionId, on)}
                          label={{ save: "Save", saving: "Saving…", saved: "Saved" }}
                          name={expression.headword}
                        />
                      </>
                    )}
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
            <p>No words are explained here yet.</p>
          )}
        </section>
      )}

      <nav aria-label="Next and previous steps" className="stage-pager">
        {previous && (
          <Link to={stagePath(previous)} reloadDocument>
            Previous step: {nameOf(previous)}
          </Link>
        )}
        {next && (
          <Link to={stagePath(next)} reloadDocument>
            Next step: {nameOf(next)}
          </Link>
        )}
      </nav>

      <aside aria-labelledby="progress-heading" className="learner-progress">
        <h2 id="progress-heading">Your progress</h2>
        {loaded && (
          <>
            <p role="status">
              {summary.completion.required === 0
                ? "There's nothing to complete here yet."
                : summary.completion.complete
                  ? `You've completed ${props.title}.`
                  : `${summary.completion.done} of ${summary.completion.required} needed Activities done.`}
            </p>
            {remaining.length > 0 && (
              <ul>
                {remaining.map(({ id, left }) => (
                  <li key={id}>
                    <Link to={stagePath(id)} reloadDocument>
                      {nameOf(id)}
                    </Link>
                    : {left} to do
                  </li>
                ))}
              </ul>
            )}
            {summary.answers.checked > 0 && (
              <p>
                Answers right: {summary.answers.right} of {summary.answers.checked}.
              </p>
            )}
            {summary.practised > 0 && <p>Activities tried: {summary.practised}.</p>}
            {Object.entries(summary.realWorld).map(([id, choice]) => (
              <p key={id}>Using it with someone: {REAL_WORLD_SAID[choice]}.</p>
            ))}
          </>
        )}
        <p className="meta">
          Completing it means trying each needed Activity and seeing its feedback. Watching alone doesn't complete it,
          and right answers aren't needed.
        </p>
        {learner ? (
          <>
            {learner.completedEarlier && <p>You completed an earlier version of this. It has changed since.</p>}
            {learner.earlier.length > 0 && (
              <p>
                You answered {learner.earlier.length === 1 ? "an Activity" : `${learner.earlier.length} Activities`} on
                an earlier version. {learner.earlier.length === 1 ? "It has" : "They have"} changed since, so{" "}
                {learner.earlier.length === 1 ? "it isn't" : "they aren't"} counted here.
              </p>
            )}
            <p className="meta">
              Your progress goes to your account as you learn, so you can carry on from any device.{" "}
              <Link to={LEARNER_PATHS.home} reloadDocument>
                Your learning
              </Link>
            </p>
          </>
        ) : (
          <p className="meta">
            Your progress is kept only on this device, until you close this tab.{" "}
            <Link to={LEARNER_PATHS.signIn} reloadDocument>
              Save your learning with an optional account
            </Link>{" "}
            to keep it across devices, with the videos and words you save.
          </p>
        )}
        <fieldset className="learner-settings">
          <legend>Your settings</legend>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={support.alwaysCaptions}
              onChange={(event) => {
                updateSupport({ alwaysCaptions: event.target.checked });
                toggled("always-captions");
              }}
            />{" "}
            Always show the {language.name} captions and the transcript
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={support.textRoute}
              onChange={(event) => {
                updateSupport({ textRoute: event.target.checked });
                toggled("text-route");
              }}
            />{" "}
            Start Activities in their text versions
          </label>
        </fieldset>
      </aside>

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
