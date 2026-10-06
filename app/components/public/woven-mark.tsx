/**
 * The NAISEMA mark: an N woven from 25 strands, alternately upright and sideways, on the brand's
 * 5 by 5 weave. Its two colours come from the surrounding CSS (`--mark-n`, `--mark-ground`), so one
 * drawing serves every ground; the strands carry classes, never inline styles (the CSP allows none).
 */

/** The strands that draw the N: its two uprights and the diagonal between them. */
const N_STRANDS = new Set(["0,0", "0,4", "1,0", "1,1", "1,4", "2,0", "2,2", "2,4", "3,0", "3,3", "3,4", "4,0", "4,4"]);

const STRANDS = Array.from({ length: 25 }, (_, index) => {
  const row = Math.floor(index / 5);
  const column = index % 5;
  const upright = (row + column) % 2 === 0;
  return {
    key: index,
    x: 10.5 + 18 * column + (upright ? 2 : 0),
    y: 10.5 + 18 * row + (upright ? 0 : 2),
    width: upright ? 11 : 15,
    height: upright ? 15 : 11,
    className: N_STRANDS.has(`${row},${column}`) ? "strand-n" : "strand-ground",
  };
});

/** Decorative wherever it sits beside the NAISEMA wordmark, which names it. */
export function WovenMark({ className = "woven-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {STRANDS.map(({ key, ...strand }) => (
        <rect key={key} rx="1.6" {...strand} />
      ))}
    </svg>
  );
}
