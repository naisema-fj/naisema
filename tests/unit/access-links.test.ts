import { describe, expect, it } from "vitest";
import { issueToken, linkExpiry, linkState, tokenHashOf } from "~/lib/access-links";

describe("access links: Review Links and upload links", () => {
  it("issue URL-safe tokens, different each time, stored only as a hash", async () => {
    const one = await issueToken();

    expect(one.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await issueToken()).token).not.toBe(one.token);
    expect(await tokenHashOf(one.token)).toBe(one.tokenHash);
    expect(one.tokenHash).not.toContain(one.token);
  });

  it("never look up a token no link could have", async () => {
    expect(await tokenHashOf("not-a-real-token")).toBeNull();
    expect(await tokenHashOf(`${(await issueToken()).token}x`)).toBeNull();
  });

  it("work until closed or until they expire, and not at the moment they expire", () => {
    const now = new Date("2026-10-04T00:00:00Z");
    const expiresAt = linkExpiry(now, 14);
    expect(expiresAt).toEqual(new Date("2026-10-18T00:00:00Z"));
    expect(linkState({ expiresAt, closedAt: null }, now)).toBe("active");
    expect(linkState({ expiresAt, closedAt: null }, expiresAt)).toBe("expired");
    expect(linkState({ expiresAt, closedAt: now }, now)).toBe("closed");
  });
});
