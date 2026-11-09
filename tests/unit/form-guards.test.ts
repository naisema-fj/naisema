import { describe, expect, it, vi } from "vitest";
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
