import { describe, expect, it } from "vitest";
import { budgetAlertDue, estimateMonth, monthOf } from "~/lib/usage-rules";

describe("estimateMonth", () => {
  it("projects the month's cost from usage so far, in AUD against the ceiling", () => {
    // 10 days into a 30-day month: 2,000 minutes stored, 1,500 delivered so far, 25 GB in R2.
    const estimate = estimateMonth(
      { storedMinutes: 2_000, deliveredMinutes: 1_500, r2Bytes: 25e9 },
      new Date("2026-09-11T00:00:00Z"),
    );
    expect(estimate.deliveredMinutesProjected).toBe(4_500);
    expect(estimate.usd).toEqual({
      workers: 5,
      streamStored: 10,
      streamDelivered: 4.5,
      r2: 0.225,
      total: 19.725,
    });
    expect(estimate.aud).toBeCloseTo(30.57, 2);
    expect(estimate.percentOfCeiling).toBe(31);
  });

  it("doesn't take the first day's delivery as the whole month's rate", () => {
    // 600 minutes on the first day of a 30-day month: projected as if over three days.
    const estimate = estimateMonth(
      { storedMinutes: 0, deliveredMinutes: 600, r2Bytes: 0 },
      new Date("2026-09-02T00:00:00Z"),
    );
    expect(estimate.deliveredMinutesProjected).toBe(6_000);
  });

  it("charges nothing for R2 within the free 10 GB", () => {
    const estimate = estimateMonth(
      { storedMinutes: 0, deliveredMinutes: 0, r2Bytes: 4e9 },
      new Date("2026-10-31T23:00:00Z"),
    );
    expect(estimate.usd.r2).toBe(0);
    expect(estimate.usd.total).toBe(5);
  });
});

describe("budgetAlertDue", () => {
  it("is due once as the projection crosses 50%, and again at 80%", () => {
    expect(budgetAlertDue(49, 0)).toBeNull();
    expect(budgetAlertDue(50, 0)).toBe(50);
    expect(budgetAlertDue(65, 50)).toBeNull();
    expect(budgetAlertDue(85, 50)).toBe(80);
    expect(budgetAlertDue(120, 80)).toBeNull();
  });

  it("goes straight to 80% when the first reading is already past it", () => {
    expect(budgetAlertDue(90, 0)).toBe(80);
  });
});

describe("monthOf", () => {
  it("names the calendar month in UTC", () => {
    expect(monthOf(new Date("2026-10-31T23:59:59Z"))).toBe("2026-10");
    expect(monthOf(new Date("2026-11-01T00:00:00Z"))).toBe("2026-11");
  });
});
