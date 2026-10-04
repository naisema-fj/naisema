/**
 * A video master's length and picture size, read from its ISO media boxes (MP4 and MOV share the
 * layout) before it is sent anywhere, so the 15-minute limit (docs/decision-log.md) is enforced on
 * what the file is rather than what the uploader's browser said. Only box headers and the movie
 * header (`moov`) are read, through ranged reads, so a 2 GB master is never held in memory. The
 * movie header may come before or after the media (`mdat`).
 */

/** Reads `length` bytes from `offset` (fewer at the end of the file). */
export type RangeReader = (offset: number, length: number) => Promise<Uint8Array>;

export type VideoFacts = { durationMs: number; width: number; height: number };

export type VideoFactsResult = { ok: true; facts: VideoFacts } | { ok: false; error: string };

/** The largest movie header read: a 15-minute video's sample tables are a few megabytes. */
export const MAX_MOOV_BYTES = 16 * 1024 * 1024;

/** Top-level boxes walked before giving up: a real file has a handful. */
const MAX_TOP_LEVEL_BOXES = 64;

const UNREADABLE = "The video's length couldn't be read from the file. Export it again as MP4 or MOV and upload that.";
const NO_PICTURE = "The file has no video track. Upload a video, not a sound recording.";

const u32 = (bytes: Uint8Array, at: number) =>
  ((bytes[at] << 24) >>> 0) + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3];
const u64 = (bytes: Uint8Array, at: number) => u32(bytes, at) * 2 ** 32 + u32(bytes, at + 4);
const boxType = (bytes: Uint8Array, at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
/** A signed 16.16 fixed-point number. */
const fixed = (bytes: Uint8Array, at: number) => (u32(bytes, at) | 0) / 65536;

type Box = { type: string; start: number; body: number; end: number };

/**
 * The box whose header starts at `at` in `bytes`, which hold the file from `offset`; `end` is
 * where its parent (or the file) ends. Null if the header is cut short or claims too much.
 */
function boxAt(bytes: Uint8Array, at: number, offset: number, end: number): Box | null {
  if (at + 8 > bytes.length) return null;
  let size = u32(bytes, at);
  let header = 8;
  if (size === 1) {
    if (at + 16 > bytes.length) return null;
    size = u64(bytes, at + 8);
    header = 16;
  } else if (size === 0) {
    size = end - (offset + at);
  }
  const start = offset + at;
  if (size < header || start + size > end) return null;
  return { type: boxType(bytes, at + 4), start, body: start + header, end: start + size };
}

/** The boxes inside `bytes` from `from` to `to`, or null if one is malformed. */
function childBoxes(bytes: Uint8Array, from: number, to: number): Box[] | null {
  const boxes: Box[] = [];
  for (let at = from; at + 8 <= to; ) {
    const box = boxAt(bytes.subarray(0, to), at, 0, to);
    if (!box) return null;
    boxes.push(box);
    at = box.end;
  }
  return boxes;
}

const childBox = (bytes: Uint8Array, parent: Box, name: string) =>
  childBoxes(bytes, parent.body, parent.end)?.find((box) => box.type === name);

/** Finds the movie header among the top-level boxes and reads it whole. */
async function readMoov(read: RangeReader, size: number): Promise<Uint8Array | string> {
  let offset = 0;
  for (let count = 0; count < MAX_TOP_LEVEL_BOXES && offset + 8 <= size; count++) {
    const box = boxAt(await read(offset, 16), 0, offset, size);
    if (!box) return UNREADABLE;
    if (box.type === "moov") {
      const length = box.end - box.start;
      if (length > MAX_MOOV_BYTES) return UNREADABLE;
      const moov = await read(offset, length);
      return moov.length === length ? moov : UNREADABLE;
    }
    offset = box.end;
  }
  return UNREADABLE;
}

/**
 * A fragmented file's length, from its movie extends header (`mvex`/`mehd`), for files whose
 * movie header leaves the length at zero because the media follows in fragments.
 */
function fragmentedDuration(bytes: Uint8Array, boxes: Box[]) {
  const mvex = boxes.find((box) => box.type === "mvex");
  const mehd = mvex && childBox(bytes, mvex, "mehd");
  if (!mehd) return 0;
  return bytes[mehd.body] === 1 ? u64(bytes, mehd.body + 4) : u32(bytes, mehd.body + 4);
}

/** A video track's picture size as shown, turned by its matrix where it is rotated 90° either way. */
function pictureSize(bytes: Uint8Array, tkhd: Box) {
  const version = bytes[tkhd.body];
  const matrixAt = tkhd.body + (version === 1 ? 36 : 24) + 16;
  if (matrixAt + 44 > tkhd.end) return null;
  const width = Math.round(fixed(bytes, matrixAt + 36));
  const height = Math.round(fixed(bytes, matrixAt + 40));
  const [a, d] = [fixed(bytes, matrixAt), fixed(bytes, matrixAt + 16)];
  return a === 0 && d === 0 ? { width: height, height: width } : { width, height };
}

export async function readVideoFacts(read: RangeReader, size: number): Promise<VideoFactsResult> {
  const moov = await readMoov(read, size);
  if (typeof moov === "string") return { ok: false, error: moov };
  const top = childBoxes(moov, 0, moov.length)?.[0];
  const boxes = top && childBoxes(moov, top.body, top.end);
  if (!boxes) return { ok: false, error: UNREADABLE };

  const mvhd = boxes.find((box) => box.type === "mvhd");
  if (!mvhd) return { ok: false, error: UNREADABLE };
  const version = moov[mvhd.body];
  const [timescale, headerDuration] =
    version === 1
      ? [u32(moov, mvhd.body + 20), u64(moov, mvhd.body + 24)]
      : [u32(moov, mvhd.body + 12), u32(moov, mvhd.body + 16)];
  // All ones means the length isn't known; zero, that it is in the fragments' header.
  const unknown = version === 1 ? headerDuration === 2 ** 64 - 1 : headerDuration === 0xffffffff;
  const duration = headerDuration || fragmentedDuration(moov, boxes);
  if (!timescale || !duration || unknown) return { ok: false, error: UNREADABLE };

  for (const trak of boxes.filter((box) => box.type === "trak")) {
    const mdia = childBox(moov, trak, "mdia");
    const hdlr = mdia && childBox(moov, mdia, "hdlr");
    if (!hdlr || boxType(moov, hdlr.body + 8) !== "vide") continue;
    const tkhd = childBox(moov, trak, "tkhd");
    const picture = tkhd && pictureSize(moov, tkhd);
    if (picture && picture.width > 0 && picture.height > 0) {
      return { ok: true, facts: { durationMs: Math.round((duration * 1000) / timescale), ...picture } };
    }
  }
  return { ok: false, error: NO_PICTURE };
}
