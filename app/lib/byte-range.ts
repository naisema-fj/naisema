/** A part of a file asked for by a Range header: from `offset`, `length` bytes. */
export type ByteRange = { offset: number; length: number };

/**
 * Reads a single-range `Range: bytes=…` header against a file of `size` bytes, as an audio
 * player sends when it starts or seeks. Null means "send the whole file" (no header, or one this
 * doesn't serve, such as several ranges, or an invalid one ending before it starts, which a
 * server answers in full: RFC 9110 §14.2); "unsatisfiable" answers 416.
 */
export function parseRange(header: string | null, size: number): ByteRange | "unsatisfiable" | null {
  const match = header?.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) return null;
  const [, start, end] = match;
  if (!start) {
    const suffix = Number(end);
    if (suffix === 0) return "unsatisfiable";
    const length = Math.min(suffix, size);
    return { offset: size - length, length };
  }
  const offset = Number(start);
  if (end && Number(end) < offset) return null;
  if (offset >= size) return "unsatisfiable";
  const last = end ? Math.min(Number(end), size - 1) : size - 1;
  return { offset, length: last - offset + 1 };
}
