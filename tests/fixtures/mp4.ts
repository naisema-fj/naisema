/**
 * Builders for ISO media (MP4 and MOV) boxes, for tests of reading a video master's length and
 * picture size (app/lib/mp4-facts.ts).
 */

export const text = (value: string) => [...value].map((char) => char.charCodeAt(0));
export const u32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];
export const u64 = (value: number) => [...u32(Math.floor(value / 2 ** 32)), ...u32(value >>> 0)];
const u16 = (value: number) => [(value >>> 8) & 0xff, value & 0xff];
const fixed = (value: number) => u32(Math.round(value * 65536) >>> 0);

/** An ISO media box: its size, its four-letter type, then its contents. */
export const box = (type: string, ...contents: number[][]) => {
  const body = contents.flat();
  return [...u32(8 + body.length), ...text(type), ...body];
};

export const mvhd = (timescale: number, duration: number, version = 0) =>
  version === 1
    ? box("mvhd", [1, 0, 0, 0], u64(0), u64(0), u32(timescale), u64(duration), new Array(80).fill(0))
    : box("mvhd", [0, 0, 0, 0], u32(0), u32(0), u32(timescale), u32(duration), new Array(80).fill(0));

export const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const ROTATED_90 = [0, 1, 0, -1, 0, 0, 0, 0, 1];

const matrix = (values: number[]) =>
  values.flatMap((value, index) => (index % 3 === 2 ? u32(value === 1 ? 0x40000000 : 0) : fixed(value)));

export const tkhd = (width: number, height: number, values = IDENTITY, version = 0) =>
  box(
    "tkhd",
    [version, 0, 0, 7],
    version === 1
      ? [...u64(0), ...u64(0), ...u32(1), ...u32(0), ...u64(0)]
      : [...u32(0), ...u32(0), ...u32(1), ...u32(0), ...u32(0)],
    new Array(8).fill(0),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    matrix(values),
    fixed(width),
    fixed(height),
  );

export const trak = (handler: string, header: number[]) =>
  box(
    "trak",
    header,
    box("mdia", box("mdhd", new Array(24).fill(0)), box("hdlr", u32(0), u32(0), text(handler), new Array(12).fill(0))),
  );

export const moov = (...children: number[][]) => box("moov", ...children);
export const ftyp = box("ftyp", text("isom"), u32(0x200), text("isomiso2mp41"));

/**
 * A small but complete MP4: its type, a movie header of this length with one video track of this
 * picture size, and some media bytes.
 */
export function mp4({
  seconds,
  width = 1280,
  height = 720,
  mediaBytes = 2048,
}: {
  seconds: number;
  width?: number;
  height?: number;
  mediaBytes?: number;
}) {
  return Uint8Array.from([
    ...ftyp,
    ...moov(mvhd(1000, Math.round(seconds * 1000)), trak("vide", tkhd(width, height))),
    ...box("mdat", new Array(mediaBytes).fill(0)),
  ]);
}

/** An MP4 that opens like one but has no movie header, so its length can't be read. */
export const mp4WithoutMoov = () => Uint8Array.from([...ftyp, ...box("mdat", new Array(2048).fill(0))]);
