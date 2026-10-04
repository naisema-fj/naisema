/** A transcript's paragraphs, each starting with who speaks when the transcript says. */
export function TranscriptParagraphs({ paragraphs }: { paragraphs: { speaker: string | null; text: string }[] }) {
  return paragraphs.map((paragraph, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: a stored transcript is rendered once and never reordered.
    <p key={index}>
      {paragraph.speaker && <strong className="speaker">{`${paragraph.speaker}: `}</strong>}
      {paragraph.text}
    </p>
  ));
}
