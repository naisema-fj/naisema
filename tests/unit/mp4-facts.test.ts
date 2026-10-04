import { describe, expect, it } from "vitest";
import { MAX_MOOV_BYTES, type RangeReader, readVideoFacts } from "~/lib/mp4-facts";
import { box, ftyp, IDENTITY, moov, mvhd, ROTATED_90, text, tkhd, trak, u32, u64 } from "../fixtures/mp4";

/** Reads from parts laid out one after another, some of them only sizes (a large mdat never held in memory). */
function layout(...parts: (number[] | { mdat: number; large?: boolean })[]) {
  const pieces: { offset: number; bytes: Uint8Array; length: number }[] = [];
  let offset = 0;
  for (const part of parts) {
    if (Array.isArray(part)) {
      pieces.push({ offset, bytes: Uint8Array.from(part), length: part.length });
      offset += part.length;
    } else {
      const header = part.large
        ? [...u32(1), ...text("mdat"), ...u64(part.mdat)]
        : [...u32(part.mdat), ...text("mdat")];
      pieces.push({ offset, bytes: Uint8Array.from(header), length: part.mdat });
      offset += part.mdat;
    }
  }
  const reads: { offset: number; length: number }[] = [];
  const read: RangeReader = async (from, length) => {
    reads.push({ offset: from, length });
    const out = new Uint8Array(Math.max(0, Math.min(length, offset - from)));
    for (const piece of pieces) {
      for (let index = 0; index < piece.bytes.length; index++) {
        const at = piece.offset + index - from;
        if (at >= 0 && at < out.length) out[at] = piece.bytes[index];
      }
    }
    return out;
  };
  return { read, size: offset, reads };
}

describe("reading a video master's length and picture size", () => {
  it("reads a fast-start file: length from mvhd, picture size from the video track", async () => {
    const file = layout(ftyp, moov(mvhd(1000, 95_500), trak("soun", tkhd(0, 0)), trak("vide", tkhd(1280, 720))), {
      mdat: 4096,
    });
    expect(await readVideoFacts(file.read, file.size)).toEqual({
      ok: true,
      facts: { durationMs: 95_500, width: 1280, height: 720 },
    });
  });

  it("finds the movie header after a large mdat without reading the media itself", async () => {
    const file = layout(ftyp, { mdat: 1_500_000_000 }, moov(mvhd(90_000, 90_000 * 61), trak("vide", tkhd(720, 1280))));
    expect(await readVideoFacts(file.read, file.size)).toMatchObject({
      ok: true,
      facts: { durationMs: 61_000, width: 720, height: 1280 },
    });
    expect(Math.max(...file.reads.map((read) => read.length))).toBeLessThan(1024);
  });

  it("reads 64-bit sizes and version 1 headers", async () => {
    const file = layout(
      ftyp,
      { mdat: 3_000_000_000, large: true },
      moov(mvhd(600, 600 * 125, 1), trak("vide", tkhd(1920, 1080, IDENTITY, 1))),
    );
    expect(await readVideoFacts(file.read, file.size)).toMatchObject({
      ok: true,
      facts: { durationMs: 125_000, width: 1920, height: 1080 },
    });
  });

  it("swaps the picture size of a phone video recorded on its side and turned upright by its matrix", async () => {
    const file = layout(ftyp, moov(mvhd(1000, 30_000), trak("vide", tkhd(1920, 1080, ROTATED_90))), { mdat: 64 });
    expect(await readVideoFacts(file.read, file.size)).toMatchObject({
      ok: true,
      facts: { width: 1080, height: 1920 },
    });
  });

  it("reads a fragmented file's length from its fragments' header when the movie header leaves it at zero", async () => {
    const mehd = box("mehd", [0, 0, 0, 0], u32(42_000));
    const file = layout(ftyp, moov(mvhd(1000, 0), box("mvex", mehd), trak("vide", tkhd(1280, 720))), { mdat: 64 });
    expect(await readVideoFacts(file.read, file.size)).toMatchObject({ ok: true, facts: { durationMs: 42_000 } });
  });

  it("refuses a file it can't read a length from", async () => {
    const cases = [
      layout(ftyp, { mdat: 4096 }),
      layout(ftyp, moov(trak("vide", tkhd(1280, 720)))),
      layout(ftyp, moov(mvhd(0, 1000), trak("vide", tkhd(1280, 720)))),
      layout(ftyp, moov(mvhd(1000, 0xffffffff), trak("vide", tkhd(1280, 720)))),
      layout(ftyp, moov(mvhd(1000, 0), trak("vide", tkhd(1280, 720)))),
      layout(ftyp, [...u32(4), ...text("free")]),
    ];
    for (const file of cases) {
      expect(await readVideoFacts(file.read, file.size)).toMatchObject({
        ok: false,
        error: expect.stringContaining("length"),
      });
    }
  });

  it("refuses a file with no picture", async () => {
    const file = layout(ftyp, moov(mvhd(1000, 30_000), trak("soun", tkhd(0, 0))));
    expect(await readVideoFacts(file.read, file.size)).toMatchObject({
      ok: false,
      error: expect.stringContaining("no video"),
    });
  });

  it("refuses a movie header too large to read", async () => {
    const header = [...u32(MAX_MOOV_BYTES + 9), ...text("moov")];
    const file = layout(ftyp, header, { mdat: MAX_MOOV_BYTES + 1 });
    expect(await readVideoFacts(file.read, file.size)).toMatchObject({ ok: false });
  });
});
