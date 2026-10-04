import { formatDay } from "~/lib/rights-rules";

/**
 * A date as it is written on a public page, after its label when it has one ("Published 1 Oct
 * 2026"), with a machine-readable <time>.
 */
export function DateMark({ label, date }: { label?: string; date: Date | string }) {
  const value = new Date(date);
  return (
    <>
      {label && `${label} `}
      <time dateTime={value.toISOString().slice(0, 10)}>{formatDay(value)}</time>
    </>
  );
}

/**
 * The flat, ruled lines that say what a letter is and what was reviewed: postmarks, never seals.
 * Each line states one fact.
 */
export function Postmarks({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <ul className="postmarks" aria-label={label}>
      {children}
    </ul>
  );
}
