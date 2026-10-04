import { describe, expect, it } from "vitest";
import { signPlaybackToken, verifyStreamSignature } from "~/lib/stream-signing";
import {
  canMoveVideo,
  formatVideoLength,
  lengthProblem,
  MAX_VIDEO_SECONDS,
  orientationOf,
  readStreamVideo,
  safeReason,
} from "~/lib/video-rules";

describe("video processing states", () => {
  it("only ever moves forward, except a failure tried again", () => {
    expect(canMoveVideo("uploaded", "processing")).toBe(true);
    expect(canMoveVideo("uploaded", "ready")).toBe(true);
    expect(canMoveVideo("processing", "ready")).toBe(true);
    expect(canMoveVideo("processing", "failed")).toBe(true);
    expect(canMoveVideo("failed", "uploaded")).toBe(true);
    // Late or repeated deliveries change nothing.
    expect(canMoveVideo("ready", "processing")).toBe(false);
    expect(canMoveVideo("ready", "failed")).toBe(false);
    expect(canMoveVideo("failed", "processing")).toBe(false);
    expect(canMoveVideo("failed", "ready")).toBe(false);
    expect(canMoveVideo("processing", "processing")).toBe(false);
    expect(canMoveVideo("ready", "ready")).toBe(false);
  });
});

describe("video length and shape", () => {
  it("allows up to 15 minutes", () => {
    expect(lengthProblem(MAX_VIDEO_SECONDS * 1000)).toBeNull();
    expect(lengthProblem(MAX_VIDEO_SECONDS * 1000 + 20)).toBeNull();
    expect(lengthProblem(MAX_VIDEO_SECONDS * 1000 + 1000)).toBe(
      "This video is 15:01 long. The limit is 15 minutes: trim it, or upload the part you need, and try again.",
    );
  });

  it("writes lengths as minutes and seconds", () => {
    expect(formatVideoLength(61_400)).toBe("1:01");
    expect(formatVideoLength(5_000)).toBe("0:05");
    expect(formatVideoLength(3_725_000)).toBe("1:02:05");
  });

  it("names the orientation", () => {
    expect(orientationOf(1280, 720)).toBe("landscape");
    expect(orientationOf(720, 1280)).toBe("portrait");
    expect(orientationOf(1080, 1080)).toBe("square");
  });
});

describe("reasons shown to staff", () => {
  it("drops addresses, tokens and keys, and keeps it short", () => {
    const reason = safeReason(
      "Copy failed for https://abc.r2.cloudflarestorage.com/b/k?X-Amz-Signature=deadbeef with Bearer abc.def-ghi and X-Amz-Credential=AKIA/x",
    );
    expect(reason).not.toMatch(/r2\.cloudflarestorage|deadbeef|abc\.def|AKIA/);
    expect(reason).toContain("Copy failed");
    expect(safeReason("x".repeat(1000)).length).toBeLessThanOrEqual(300);
  });
});

describe("Stream's video objects (webhook bodies and status answers)", () => {
  it("reads a ready video", () => {
    expect(
      readStreamVideo({ uid: "abc", readyToStream: true, status: { state: "ready" }, duration: 61.4, meta: {} }),
    ).toEqual({ providerId: "abc", update: { state: "ready", reason: null, durationMs: 61_400 } });
  });

  it("reads a failure with Stream's reason", () => {
    expect(
      readStreamVideo({
        uid: "abc",
        readyToStream: false,
        status: { state: "error", errorReasonCode: "ERR_NON_VIDEO", errorReasonText: "The file isn't a video." },
        duration: -1,
      }),
    ).toEqual({
      providerId: "abc",
      update: { state: "failed", reason: "Stream couldn't process it: The file isn't a video.", durationMs: null },
    });
  });

  it("reads a failure reason under either of the names Stream uses", () => {
    expect(
      readStreamVideo({
        uid: "abc",
        status: {
          state: "error",
          errReasonCode: "ERR_MALFORMED_VIDEO",
          errReasonText: "The video was deemed corrupted.",
        },
      })?.update.reason,
    ).toBe("Stream couldn't process it: The video was deemed corrupted.");
  });

  it("reads anything else as still processing", () => {
    expect(readStreamVideo({ uid: "abc", status: { state: "inprogress", pctComplete: "40" } })?.update.state).toBe(
      "processing",
    );
    expect(readStreamVideo({ uid: "abc", status: { state: "downloading" } })?.update.state).toBe("processing");
  });

  it("ignores something that isn't a video object", () => {
    expect(readStreamVideo(null)).toBeNull();
    expect(readStreamVideo({ status: { state: "ready" } })).toBeNull();
    expect(readStreamVideo({ uid: 7 })).toBeNull();
  });
});

const encoder = new TextEncoder();

async function sign(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("Stream webhook signatures", () => {
  const body = JSON.stringify({ uid: "abc", readyToStream: true });

  it("accepts a delivery signed with the webhook secret over its time and body", async () => {
    const header = `time=1230811200,sig1=${await sign("secret", `1230811200.${body}`)}`;
    expect(await verifyStreamSignature("secret", header, body)).toBe(true);
  });

  it("refuses a changed body, another secret, or a malformed header", async () => {
    const header = `time=1230811200,sig1=${await sign("secret", `1230811200.${body}`)}`;
    expect(await verifyStreamSignature("secret", header, `${body} `)).toBe(false);
    expect(await verifyStreamSignature("other", header, body)).toBe(false);
    expect(await verifyStreamSignature("secret", header.replace("time=1230811200", "time=1230811201"), body)).toBe(
      false,
    );
    expect(await verifyStreamSignature("secret", null, body)).toBe(false);
    expect(await verifyStreamSignature("secret", "sig1=abc", body)).toBe(false);
    expect(await verifyStreamSignature("", header, body)).toBe(false);
  });
});

const base64url = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

describe("signed playback tokens", () => {
  it("signs a token for one video with the signing key, expiring when asked", async () => {
    const pair = (await crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    const jwk = btoa(JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey)));
    const now = new Date("2026-10-04T08:00:00Z");

    const token = await signPlaybackToken({ keyId: "key-1", jwk, videoId: "abc", now, seconds: 600 });

    const [header, payload, signature] = token.split(".");
    expect(JSON.parse(new TextDecoder().decode(base64url(header)))).toEqual({ alg: "RS256", kid: "key-1" });
    expect(JSON.parse(new TextDecoder().decode(base64url(payload)))).toEqual({
      sub: "abc",
      kid: "key-1",
      exp: now.getTime() / 1000 + 600,
    });
    expect(
      await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        pair.publicKey,
        base64url(signature),
        encoder.encode(`${header}.${payload}`),
      ),
    ).toBe(true);
  });
});
