import { type ChangeEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Form } from "react-router";
import { LAYER_LEVELS, type LayerDetailField, type LearningLayerSnapshot } from "~/lib/learning-layer-fields";
import {
  clipDuration,
  type Excerpt,
  formatTimecode,
  nudge,
  parseTimecode,
  retimeExcerpt,
  type Segment,
  type SegmentField,
  type SegmentProblem,
  segmentProblems,
} from "~/lib/segment-rules";
import { importWebVtt, parseWebVtt, type SegmentLanguage } from "~/lib/webvtt";
import { VideoPreview } from "./video-preview";

/**
 * The timeline editor for a Learning Layer's Segments (VCMS-02/04, docs/phase-1a-defaults.md §2):
 * time fields that take typed times, the arrow keys (100 ms a press) or the playhead; replaying a
 * Segment; WebVTT import; and a preview of the captions in landscape and vertical layouts. It
 * checks the Segments as they change and names the exact Segment and field; the server checks
 * them again when they are saved. Everything is kept in the page until it is saved.
 */

type Props = {
  layerId: string;
  baseRevisionId: string;
  snapshot: LearningLayerSnapshot;
  videoDurationMs: number;
  /** The video's own orientation, which the preview starts in. */
  orientation: "landscape" | "portrait" | "square";
  preview: { src: string; hls: boolean } | null;
  previewError: string | null;
  /** What the server refused, when a save was sent back. */
  refused: {
    error: string;
    errors?: Partial<Record<LayerDetailField, string>>;
    problems?: SegmentProblem[];
  } | null;
};

const newSegment = (startMs: number, clipMs: number): Segment => ({
  id: crypto.randomUUID(),
  startMs: Math.min(startMs, Math.max(0, clipMs - 1000)),
  endMs: Math.min(clipMs, startMs + 2000),
  speaker: "",
  fijian: "",
  english: "",
  overlapIntended: false,
  draft: false,
  retimed: false,
});

const excerptFields = (excerpt: Excerpt) => ({
  clip: excerpt ? "excerpt" : "whole",
  sourceStart: excerpt ? formatTimecode(excerpt.sourceStartMs) : "",
  sourceEnd: excerpt ? formatTimecode(excerpt.sourceEndMs) : "",
});

export function TimelineEditor({
  layerId,
  baseRevisionId,
  snapshot,
  videoDurationMs,
  orientation,
  preview,
  previewError,
  refused,
}: Props) {
  const [title, setTitle] = useState(snapshot.title);
  const [level, setLevel] = useState<string>(snapshot.level);
  const [clipForm, setClipForm] = useState(excerptFields(snapshot.excerpt));
  const [excerpt, setExcerpt] = useState<Excerpt>(snapshot.excerpt);
  const [clipError, setClipError] = useState("");
  const [segments, setSegments] = useState<Segment[]>(snapshot.segments);
  const [layout, setLayout] = useState<"landscape" | "portrait">(orientation === "portrait" ? "portrait" : "landscape");
  const [playheadMs, setPlayheadMs] = useState(0);
  const [status, setStatus] = useState("");
  const video = useRef<HTMLVideoElement | null>(null);
  const stopAt = useRef<number | null>(null);

  const clipMs = clipDuration(excerpt, videoDurationMs);
  const offsetMs = excerpt?.sourceStartMs ?? 0;
  const problems = useMemo(() => segmentProblems(segments, clipMs), [segments, clipMs]);
  // The server's report on a refused save stands until the Segments change.
  const [serverProblems, setServerProblems] = useState(refused?.problems ?? []);
  useEffect(() => setServerProblems(refused?.problems ?? []), [refused]);
  const shown = serverProblems.length ? serverProblems : problems;
  const problemFor = (id: string, field: SegmentField) =>
    shown.find((problem) => problem.segmentId === id && problem.field === field)?.message;

  // Follow the playhead, in clip time, and stop a replay at its Segment's end.
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const element = video.current;
      if (element) {
        const clipTime = Math.round(element.currentTime * 1000) - offsetMs;
        setPlayheadMs(Math.max(0, Math.min(clipMs, clipTime)));
        if (stopAt.current !== null && clipTime >= stopAt.current) {
          element.pause();
          stopAt.current = null;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [offsetMs, clipMs]);

  const update = (index: number, change: Partial<Segment>) => {
    setServerProblems([]);
    setSegments((current) =>
      current.map((segment, at) =>
        at === index
          ? {
              ...segment,
              ...change,
              // Editing a retimed Segment's times is checking them.
              retimed: "startMs" in change || "endMs" in change ? false : segment.retimed,
            }
          : segment,
      ),
    );
  };

  const seek = (clipTimeMs: number) => {
    if (video.current) video.current.currentTime = (offsetMs + clipTimeMs) / 1000;
  };

  const replay = (segment: Segment) => {
    const element = video.current;
    if (!element) return;
    stopAt.current = segment.endMs;
    element.currentTime = (offsetMs + segment.startMs) / 1000;
    element.play().catch(() => setStatus("The video couldn't play. Press play on the video first."));
  };

  const timeKeys = (index: number, field: "startMs" | "endMs") => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const value = nudge(segments[index][field], event.key === "ArrowUp" ? 1 : -1, clipMs);
    update(index, { [field]: value });
    seek(value);
  };

  const applyClip = () => {
    setClipError("");
    let next: Excerpt = null;
    if (clipForm.clip === "excerpt") {
      const start = parseTimecode(clipForm.sourceStart);
      const end = parseTimecode(clipForm.sourceEnd);
      if (start === null || end === null || end <= start || end > videoDurationMs) {
        setClipError("Enter an in time and a later out time within the video, like 0:10.000 and 0:45.500.");
        return;
      }
      next = { sourceStartMs: start, sourceEndMs: end };
    }
    const retimed = retimeExcerpt(segments, excerpt, next, videoDurationMs);
    const flagged = retimed.filter((segment, index) => segment.retimed && !segments[index].retimed).length;
    setSegments(retimed);
    setExcerpt(next);
    setServerProblems([]);
    setStatus(
      flagged
        ? `The clip changed. ${flagged === 1 ? "One Segment no longer fits" : `${flagged} Segments no longer fit`}: check the ones marked "Retimed".`
        : "The clip changed. Every Segment still fits.",
    );
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>, language: SegmentLanguage) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setStatus("That WebVTT file is over 1 MB, which is more than one Learning Layer holds.");
      return;
    }
    const parsed = parseWebVtt(await file.text());
    if (!parsed.ok) {
      setStatus(parsed.error);
      return;
    }
    if (language === "fijian" && segments.length && !window.confirm("Replace every Segment with the file's cues?"))
      return;
    const result = importWebVtt(parsed.cues, segments, language);
    setSegments(result.segments);
    setServerProblems([]);
    setStatus(
      language === "fijian"
        ? `Imported ${result.matched} Segments as unreviewed drafts. Save to keep them.`
        : `Filled ${result.matched} English translations as unreviewed drafts${result.unmatched ? `; ${result.unmatched} cues matched no Segment` : ""}. Save to keep them.`,
    );
  };

  const playing = segments.filter((segment) => segment.startMs <= playheadMs && playheadMs < segment.endMs);
  const detailError = (field: LayerDetailField) => refused?.errors?.[field];

  return (
    <div className="timeline-editor">
      <noscript>
        <p role="alert">The timeline editor needs JavaScript. Turn it on to edit Segments.</p>
      </noscript>
      {refused && (
        <div role="alert" className="form-errors">
          <p>{refused.error}</p>
        </div>
      )}
      {shown.length > 0 && (
        <section aria-labelledby="problems-heading" className="segment-problems">
          <h2 id="problems-heading">{shown.length === 1 ? "1 thing to fix" : `${shown.length} things to fix`}</h2>
          <ul>
            {shown.map((problem) => (
              <li key={`${problem.segmentId}-${problem.field}`}>
                <a href={`#segment-${problem.segmentId}-${problem.field}`}>{problem.message}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {status && (
        <p role="status" className="editor-status">
          {status}
        </p>
      )}

      <div className="timeline-layout">
        <section aria-labelledby="preview-heading" className="timeline-preview">
          <h2 id="preview-heading">Preview</h2>
          <fieldset className="layout-choice">
            <legend>Show as</legend>
            <label>
              <input
                type="radio"
                name="previewLayout"
                checked={layout === "landscape"}
                onChange={() => setLayout("landscape")}
              />{" "}
              Landscape
            </label>
            <label>
              <input
                type="radio"
                name="previewLayout"
                checked={layout === "portrait"}
                onChange={() => setLayout("portrait")}
              />{" "}
              Vertical (phone)
            </label>
          </fieldset>
          {preview ? (
            <VideoPreview
              src={preview.src}
              hls={preview.hls}
              label="The Learning Layer's video"
              videoRef={video}
              className={`layout-frame layout-${layout}`}
            >
              <div className="caption-overlay" aria-live="off">
                {playing.map((segment) => (
                  <p key={segment.id}>
                    <span lang="fj">{segment.fijian}</span>
                    {segment.english && <span className="caption-english">{segment.english}</span>}
                  </p>
                ))}
              </div>
            </VideoPreview>
          ) : (
            <p role="alert">{previewError ?? "The video can't be previewed yet."}</p>
          )}
          <p className="playhead">
            Playhead <output>{formatTimecode(playheadMs)}</output> of {formatTimecode(clipMs)}
          </p>
        </section>

        <Form method="post" className="timeline-form" aria-labelledby="details-heading">
          <input type="hidden" name="intent" value="save" />
          <input type="hidden" name="baseRevisionId" value={baseRevisionId} />
          <input type="hidden" name="segments" value={JSON.stringify(segments)} />
          <input type="hidden" name="clip" value={excerpt ? "excerpt" : "whole"} />
          <input type="hidden" name="sourceStart" value={excerpt ? formatTimecode(excerpt.sourceStartMs) : ""} />
          <input type="hidden" name="sourceEnd" value={excerpt ? formatTimecode(excerpt.sourceEndMs) : ""} />
          <h2 id="details-heading">Details</h2>
          <label htmlFor="layer-title">Title</label>
          <input
            id="layer-title"
            name="title"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            aria-invalid={detailError("title") ? true : undefined}
          />
          {detailError("title") && <p className="field-error">{detailError("title")}</p>}
          <label htmlFor="layer-level">Level</label>
          <select id="layer-level" name="level" value={level} onChange={(event) => setLevel(event.target.value)}>
            {Object.entries(LAYER_LEVELS).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
          <fieldset>
            <legend>Clip</legend>
            <label>
              <input
                type="radio"
                name="clipChoice"
                checked={clipForm.clip === "whole"}
                onChange={() => setClipForm({ ...clipForm, clip: "whole" })}
              />{" "}
              The whole video ({formatTimecode(videoDurationMs)})
            </label>
            <label>
              <input
                type="radio"
                name="clipChoice"
                checked={clipForm.clip === "excerpt"}
                onChange={() => setClipForm({ ...clipForm, clip: "excerpt" })}
              />{" "}
              An Excerpt
            </label>
            {clipForm.clip === "excerpt" && (
              <div className="excerpt-times">
                <label htmlFor="excerpt-in">In time</label>
                <input
                  id="excerpt-in"
                  value={clipForm.sourceStart}
                  placeholder="0:10.000"
                  onChange={(event) => setClipForm({ ...clipForm, sourceStart: event.target.value })}
                />
                <label htmlFor="excerpt-out">Out time</label>
                <input
                  id="excerpt-out"
                  value={clipForm.sourceEnd}
                  placeholder="0:45.000"
                  onChange={(event) => setClipForm({ ...clipForm, sourceEnd: event.target.value })}
                />
              </div>
            )}
            <button type="button" onClick={applyClip}>
              Use this clip
            </button>
            {(clipError || detailError("sourceStartMs") || detailError("sourceEndMs")) && (
              <p className="field-error">{clipError || detailError("sourceStartMs") || detailError("sourceEndMs")}</p>
            )}
            <p className="hint">Segments stay on the same moment of the video when the clip changes.</p>
          </fieldset>

          <h2 id="segments-heading">Segments</h2>
          <p className="hint">
            Times are from the start of the clip. In a time field, the up and down arrow keys move it 100 ms.
          </p>
          <ol className="segment-list" aria-labelledby="segments-heading">
            {segments.map((segment, index) => {
              const label = `Segment ${index + 1}`;
              const field = (name: SegmentField) => `segment-${segment.id}-${name}`;
              const timeField = (name: "startMs" | "endMs", text: string) => (
                <div className="time-field">
                  <label htmlFor={field(name)}>{text}</label>
                  <input
                    id={field(name)}
                    key={`${segment.id}-${name}-${segment[name]}`}
                    defaultValue={formatTimecode(segment[name])}
                    inputMode="decimal"
                    aria-invalid={problemFor(segment.id, name) ? true : undefined}
                    aria-describedby={problemFor(segment.id, name) ? `${field(name)}-error` : undefined}
                    onKeyDown={timeKeys(index, name)}
                    onBlur={(event) => {
                      const value = parseTimecode(event.target.value);
                      if (value === null) event.target.value = formatTimecode(segment[name]);
                      else if (value !== segment[name]) update(index, { [name]: value });
                    }}
                  />
                  <button type="button" onClick={() => update(index, { [name]: playheadMs })}>
                    {name === "startMs" ? "Set start" : "Set end"} at playhead
                    <span className="visually-hidden"> for {label}</span>
                  </button>
                  {problemFor(segment.id, name) && (
                    <p className="field-error" id={`${field(name)}-error`}>
                      {problemFor(segment.id, name)}
                    </p>
                  )}
                </div>
              );
              return (
                <li key={segment.id} className="segment" aria-label={label}>
                  <h3>
                    {label}
                    {segment.draft && <span className="badge">Unreviewed draft</span>}
                    {segment.retimed && <span className="badge badge-warning">Retimed</span>}
                  </h3>
                  <div className="segment-times">
                    {timeField("startMs", "Start")}
                    {timeField("endMs", "End")}
                    <button type="button" onClick={() => replay(segment)}>
                      Replay<span className="visually-hidden"> {label}</span>
                    </button>
                  </div>
                  <label htmlFor={field("speaker")}>Speaker (optional)</label>
                  <input
                    id={field("speaker")}
                    value={segment.speaker}
                    maxLength={80}
                    onChange={(event) => update(index, { speaker: event.target.value })}
                  />
                  <label htmlFor={field("fijian")}>Fijian</label>
                  <textarea
                    id={field("fijian")}
                    lang="fj"
                    rows={2}
                    value={segment.fijian}
                    maxLength={500}
                    aria-invalid={problemFor(segment.id, "fijian") ? true : undefined}
                    aria-describedby={problemFor(segment.id, "fijian") ? `${field("fijian")}-error` : undefined}
                    onChange={(event) => update(index, { fijian: event.target.value })}
                  />
                  {problemFor(segment.id, "fijian") && (
                    <p className="field-error" id={`${field("fijian")}-error`}>
                      {problemFor(segment.id, "fijian")}
                    </p>
                  )}
                  <label htmlFor={field("english")}>English translation</label>
                  <textarea
                    id={field("english")}
                    rows={2}
                    value={segment.english}
                    maxLength={500}
                    onChange={(event) => update(index, { english: event.target.value })}
                  />
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={segment.overlapIntended}
                      onChange={(event) => update(index, { overlapIntended: event.target.checked })}
                    />{" "}
                    Overlaps the Segment before on purpose
                  </label>
                  <div className="segment-actions">
                    {segment.draft && (
                      <button type="button" onClick={() => update(index, { draft: false })}>
                        I've checked this text<span className="visually-hidden"> in {label}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setServerProblems([]);
                        setSegments(segments.filter((_, at) => at !== index));
                      }}
                    >
                      Remove<span className="visually-hidden"> {label}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="segment-toolbar">
            <button
              type="button"
              onClick={() => {
                const last = segments.at(-1);
                setSegments([...segments, newSegment(last ? last.endMs : playheadMs, clipMs)]);
              }}
            >
              Add a Segment
            </button>
            <button
              type="button"
              onClick={() => setSegments([...segments].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs))}
            >
              Put Segments in time order
            </button>
          </div>

          <fieldset className="webvtt-tools">
            <legend>WebVTT</legend>
            <label htmlFor="import-fijian">Import Fijian (replaces the Segments)</label>
            <input
              id="import-fijian"
              type="file"
              accept=".vtt,text/vtt"
              onChange={(event) => importFile(event, "fijian")}
            />
            <label htmlFor="import-english">Import English translations</label>
            <input
              id="import-english"
              type="file"
              accept=".vtt,text/vtt"
              onChange={(event) => importFile(event, "english")}
            />
            <p className="hint">
              Imported text is marked as an unreviewed draft. Download the saved Segments as{" "}
              <a href={`/admin/learning-layers/${layerId}/webvtt/fijian`}>Fijian WebVTT</a> or{" "}
              <a href={`/admin/learning-layers/${layerId}/webvtt/english`}>English WebVTT</a>.
            </p>
          </fieldset>

          <button type="submit" className="primary">
            Save a new revision
          </button>
        </Form>
      </div>
    </div>
  );
}
