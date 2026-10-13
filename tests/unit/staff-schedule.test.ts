import { describe, expect, it } from "vitest";
import {
  arrangeSchedule,
  DEFAULT_DAYS,
  dayText,
  dueText,
  lastDayOf,
  rangeDays,
  type ScheduleEntry,
} from "~/lib/staff-schedule";

const TODAY = "2026-10-12";
const NOW = new Date("2026-10-12T02:00:00Z");

const dated = (key: string, date: string, title = key): ScheduleEntry => ({
  key,
  kind: "submission",
  title,
  detail: null,
  date,
  since: null,
  href: `/admin/${key}`,
});
const waiting = (key: string, since: string): ScheduleEntry => ({
  key,
  kind: "review",
  title: key,
  detail: null,
  date: null,
  since: new Date(since),
  href: `/admin/${key}`,
});

describe("rangeDays", () => {
  it("offers 7, 30 and 90 days, and 30 unless asked otherwise", () => {
    expect(rangeDays("7")).toBe(7);
    expect(rangeDays("90")).toBe(90);
    expect(rangeDays(null)).toBe(DEFAULT_DAYS);
    expect(DEFAULT_DAYS).toBe(30);
  });

  it("ignores anything that is not one of the offered ranges", () => {
    expect(rangeDays("45")).toBe(DEFAULT_DAYS);
    expect(rangeDays("-1")).toBe(DEFAULT_DAYS);
    expect(rangeDays("abc")).toBe(DEFAULT_DAYS);
  });
});

describe("lastDayOf", () => {
  it("is the day that many days from today", () => {
    expect(lastDayOf(TODAY, 30)).toBe("2026-11-11");
    expect(lastDayOf("2026-12-20", 30)).toBe("2027-01-19");
  });
});

describe("dayText", () => {
  it("names the weekday and the whole date, whatever time zone the server is in", () => {
    expect(dayText("2026-10-19")).toMatch(/^Monday,? 19 October 2026$/);
    expect(dayText("2026-12-31")).toMatch(/^Thursday,? 31 December 2026$/);
  });
});

describe("dueText", () => {
  it("says how far away or past a day is", () => {
    expect(dueText("2026-10-12", TODAY)).toBe("due today");
    expect(dueText("2026-10-13", TODAY)).toBe("due tomorrow");
    expect(dueText("2026-10-17", TODAY)).toBe("due in 5 days");
    expect(dueText("2026-10-11", TODAY)).toBe("overdue by 1 day");
    expect(dueText("2026-10-02", TODAY)).toBe("overdue by 10 days");
  });
});

describe("arrangeSchedule", () => {
  it("puts overdue first (most overdue first), then what is coming, soonest first", () => {
    const { overdue, upcoming } = arrangeSchedule(
      [
        dated("c", "2026-10-20"),
        dated("a", "2026-10-05"),
        dated("d", "2026-10-12"),
        dated("b", "2026-10-09"),
        dated("e", "2026-10-15"),
      ],
      TODAY,
      30,
      NOW,
    );

    expect(overdue.map((entry) => entry.key)).toEqual(["a", "b"]);
    expect(upcoming.map((entry) => entry.key)).toEqual(["d", "e", "c"]);
  });

  it("leaves out what falls after the chosen range, and keeps its last day", () => {
    const { upcoming } = arrangeSchedule(
      [dated("in", "2026-10-18"), dated("edge", "2026-10-19"), dated("out", "2026-10-20")],
      TODAY,
      7,
      NOW,
    );

    expect(upcoming.map((entry) => entry.key)).toEqual(["in", "edge"]);
  });

  it("lists what is waiting longest-waiting first, whatever the range", () => {
    const { waiting: list } = arrangeSchedule(
      [
        waiting("recent", "2026-10-10T00:00:00Z"),
        waiting("oldest", "2026-09-01T00:00:00Z"),
        waiting("mid", "2026-10-01T00:00:00Z"),
      ],
      TODAY,
      7,
      NOW,
    );

    expect(list.map((entry) => entry.key)).toEqual(["oldest", "mid", "recent"]);
  });

  it("breaks ties on the same day by title, so the order is stable", () => {
    const { upcoming } = arrangeSchedule(
      [dated("z", "2026-10-14", "Zebra"), dated("a", "2026-10-14", "Apple")],
      TODAY,
      30,
      NOW,
    );

    expect(upcoming.map((entry) => entry.title)).toEqual(["Apple", "Zebra"]);
  });
});
