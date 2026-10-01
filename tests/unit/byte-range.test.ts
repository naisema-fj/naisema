import { describe, expect, it } from "vitest";
import { parseRange } from "~/lib/byte-range";

describe("parseRange: the Range header an audio player sends", () => {
  it("is the whole file without a header, or with one it doesn't understand", () => {
    expect(parseRange(null, 1000)).toBeNull();
    expect(parseRange("items=0-10", 1000)).toBeNull();
    expect(parseRange("bytes=0-10, 20-30", 1000)).toBeNull();
    expect(parseRange("bytes=abc", 1000)).toBeNull();
  });

  it("reads a start and end, an open end and a suffix", () => {
    expect(parseRange("bytes=0-99", 1000)).toEqual({ offset: 0, length: 100 });
    expect(parseRange("bytes=900-", 1000)).toEqual({ offset: 900, length: 100 });
    expect(parseRange("bytes=-200", 1000)).toEqual({ offset: 800, length: 200 });
  });

  it("clamps an end past the file, and a suffix longer than it", () => {
    expect(parseRange("bytes=950-5000", 1000)).toEqual({ offset: 950, length: 50 });
    expect(parseRange("bytes=-5000", 1000)).toEqual({ offset: 0, length: 1000 });
  });

  it("can't be satisfied when it starts past the end, ends before it starts, or asks for nothing", () => {
    expect(parseRange("bytes=1000-", 1000)).toBe("unsatisfiable");
    expect(parseRange("bytes=50-10", 1000)).toBe("unsatisfiable");
    expect(parseRange("bytes=-0", 1000)).toBe("unsatisfiable");
  });
});
