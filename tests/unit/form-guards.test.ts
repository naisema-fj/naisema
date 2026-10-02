import { describe, expect, it, vi } from "vitest";
import { hashToken, randomToken, signToken, verifyToken } from "~/lib/signed-tokens.server";
import { TURNSTILE_TEST_KEYS } from "~/lib/turnstile";
import { verifyTurnstile } from "~/lib/turnstile.server";

describe("verifyTurnstile", () => {
  const unreachable = vi.fn(() => Promise.reject(new Error("no network")));

  it("answers Cloudflare's test secrets without a network call", async () => {
    const { token, passingSecret, failingSecret, spentSecret } = TURNSTILE_TEST_KEYS;

    expect(await verifyTurnstile(passingSecret, token, null, unreachable)).toBe(true);
    expect(await verifyTurnstile(failingSecret, token, null, unreachable)).toBe(false);
    expect(await verifyTurnstile(spentSecret, token, null, unreachable)).toBe(false);
    expect(unreachable).not.toHaveBeenCalled();
  });

  it("refuses a form with no token, whatever the secret", async () => {
    expect(await verifyTurnstile(TURNSTILE_TEST_KEYS.passingSecret, "", null, unreachable)).toBe(false);
  });

  it("asks Siteverify with the secret, token and visitor's address, and believes only success", async () => {
    const calls: FormData[] = [];
    const answer = (result: unknown) =>
      vi.fn(async (_url: string, init?: RequestInit) => {
        calls.push(init?.body as FormData);
        return Response.json(result);
      });

    expect(await verifyTurnstile("real-secret", "token-1", "203.0.113.9", answer({ success: true }))).toBe(true);
    expect(await verifyTurnstile("real-secret", "token-2", null, answer({ success: false }))).toBe(false);
    expect(Object.fromEntries(calls[0])).toEqual({
      secret: "real-secret",
      response: "token-1",
      remoteip: "203.0.113.9",
    });
  });

  it("fails closed when Siteverify can't be reached or answers badly", async () => {
    expect(await verifyTurnstile("real-secret", "token", null, unreachable)).toBe(false);
    expect(await verifyTurnstile("real-secret", "token", null, async () => new Response("down", { status: 500 }))).toBe(
      false,
    );
  });
});

describe("signed tokens", () => {
  it("give back what they sign, only for the same use and secret", async () => {
    const token = await signToken("secret", "consent-withdrawal", "record-1");

    expect(token.startsWith("record-1.")).toBe(true);
    expect(await verifyToken("secret", "consent-withdrawal", token)).toBe("record-1");
    expect(await verifyToken("secret", "something-else", token)).toBeNull();
    expect(await verifyToken("other-secret", "consent-withdrawal", token)).toBeNull();
  });

  it("can't be altered to point at another record", async () => {
    const token = await signToken("secret", "consent-withdrawal", "record-1");

    expect(await verifyToken("secret", "consent-withdrawal", token.replace("record-1", "record-2"))).toBeNull();
    expect(await verifyToken("secret", "consent-withdrawal", "record-1")).toBeNull();
    expect(await verifyToken("secret", "consent-withdrawal", `${token}x`)).toBeNull();
  });

  it("random tokens are URL-safe, different each time, and stored as a hash", async () => {
    const one = randomToken();

    expect(one).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(one);
    expect(await hashToken(one)).toBe(await hashToken(one));
    expect(await hashToken(one)).not.toContain(one);
  });
});
