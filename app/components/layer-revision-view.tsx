import { ACTIVITY_KINDS } from "~/lib/activities";
import { annotatedText, NOTE_KINDS } from "~/lib/annotations";
import { LAYER_LEVELS, type LearningLayerSnapshot, layerSpan } from "~/lib/learning-layer-fields";
import { formatTimecode } from "~/lib/segment-rules";

/**
 * One Learning Layer Revision as a reviewer reads it, exactly as saved: its details, every Segment
 * with its words, Annotations and notes, the notes on the whole Learning Layer, and every Activity
 * with its answers. Shown to staff reviewing it and through a Review Link, so both see the same.
 */
export function LayerRevisionView({
  snapshot,
  languageVariety,
}: {
  snapshot: LearningLayerSnapshot;
  /** The Language Variety the Learning Layer teaches, as stored on it. */
  languageVariety: string;
}) {
  const segmentIds = new Set(snapshot.segments.map((segment) => segment.id));
  const segmentName = (id: string | null) => {
    const at = snapshot.segments.findIndex((segment) => segment.id === id);
    return at < 0 ? "the whole clip" : `Segment ${at + 1}`;
  };
  const layerNotes = snapshot.notes.filter((note) => note.segmentId === null || !segmentIds.has(note.segmentId));
  return (
    <div className="layer-revision">
      <dl>
        <dt>Level</dt>
        <dd>{LAYER_LEVELS[snapshot.level]}</dd>
        <dt>Built on</dt>
        <dd>{layerSpan(snapshot.excerpt)}</dd>
        <dt>Language Variety</dt>
        <dd>{languageVariety === "standard-fijian" ? "Standard Fijian" : languageVariety}</dd>
      </dl>

      <h2>Segments</h2>
      {snapshot.segments.length ? (
        <ol className="segment-list">
          {snapshot.segments.map((segment, index) => {
            const annotations = snapshot.annotations.filter((annotation) => annotation.segmentId === segment.id);
            const notes = snapshot.notes.filter((note) => note.segmentId === segment.id);
            return (
              <li key={segment.id} className="segment" aria-label={`Segment ${index + 1}`}>
                <h3>
                  Segment {index + 1}{" "}
                  <span className="meta">
                    {formatTimecode(segment.startMs)} to {formatTimecode(segment.endMs)}
                    {segment.speaker && ` · ${segment.speaker}`}
                  </span>
                  {segment.draft && <span className="badge">Unreviewed draft</span>}
                </h3>
                <p lang="fj">{segment.fijian}</p>
                {segment.english && <p className="segment-english">{segment.english}</p>}
                {annotations.length > 0 && (
                  <ul className="annotation-list" aria-label={`Annotations in Segment ${index + 1}`}>
                    {annotations.map((annotation) => {
                      const expression = snapshot.expressions[annotation.expressionId];
                      return (
                        <li key={annotation.id}>
                          <span lang="fj">
                            “{annotatedText(snapshot.segments, annotation) ?? "words no longer there"}”
                          </span>
                          {expression && (
                            <>
                              {" "}
                              (<span lang="fj">{expression.headword}</span>: {expression.generalMeaning}
                              {expression.literalMeaning && `; literally “${expression.literalMeaning}”`}
                              {expression.pronunciation && `; said ${expression.pronunciation}`})
                            </>
                          )}
                          : {annotation.contextualMeaning}
                          {annotation.grammarNote && `. Grammar: ${annotation.grammarNote}`}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {notes.map((note) => (
                  <p key={note.id} className="note">
                    {NOTE_KINDS[note.kind]}: {note.text} <span className="meta">From {note.attribution}</span>
                  </p>
                ))}
              </li>
            );
          })}
        </ol>
      ) : (
        <p>No Segments yet.</p>
      )}

      {layerNotes.length > 0 && (
        <>
          <h2>Notes on the whole Learning Layer</h2>
          {layerNotes.map((note) => (
            <p key={note.id} className="note">
              {NOTE_KINDS[note.kind]}: {note.text} <span className="meta">From {note.attribution}</span>
            </p>
          ))}
        </>
      )}

      <h2>Activities</h2>
      {snapshot.activities.length ? (
        <ol className="activity-list">
          {snapshot.activities.map((activity, index) => (
            <li key={activity.id} className="activity" aria-label={`Activity ${index + 1}`}>
              <h3>
                Activity {index + 1}: {ACTIVITY_KINDS[activity.kind]}
                {activity.required && activity.kind !== "real-world" && <span className="badge">Required</span>}
              </h3>
              <dl>
                <dt>Practises</dt>
                <dd>{segmentName(activity.segmentId)}</dd>
                <dt>Prompt</dt>
                <dd>{activity.prompt}</dd>
                {activity.options.length > 0 && (
                  <>
                    <dt>Choices</dt>
                    <dd>
                      <ul>
                        {activity.options.map((option) => (
                          <li key={option.id}>{option.correct ? `${option.text} (correct)` : option.text}</li>
                        ))}
                      </ul>
                    </dd>
                  </>
                )}
                {activity.modelResponse && (
                  <>
                    <dt>{activity.kind === "listen-repeat" ? "Words to repeat" : "Model response"}</dt>
                    <dd lang="fj">{activity.modelResponse}</dd>
                  </>
                )}
                {activity.pronunciation && (
                  <>
                    <dt>Pronunciation guidance</dt>
                    <dd>{activity.pronunciation}</dd>
                  </>
                )}
                {activity.feedback && (
                  <>
                    <dt>Feedback</dt>
                    <dd>{activity.feedback}</dd>
                  </>
                )}
                <dt>Text alternative</dt>
                <dd>{activity.textAlternative}</dd>
              </dl>
            </li>
          ))}
        </ol>
      ) : (
        <p>No Activities yet.</p>
      )}
    </div>
  );
}
