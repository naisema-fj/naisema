import type { ReactNode } from "react";

/**
 * A table's scroll box. On a narrow screen a wide table scrolls inside this box, not the page, so
 * the table itself never needs `display: block` (which can drop its semantics in screen readers).
 * The box is a labelled, focusable region so the table can be scrolled by keyboard.
 */
export function TableScroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard.
    <section className="table-scroll" aria-label={label} tabIndex={0}>
      {children}
    </section>
  );
}
