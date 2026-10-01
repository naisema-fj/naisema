import { describe, expect, it } from "vitest";
import { assetRightsProblems, expiryWarningsDue, type RightsFacts, rightsProblems } from "~/lib/rights-rules";

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

describe("rightsProblems with records for parts of an item", () => {
  const music = { kind: "music", name: "Isa Lei (1962 recording)" } as const;
  const guest = { kind: "speaker", name: "Ratu Joni" } as const;
  const clip = { kind: "archive", name: "1970 radio clip" } as const;
  const parts = [music, guest, clip];

  it("still needs a record for the whole item; a part's record doesn't stand in for it", () => {
    expect(rightsProblems({ records: [record({ part: music })], needsGuardianPermission: false, parts, now })).toEqual([
      "No current Rights Record grants Publish.",
    ]);
  });

  it("needs each listed part that has records to have a current one granting Publish", () => {
    const problems = rightsProblems({
      records: [
        record(),
        record({ part: music, expiresAt: days(-2) }),
        record({ part: guest, withdrawnAt: days(-1) }),
        record({ part: clip, permittedUses: ["excerpt"] }),
      ],
      needsGuardianPermission: false,
      parts,
      now,
    });

    expect(problems).toEqual([
      "The Rights Record for music: Isa Lei (1962 recording) expired on 29 Sept 2026.",
      "The Rights Record for speaker or guest: Ratu Joni was withdrawn.",
      "No current Rights Record for archive clip: 1970 radio clip grants Publish.",
    ]);
  });

  it("sets aside records for parts the Revision no longer lists, so a cut clip lifts its rights", () => {
    expect(
      rightsProblems({
        records: [record(), record({ part: music, withdrawnAt: days(-1) })],
        needsGuardianPermission: false,
        parts: [guest],
        now,
      }),
    ).toEqual([]);
  });

  it("is satisfied once a part's withdrawn record is replaced, matching its name loosely", () => {
    expect(
      rightsProblems({
        records: [
          record(),
          record({ part: guest, withdrawnAt: days(-1) }),
          record({ part: { kind: "speaker", name: " ratu joni " } }),
        ],
        needsGuardianPermission: false,
        parts,
        now,
      }),
    ).toEqual([]);
  });

  it("takes guardian permission from the item's record or a listed speaker's, never from music", () => {
    const check = (guardianOn: RightsFacts) =>
      rightsProblems({ records: [record(), guardianOn], needsGuardianPermission: true, parts, now });

    expect(check(record({ part: guest, guardianPermission: true }))).toEqual([]);
    expect(check(record({ part: music, guardianPermission: true }))).toHaveLength(1);
  });
});

describe("assetRightsProblems: the media library files an item uses", () => {
  it("needs each file to have its own current Record granting Publish, and names the file", () => {
    expect(
      assetRightsProblems(
        [
          { name: "harbour.jpg", records: [record()] },
          { name: "talanoa.mp3", records: [] },
          { name: "map.pdf", records: [record({ expiresAt: days(-2) })] },
          { name: "dance.jpg", records: [record({ withdrawnAt: days(-1) })] },
        ],
        now,
      ),
    ).toEqual([
      "The file talanoa.mp3 has no current Rights Record granting Publish.",
      "The Rights Record for the file map.pdf expired on 29 Sept 2026.",
      "The Rights Record for the file dance.jpg was withdrawn.",
    ]);
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
