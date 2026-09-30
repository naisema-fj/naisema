import { describe, expect, it } from "vitest";
import { evidenceTypeOf, expiryWarningsDue, type RightsFacts, rightsProblems } from "~/lib/rights-rules";

const now = new Date("2026-10-01T00:00:00Z");
const days = (count: number) => new Date(now.getTime() + count * 86_400_000);

const record = (overrides: Partial<RightsFacts> = {}): RightsFacts => ({
  id: crypto.randomUUID(),
  permittedUses: ["publish"],
  guardianPermission: false,
  expiresAt: null,
  withdrawnAt: null,
  ...overrides,
});

describe("rightsProblems", () => {
  it("is satisfied by one current record granting Publish", () => {
    expect(rightsProblems({ records: [record()], needsGuardianPermission: false, now })).toEqual([]);
    expect(rightsProblems({ records: [record({ expiresAt: days(1) })], needsGuardianPermission: false, now })).toEqual(
      [],
    );
  });

  it("refuses when nothing grants Publish, since no Permitted Use implies another", () => {
    expect(
      rightsProblems({
        records: [record({ permittedUses: ["excerpt", "translate", "commercial"] })],
        needsGuardianPermission: false,
        now,
      }),
    ).toEqual(["No current Rights Record grants Publish."]);
    expect(rightsProblems({ records: [], needsGuardianPermission: false, now })).toEqual([
      "No current Rights Record grants Publish.",
    ]);
  });

  it("says when the only Publish grant has expired or been withdrawn", () => {
    expect(rightsProblems({ records: [record({ expiresAt: days(-1) })], needsGuardianPermission: false, now })).toEqual(
      ["Its Rights Record granting Publish expired on 30 Sept 2026."],
    );
    expect(
      rightsProblems({ records: [record({ withdrawnAt: days(-2) })], needsGuardianPermission: false, now }),
    ).toEqual(["Its Rights Record granting Publish was withdrawn."]);
  });

  it("treats a record that expires at this moment as expired", () => {
    expect(rightsProblems({ records: [record({ expiresAt: now })], needsGuardianPermission: false, now })).toHaveLength(
      1,
    );
  });

  it("needs current guardian permission, granting Publish, for identifiable children", () => {
    const rights = record();
    const guardian = record({ guardianPermission: true });

    expect(rightsProblems({ records: [rights], needsGuardianPermission: true, now })).toEqual([
      "Identifiable children need current, documented guardian permission granting Publish.",
    ]);
    expect(rightsProblems({ records: [rights, guardian], needsGuardianPermission: true, now })).toEqual([]);
    expect(
      rightsProblems({
        records: [rights, { ...guardian, withdrawnAt: days(-1) }],
        needsGuardianPermission: true,
        now,
      }),
    ).toHaveLength(1);
  });
});

describe("expiryWarningsDue", () => {
  it("warns once when a record enters the 30-day window and again at 7 days", () => {
    const expiring = record({ expiresAt: days(20) });
    const soon = record({ expiresAt: days(5) });
    const later = record({ expiresAt: days(45) });

    expect(expiryWarningsDue({ records: [expiring, soon, later], sent: [], now })).toEqual([
      { recordId: expiring.id, withinDays: 30 },
      { recordId: soon.id, withinDays: 7 },
    ]);
    expect(
      expiryWarningsDue({
        records: [expiring, soon],
        sent: [
          { recordId: expiring.id, withinDays: 30 },
          { recordId: soon.id, withinDays: 7 },
        ],
        now,
      }),
    ).toEqual([]);
  });

  it("skips withdrawn, expired and never-expiring records", () => {
    expect(
      expiryWarningsDue({
        records: [record({ expiresAt: days(3), withdrawnAt: days(-1) }), record({ expiresAt: days(-1) }), record()],
        sent: [],
        now,
      }),
    ).toEqual([]);
  });
});

describe("evidenceTypeOf", () => {
  const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);

  it("recognises the allowed evidence files by their first bytes, not their name", () => {
    expect(evidenceTypeOf(new TextEncoder().encode("%PDF-1.7 rest"))).toBe("application/pdf");
    expect(evidenceTypeOf(bytes(0xff, 0xd8, 0xff))).toBe("image/jpeg");
    expect(evidenceTypeOf(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(evidenceTypeOf(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });

  it("refuses anything else", () => {
    expect(evidenceTypeOf(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(evidenceTypeOf(bytes(0x4d, 0x5a))).toBeNull();
    expect(evidenceTypeOf(new Uint8Array())).toBeNull();
  });
});
