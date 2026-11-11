/**
 * Help beside the thing it explains, as a native disclosure: it opens on tap, click or Enter, with
 * no JavaScript and no hover, so it works on a phone, with a keyboard and with a screen reader.
 * Closed by default so it never gets in the way of someone who already knows.
 */
export function WhatsThis({
  children,
  summary = "What's this?",
  className,
}: {
  children: React.ReactNode;
  summary?: string;
  className?: string;
}) {
  return (
    <details className={className ? `whats-this ${className}` : "whats-this"}>
      <summary>{summary}</summary>
      <div className="whats-this-body">{children}</div>
    </details>
  );
}
