import { describe, expect, it } from "vitest";
import { type BulkOutcome, MAX_BULK, readBulkForm, summarise } from "~/lib/bulk-actions";

const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
};

describe("readBulkForm", () => {
  it("reads a withdrawal: the kind, the chosen items without repeats, and one trimmed reason", () => {
    const read = readBulkForm(
      form([
        ["kind", "content"],
        ["intent", "withdraw"],
        ["id", "a"],
        ["id", "b"],
        ["id", "a"],
        ["reason", "  Out of date  "],
      ]),
    );
    expect(read).toEqual({
      ok: true,
      request: { kind: "content", action: "withdraw", ids: ["a", "b"], reason: "Out of date" },
    });
  });

  it("reads archiving for Learning Layers", () => {
    const read = readBulkForm(
      form([
        ["kind", "layer"],
        ["intent", "archive"],
        ["id", "x"],
        ["reason", "Retired"],
      ]),
    );
    expect(read).toEqual({ ok: true, request: { kind: "layer", action: "archive", ids: ["x"], reason: "Retired" } });
  });

  it("reads assigning a reviewer from a Review Type and a person in one choice", () => {
    const read = readBulkForm(
      form([
        ["kind", "content"],
        ["intent", "assign"],
        ["id", "a"],
        ["reviewer", "language:user-1"],
        ["reason", "ignored for assigning"],
      ]),
    );
    expect(read).toEqual({
      ok: true,
      request: { kind: "content", action: "assign", ids: ["a"], reviewType: "language", reviewerId: "user-1" },
    });
  });

  it.each([
    [
      "nothing chosen",
      [
        ["kind", "content"],
        ["intent", "withdraw"],
        ["reason", "Why"],
      ],
      "Choose at least one item",
    ],
    [
      "no reason to withdraw",
      [
        ["kind", "content"],
        ["intent", "withdraw"],
        ["id", "a"],
        ["reason", "  "],
      ],
      "Say why",
    ],
    [
      "no reason to archive",
      [
        ["kind", "layer"],
        ["intent", "archive"],
        ["id", "a"],
      ],
      "Say why",
    ],
    [
      "no reviewer",
      [
        ["kind", "content"],
        ["intent", "assign"],
        ["id", "a"],
      ],
      "Choose a reviewer",
    ],
    [
      "an unknown Review Type",
      [
        ["kind", "content"],
        ["intent", "assign"],
        ["id", "a"],
        ["reviewer", "luck:u"],
      ],
      "Choose a reviewer",
    ],
    [
      "publishing in bulk",
      [
        ["kind", "content"],
        ["intent", "publish"],
        ["id", "a"],
      ],
      "can't be done in bulk",
    ],
    [
      "an unknown kind",
      [
        ["kind", "media"],
        ["intent", "withdraw"],
        ["id", "a"],
        ["reason", "x"],
      ],
      "isn't available",
    ],
  ] as [string, [string, string][], string][])("refuses %s", (_name, entries, message) => {
    const read = readBulkForm(form(entries));
    expect(read.ok).toBe(false);
    expect(!read.ok && read.error).toContain(message);
  });

  it("refuses a reason that is too long, and more items than one step takes", () => {
    const long = readBulkForm(
      form([
        ["kind", "content"],
        ["intent", "archive"],
        ["id", "a"],
        ["reason", "x".repeat(501)],
      ]),
    );
    expect(!long.ok && long.error).toContain("500 characters");
    const many = readBulkForm(
      form([
        ["kind", "content"],
        ["intent", "archive"],
        ["reason", "Why"],
        ...Array.from({ length: MAX_BULK + 1 }, (_, n): [string, string] => ["id", `i${n}`]),
      ]),
    );
    expect(!many.ok && many.error).toContain(`${MAX_BULK}`);
  });
});

describe("summarise", () => {
  const done = (id: string): BulkOutcome => ({ id, title: id, ok: true, text: "Withdrawn." });
  const skipped = (id: string): BulkOutcome => ({ id, title: id, ok: false, text: "Not published." });

  it("counts what was done and what was skipped", () => {
    expect(summarise("withdraw", "content", [done("a"), done("b"), skipped("c")])).toBe(
      "Withdrew 2 of 3 Content Items. 1 was skipped.",
    );
  });

  it("speaks in the singular, and for everything done", () => {
    expect(summarise("archive", "layer", [done("a")])).toBe("Archived 1 of 1 Learning Layer.");
  });

  it("says plainly when nothing could be done", () => {
    expect(summarise("assign", "content", [skipped("a"), skipped("b")])).toBe(
      "The reviewer was not assigned to any of the 2 Content Items. 2 were skipped.",
    );
  });
});
