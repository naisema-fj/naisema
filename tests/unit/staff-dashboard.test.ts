import { describe, expect, it } from "vitest";
import { backupLine, dueCounts, waitedText } from "~/lib/staff-dashboard";

const now = new Date("2026-10-12T10:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("how long something has waited", () => {
  it("says so in days, and 'since today' inside the first day", () => {
    expect(waitedText(ago(2 * HOUR), now)).toBe("waiting since today");
    expect(waitedText(ago(DAY), now)).toBe("waiting 1 day");
    expect(waitedText(ago(3 * DAY + 5 * HOUR), now)).toBe("waiting 3 days");
  });

  it("never says a negative time for something received a moment from now", () => {
    expect(waitedText(new Date(now.getTime() + HOUR), now)).toBe("waiting since today");
  });
});

describe("what is due", () => {
  it("counts due dates that have passed and those in the next two days, and ignores the rest", () => {
    const today = new Date("2026-10-12T22:00:00Z");

    expect(
      dueCounts(["2026-10-10", "2026-10-11", "2026-10-12", "2026-10-14", "2026-10-15", "2026-11-01"], today),
    ).toEqual({
      overdue: 2,
      soon: 2,
    });
    expect(dueCounts([], today)).toEqual({ overdue: 0, soon: 0 });
  });
});

describe("the last backup", () => {
  it("says when it last succeeded, that it failed, or that none has run", () => {
    expect(backupLine(null, now)).toEqual({ ok: false, text: "No backup has run yet." });
    expect(backupLine({ startedAt: ago(5 * HOUR), ok: true }, now)).toEqual({
      ok: true,
      text: "The last backup succeeded 5 hours ago.",
    });
    expect(backupLine({ startedAt: ago(DAY + HOUR), ok: true }, now).text).toBe("The last backup succeeded 1 day ago.");
    expect(backupLine({ startedAt: ago(2 * HOUR), ok: false }, now)).toEqual({
      ok: false,
      text: "The last backup failed, 2 hours ago.",
    });
  });

  it("flags a backup that succeeded but is more than a day and a half old", () => {
    expect(backupLine({ startedAt: ago(2 * DAY), ok: true }, now)).toEqual({
      ok: false,
      text: "The last backup succeeded 2 days ago, which is overdue.",
    });
  });
});
