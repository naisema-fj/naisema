import { describe, expect, it } from "vitest";
import {
  appealOpen,
  canMove,
  outcomesFor,
  readAppeal,
  readAppealDecision,
  readDataRequest,
  readDecision,
  readReport,
  readTriage,
} from "~/lib/case-rules";

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const each of [value].flat()) data.append(name, each);
  }
  return data;
};

const DAY = 86_400_000;
const now = new Date("2026-10-02T00:00:00Z");

describe("readReport", () => {
  it("reads an anonymous report about an item, as a report Case", () => {
    expect(readReport(form({ reason: "harm", details: " It names a child. ", item: "item-1" }))).toEqual({
      ok: true,
      report: {
        kind: "report",
        reason: "harm",
        details: "It names a child.",
        contentItemId: "item-1",
        name: "",
        email: null,
        consents: [],
      },
    });
  });

  it("makes a rights issue a rights concern", () => {
    expect(readReport(form({ reason: "rights", details: "That's my recording." }))).toMatchObject({
      ok: true,
      report: { kind: "rights_concern", contentItemId: null },
    });
  });

  it("needs the reply consent only when the reporter leaves an email address", () => {
    expect(readReport(form({ reason: "inaccuracy", details: "Wrong date.", email: "sera@example.com" }))).toMatchObject(
      {
        ok: false,
        errors: { "consent-reply": expect.any(String) },
      },
    );
    expect(
      readReport(
        form({
          reason: "inaccuracy",
          details: "Wrong date.",
          email: "Sera@Example.com",
          consent: "reply",
          "notice-reply": "notice-reply-1",
        }),
      ),
    ).toMatchObject({
      ok: true,
      report: { email: "sera@example.com", consents: [{ purpose: "reply", noticeId: "notice-reply-1" }] },
    });
  });

  it("needs a reason and what's wrong, keeping what was typed", () => {
    expect(readReport(form({ reason: "boring", details: "", email: "not an email" }))).toEqual({
      ok: false,
      errors: {
        reason: expect.any(String),
        details: expect.any(String),
        email: expect.any(String),
        "consent-reply": expect.any(String),
      },
      values: { reason: "boring", details: "", email: "not an email", name: "", item: "", consent: [] },
    });
  });
});

describe("readDataRequest", () => {
  it("needs who is asking, how to reach them, what they want and their agreement", () => {
    expect(
      readDataRequest(
        form({
          name: "Sera",
          email: "sera@example.com",
          request: "deletion",
          details: "",
          consent: "reply",
          "notice-reply": "notice-reply-1",
        }),
      ),
    ).toEqual({
      ok: true,
      request: {
        kind: "data_request",
        reason: "deletion",
        details: "",
        name: "Sera",
        email: "sera@example.com",
        consents: [{ purpose: "reply", noticeId: "notice-reply-1" }],
      },
    });
    expect(readDataRequest(form({ request: "other" }))).toMatchObject({
      ok: false,
      errors: {
        name: expect.any(String),
        email: expect.any(String),
        details: expect.stringContaining("Tell us"),
        "consent-reply": expect.any(String),
      },
    });
  });
});

describe("Case states", () => {
  it("move received → triaged → actioned → closed, with an appeal after a decision", () => {
    expect(canMove("received", "triaged")).toBe(true);
    expect(canMove("triaged", "actioned")).toBe(true);
    expect(canMove("actioned", "closed")).toBe(true);
    expect(canMove("actioned", "appealed")).toBe(true);
    expect(canMove("closed", "appealed")).toBe(true);
    expect(canMove("appealed", "closed")).toBe(true);
  });

  it("can't skip triage or a decision, or go back", () => {
    expect(canMove("received", "actioned")).toBe(false);
    expect(canMove("triaged", "closed")).toBe(false);
    expect(canMove("closed", "triaged")).toBe(false);
    expect(canMove("appealed", "actioned")).toBe(false);
  });

  it("take one appeal, within 30 days of the decision", () => {
    const decided = { state: "actioned" as const, decidedAt: new Date(now.getTime() - 5 * DAY), appealedAt: null };

    expect(appealOpen(decided, now)).toBe(true);
    expect(appealOpen({ ...decided, state: "closed" }, now)).toBe(true);
    expect(appealOpen({ ...decided, decidedAt: new Date(now.getTime() - 31 * DAY) }, now)).toBe(false);
    expect(appealOpen({ ...decided, appealedAt: now }, now)).toBe(false);
    expect(appealOpen({ state: "triaged", decidedAt: null, appealedAt: null }, now)).toBe(false);
  });
});

describe("staff forms", () => {
  it("triage needs a severity and an owner who can handle the Case", () => {
    expect(readTriage(form({ severity: "high", ownerId: "lead-1" }), ["lead-1"])).toEqual({
      ok: true,
      triage: { severity: "high", ownerId: "lead-1" },
    });
    expect(readTriage(form({ severity: "huge", ownerId: "editor-1" }), ["lead-1"])).toEqual({
      ok: false,
      errors: { severity: expect.any(String), ownerId: expect.any(String) },
    });
  });

  it("a decision needs an outcome for this kind of Case, what was done and why", () => {
    expect(outcomesFor("report")).toHaveProperty("content_removed");
    expect(outcomesFor("data_request")).toHaveProperty("data_deleted");
    expect(
      readDecision(form({ outcome: "content_changed", action: "Removed the name.", rationale: "SAFE-02." }), "report"),
    ).toEqual({
      ok: true,
      decision: { outcome: "content_changed", action: "Removed the name.", rationale: "SAFE-02." },
    });
    expect(readDecision(form({ outcome: "data_deleted", action: "", rationale: "" }), "report")).toEqual({
      ok: false,
      errors: { outcome: expect.any(String), action: expect.any(String), rationale: expect.any(String) },
    });
  });

  it("an appeal needs the person's reasons; its decision an outcome and why", () => {
    expect(readAppeal(form({ reasons: " I didn't consent. " }))).toEqual({ ok: true, reasons: "I didn't consent." });
    expect(readAppeal(form({ reasons: "" }))).toMatchObject({ ok: false });
    expect(readAppealDecision(form({ outcome: "overturned", rationale: "New evidence." }))).toEqual({
      ok: true,
      decision: { outcome: "overturned", rationale: "New evidence." },
    });
    expect(readAppealDecision(form({ outcome: "maybe" }))).toMatchObject({
      ok: false,
      errors: { outcome: expect.any(String), rationale: expect.any(String) },
    });
  });
});
