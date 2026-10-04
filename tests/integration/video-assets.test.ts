import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { handleScanBatch, MAX_SCAN_ATTEMPTS, type Scanner, scanUpload } from "~/lib/scan.server";
import { applySecurityHeaders } from "~/lib/security-policy";
import { checkVideo, refreshStalledVideos, retryVideo } from "~/lib/video-assets.server";
import { localPlaybackAllowed, localProvider, streamProvider } from "~/lib/video-provider.server";
import { mp4, mp4WithoutMoov } from "../fixtures/mp4";
import { staff } from "./support/articles";
import { completeUpload, sendPart, startUpload } from "./support/media";

const PUBLIC = "https://naisema.test";
const WEBHOOK_SECRET = "test-stream-webhook-secret";

/** Stands in for ClamAV: reads the whole file, as the real scanner does, and passes it. */
const cleanScanner: Scanner = async ({ body }) => {
  await new Response(body).arrayBuffer();
  return { verdict: "clean" };
};

/** A video master uploaded to the media library and waiting for its scan. */
async function uploadedVideo(bytes: Uint8Array, name = "clip.mp4") {
  const educator = await staff("educator", { role: "educator" });
  const response = await startUpload(educator.browser, { name, type: "video/mp4", size: bytes.length, head: bytes });
  expect(response.status).toBe(201);
  const { id } = (await response.json()) as { id: string };
  expect((await sendPart(educator.browser, id, 1, bytes)).status).toBe(200);
  expect((await completeUpload(educator.browser, id)).status).toBe(200);
  return { id, educator };
}

type VideoRow = {
  state: string;
  reason: string | null;
  provider: string;
  providerId: string | null;
  durationMs: number;
  width: number;
  height: number;
  orientation: string;
  environment: string;
  masterKey: string;
  ownerId: string;
};

const video = (id: string) =>
  env.DB.prepare(
    `SELECT state, state_reason AS reason, provider, provider_id AS providerId, duration_ms AS durationMs, width,
       height, orientation, environment, master_key AS masterKey, owner_id AS ownerId
     FROM video_asset WHERE id = ?1`,
  )
    .bind(id)
    .first<VideoRow>();

const media = (id: string) =>
  env.DB.prepare(
    "SELECT status, status_reason AS reason, destination_key AS destinationKey FROM media_asset WHERE id = ?1",
  )
    .bind(id)
    .first<{ status: string; reason: string | null; destinationKey: string }>();

const audits = async (id: string, action: string) =>
  (
    await env.DB.prepare("SELECT COUNT(*) AS count FROM audit_event WHERE object_id = ?1 AND action = ?2")
      .bind(id, action)
      .first<{ count: number }>()
  )?.count;

/** A stand-in for Stream's API that records every call and answers as Stream does. */
function fakeStream(answer: (method: string, path: string) => Response | undefined = () => undefined) {
  const calls: { method: string; url: string; headers: Headers; body: Record<string, unknown> | null }[] = [];
  let count = 0;
  const send = async (input: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({
      method,
      url: input,
      headers: new Headers(init.headers),
      body: init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
    });
    const path = new URL(input).pathname.replace(/^\/client\/v4\/accounts\/[^/]+\/stream/, "");
    const custom = answer(method, path);
    if (custom) return custom;
    if (method === "POST" && path === "/copy") {
      count += 1;
      return Response.json({
        success: true,
        result: {
          uid: `stream-uid-${count}-${crypto.randomUUID()}`,
          readyToStream: false,
          status: { state: "downloading" },
        },
      });
    }
    if (method === "DELETE") return Response.json({ success: true });
    return Response.json({ success: false, errors: [{ message: "Not found" }] }, { status: 404 });
  };
  return { send, calls };
}

let signingKey: { jwk: string; publicKey: CryptoKey } | undefined;
async function streamKey() {
  if (!signingKey) {
    const pair = (await crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    signingKey = {
      jwk: btoa(JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey))),
      publicKey: pair.publicKey,
    };
  }
  return signingKey;
}

/** This environment as it is once Stream's secrets are set. */
async function streamEnv() {
  return {
    ...env,
    VIDEO_PROVIDER: "stream",
    STREAM_API_TOKEN: "stream-api-token",
    STREAM_CUSTOMER_CODE: "abc123",
    STREAM_SIGNING_KEY_ID: "signing-key-1",
    STREAM_SIGNING_KEY_JWK: (await streamKey()).jwk,
    R2_MASTERS_ACCESS_KEY_ID: "r2-access-key",
    R2_MASTERS_SECRET_ACCESS_KEY: "r2-secret-key",
  } as unknown as Env;
}

/** A video master scanned and sent to the fake Stream, now processing there. */
async function processingInStream(stream = fakeStream()) {
  const { id, educator } = await uploadedVideo(mp4({ seconds: 61, width: 720, height: 1280 }));
  const configured = await streamEnv();
  expect(await scanUpload(configured, getDb(env.DB), id, cleanScanner, streamProvider(configured, stream.send))).toBe(
    "clean",
  );
  const row = await video(id);
  expect(row?.state).toBe("processing");
  return { id, educator, providerId: row?.providerId as string, configured, stream };
}

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Sends a webhook delivery as Stream does: the video object, signed over its time and body. */
async function webhook(payload: unknown, secret = WEBHOOK_SECRET) {
  const body = JSON.stringify(payload);
  const time = Math.floor(Date.now() / 1000);
  return SELF.fetch(`${PUBLIC}/webhooks/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Webhook-Signature": `time=${time},sig1=${await hmacHex(secret, `${time}.${body}`)}`,
    },
    body,
  });
}

/** A one-message scan batch, recording what the consumer did with it. */
function delivery(assetId: string, attempts = 1) {
  const outcome = { acked: false, retried: false };
  const message = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    body: { assetId },
    attempts,
    ack: () => {
      outcome.acked = true;
    },
    retry: () => {
      outcome.retried = true;
    },
  };
  const batch = { queue: "upload-scans", messages: [message], ackAll: () => {}, retryAll: () => {} };
  return { batch: batch as unknown as MessageBatch<{ assetId: string }>, outcome };
}

describe("a video master after its scan", () => {
  it("is kept in the private masters bucket and recorded as a Video Asset with its own length and picture size", async () => {
    const { id, educator } = await uploadedVideo(mp4({ seconds: 95.5, width: 1280, height: 720 }));

    expect(await scanUpload(env, getDb(env.DB), id, cleanScanner, localProvider(env))).toBe("clean");

    const asset = await media(id);
    expect(asset).toMatchObject({ status: "ready", destinationKey: `masters/${id}` });
    expect(await env.VIDEO_MASTERS.head(`masters/${id}`)).not.toBeNull();
    expect(await env.MEDIA.head(`masters/${id}`)).toBeNull();
    expect(await env.QUARANTINE.head(`uploads/${id}`)).toBeNull();
    expect(await video(id)).toMatchObject({
      // The local stand-in "processes" it at once.
      state: "ready",
      provider: "local",
      providerId: `local-${id}`,
      durationMs: 95_500,
      width: 1280,
      height: 720,
      orientation: "landscape",
      environment: "development",
      masterKey: `masters/${id}`,
      ownerId: educator.userId,
    });
    expect(await audits(id, "video_asset.created")).toBe(1);
    expect(await audits(id, "video_asset.processing")).toBe(1);
    expect(await audits(id, "video_asset.ready")).toBe(1);
  });

  it("refuses a master over 15 minutes before it is scanned, leaving it in quarantine with the reason", async () => {
    const { id } = await uploadedVideo(mp4({ seconds: 15 * 60 + 2 }));
    let scanned = false;
    const scanner: Scanner = async (file) => {
      scanned = true;
      return cleanScanner(file);
    };

    expect(await scanUpload(env, getDb(env.DB), id, scanner, localProvider(env))).toBe("failed");

    expect(scanned).toBe(false);
    expect(await media(id)).toMatchObject({
      status: "failed",
      reason: "This video is 15:02 long. The limit is 15 minutes: trim it, or upload the part you need, and try again.",
    });
    expect(await video(id)).toBeNull();
    expect(await env.VIDEO_MASTERS.head(`masters/${id}`)).toBeNull();
  });

  it("refuses a master whose length can't be read", async () => {
    const { id } = await uploadedVideo(mp4WithoutMoov());

    expect(await scanUpload(env, getDb(env.DB), id, cleanScanner, localProvider(env))).toBe("failed");

    expect((await media(id))?.reason).toContain("length couldn't be read");
    expect(await video(id)).toBeNull();
  });

  it("asks Stream to copy it from a short-lived pre-signed R2 address, requiring signed playback", async () => {
    const { id, providerId, stream } = await processingInStream();

    expect(stream.calls).toHaveLength(1);
    const [copy] = stream.calls;
    expect(copy.method).toBe("POST");
    expect(copy.url).toBe(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/copy`);
    expect(copy.headers.get("Authorization")).toBe("Bearer stream-api-token");
    expect(copy.body).toMatchObject({
      requireSignedURLs: true,
      meta: { name: "clip.mp4", naisemaAssetId: id, environment: "development" },
    });
    const source = new URL(String(copy.body?.url));
    expect(source.origin).toBe(`https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`);
    expect(source.pathname).toBe(`/${env.VIDEO_MASTERS_BUCKET}/masters/${id}`);
    expect(source.searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(source.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    // Captions are never asked for: they come from our own reviewed Segments.
    expect(stream.calls.some((call) => call.url.includes("/captions"))).toBe(false);
    expect(await video(id)).toMatchObject({
      provider: "stream",
      providerId,
      durationMs: 61_000,
      orientation: "portrait",
    });
  });

  it("fails with Stream's reason, and no address or credential, when Stream refuses it", async () => {
    const { id } = await uploadedVideo(mp4({ seconds: 30 }));
    const configured = await streamEnv();
    const stream = fakeStream((method, path) =>
      method === "POST" && path === "/copy"
        ? Response.json(
            {
              success: false,
              errors: [{ message: "Could not fetch https://r2.example/masters/x?X-Amz-Signature=abc" }],
            },
            { status: 400 },
          )
        : undefined,
    );

    await scanUpload(configured, getDb(env.DB), id, cleanScanner, streamProvider(configured, stream.send));

    const row = await video(id);
    expect(row?.state).toBe("failed");
    expect(row?.reason).toContain("Stream refused the video (400)");
    expect(row?.reason).not.toMatch(/X-Amz|r2\.example|stream-api-token|r2-secret/);
    expect(await audits(id, "video_asset.failed")).toBe(1);
  });

  it("says plainly when Stream isn't set up in this environment", async () => {
    const { id } = await uploadedVideo(mp4({ seconds: 30 }));
    const unconfigured = { ...env, VIDEO_PROVIDER: "stream" } as unknown as Env;

    await scanUpload(unconfigured, getDb(env.DB), id, cleanScanner, streamProvider(unconfigured, fakeStream().send));

    expect((await video(id))?.reason).toContain("isn't set up in this environment");
  });

  it("tries again while Stream can't be reached, then shows staff why it stopped", async () => {
    const { id } = await uploadedVideo(mp4({ seconds: 30 }));
    const configured = await streamEnv();
    const unreachable = streamProvider(configured, async () => {
      throw new TypeError("Network connection lost.");
    });

    const first = delivery(id, 1);
    await handleScanBatch(first.batch, configured, cleanScanner, unreachable);
    expect(first.outcome).toEqual({ acked: false, retried: true });
    expect(await media(id)).toMatchObject({ status: "ready" });
    expect((await video(id))?.state).toBe("uploaded");

    const last = delivery(id, MAX_SCAN_ATTEMPTS);
    await handleScanBatch(last.batch, configured, cleanScanner, unreachable);
    expect(last.outcome.acked).toBe(true);
    expect(await video(id)).toMatchObject({ state: "failed", reason: "Stream couldn't be reached." });
  });

  it("sends a master only once when its scan is delivered again", async () => {
    const { id, configured, stream } = await processingInStream();

    await scanUpload(configured, getDb(env.DB), id, cleanScanner, streamProvider(configured, stream.send));

    expect(stream.calls.filter((call) => call.url.endsWith("/copy"))).toHaveLength(1);
  });
});

describe("Stream's webhook", () => {
  it("marks a video ready from a signed delivery, once, however often it arrives", async () => {
    const { id, providerId } = await processingInStream();
    const ready = { uid: providerId, readyToStream: true, status: { state: "ready" }, duration: 61 };

    expect((await webhook(ready)).status).toBe(204);
    expect((await webhook(ready)).status).toBe(204);

    expect((await video(id))?.state).toBe("ready");
    expect(await audits(id, "video_asset.ready")).toBe(1);
  });

  it("ignores late or contradictory deliveries for a video already settled", async () => {
    const { id, providerId } = await processingInStream();
    await webhook({ uid: providerId, readyToStream: true, status: { state: "ready" } });

    await webhook({ uid: providerId, readyToStream: false, status: { state: "inprogress" } });
    await webhook({ uid: providerId, status: { state: "error", errorReasonText: "Late failure" } });

    expect(await video(id)).toMatchObject({ state: "ready", reason: null });
  });

  it("records a processing failure with Stream's reason", async () => {
    const { id, providerId } = await processingInStream();

    await webhook({
      uid: providerId,
      readyToStream: false,
      status: {
        state: "error",
        errorReasonCode: "ERR_NON_VIDEO",
        errorReasonText: "The file was not recognized as a video.",
      },
    });

    expect(await video(id)).toMatchObject({
      state: "failed",
      reason: "Stream couldn't process it: The file was not recognized as a video.",
    });
  });

  it("refuses an unsigned or wrongly signed delivery", async () => {
    const { id, providerId } = await processingInStream();
    const ready = { uid: providerId, readyToStream: true, status: { state: "ready" } };

    expect((await webhook(ready, "another-secret")).status).toBe(401);
    const unsigned = await SELF.fetch(`${PUBLIC}/webhooks/stream`, { method: "POST", body: JSON.stringify(ready) });
    expect(unsigned.status).toBe(401);

    expect((await video(id))?.state).toBe("processing");
  });

  it("acknowledges and ignores a video this environment doesn't know", async () => {
    expect((await webhook({ uid: "another-environments-video", readyToStream: true })).status).toBe(204);
    expect((await webhook({ notAVideo: true })).status).toBe(204);
  });

  it("is only ever posted to", async () => {
    expect((await SELF.fetch(`${PUBLIC}/webhooks/stream`)).status).toBe(405);
  });
});

describe("checking on, and retrying, a video", () => {
  it("asks Stream where a processing video has got to", async () => {
    const { id, providerId, configured } = await processingInStream();
    const stream = fakeStream((method, path) =>
      method === "GET" && path === `/${providerId}`
        ? Response.json({ success: true, result: { uid: providerId, readyToStream: true, status: { state: "ready" } } })
        : undefined,
    );

    expect(await checkVideo(getDb(env.DB), id, streamProvider(configured, stream.send))).toBe("moved");

    expect((await video(id))?.state).toBe("ready");
  });

  it("fails a video Stream no longer has", async () => {
    const { id, configured } = await processingInStream();

    await checkVideo(getDb(env.DB), id, streamProvider(configured, fakeStream().send));

    expect((await video(id))?.reason).toContain("no longer has this video");
  });

  it("sends a failed video again, dropping Stream's earlier copy", async () => {
    const { id, providerId, configured, educator } = await processingInStream();
    await webhook({ uid: providerId, status: { state: "error", errorReasonText: "Encoding failed" } });
    const stream = fakeStream();

    expect(await retryVideo(getDb(env.DB), id, streamProvider(configured, stream.send), educator.userId)).toBe("sent");

    expect(stream.calls.map((call) => call.method)).toEqual(["DELETE", "POST"]);
    expect(stream.calls[0].url).toContain(`/stream/${providerId}`);
    const row = await video(id);
    expect(row?.state).toBe("processing");
    expect(row?.providerId).not.toBe(providerId);
  });

  it("asks about videos whose report never came, in the daily job", async () => {
    const { id, providerId, configured } = await processingInStream();
    await env.DB.prepare("UPDATE video_asset SET updated_at = ?1 WHERE id = ?2")
      .bind(Date.now() - 2 * 60 * 60 * 1000, id)
      .run();
    const stream = fakeStream((method, path) =>
      method === "GET" && path === `/${providerId}`
        ? Response.json({ success: true, result: { uid: providerId, readyToStream: true, status: { state: "ready" } } })
        : undefined,
    );

    await refreshStalledVideos(getDb(env.DB), streamProvider(configured, stream.send), new Date());

    expect((await video(id))?.state).toBe("ready");
  });

  it("refuses to move a video's state backwards in the database itself", async () => {
    const { id, providerId } = await processingInStream();
    await webhook({ uid: providerId, readyToStream: true, status: { state: "ready" } });

    await expect(
      env.DB.prepare("UPDATE video_asset SET state = 'processing' WHERE id = ?1").bind(id).run(),
    ).rejects.toThrow(/only moves forwards/);
  });
});

const base64url = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));

describe("signed playback", () => {
  it("plays a Stream video through a token for that video, signed with the signing key, lasting ten minutes", async () => {
    const configured = await streamEnv();
    const now = new Date("2026-10-04T08:00:00Z");

    const playback = await streamProvider(configured).playback({ id: "asset", providerId: "stream-uid" }, now);

    const url = new URL(playback.url);
    expect(url.origin).toBe("https://customer-abc123.cloudflarestream.com");
    const [, token, ...rest] = url.pathname.split("/");
    expect(rest.join("/")).toBe("manifest/video.m3u8");
    const [header, payload, signature] = token.split(".");
    expect(JSON.parse(new TextDecoder().decode(base64url(payload)))).toEqual({
      sub: "stream-uid",
      kid: "signing-key-1",
      exp: now.getTime() / 1000 + 600,
    });
    expect(
      await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        (await streamKey()).publicKey,
        base64url(signature),
        new TextEncoder().encode(`${header}.${payload}`),
      ),
    ).toBe(true);
    expect(playback).toMatchObject({ hls: true, expiresAt: new Date(now.getTime() + 600_000) });
  });

  it("gives the local stand-in's tokens the same ten minutes, for one video only", async () => {
    const now = new Date();
    const playback = await localProvider(env).playback({ id: "video-1", providerId: "local-video-1" }, now);
    const token = new URL(playback.url, PUBLIC).searchParams.get("token");

    expect(await localPlaybackAllowed(env, "video-1", token, now)).toBe(true);
    expect(await localPlaybackAllowed(env, "video-2", token, now)).toBe(false);
    expect(await localPlaybackAllowed(env, "video-1", token, new Date(now.getTime() + 601_000))).toBe(false);
    expect(await localPlaybackAllowed(env, "video-1", null, now)).toBe(false);
  });
});

describe("the staff video page", () => {
  it("shows a ready video's facts and a preview through a short-lived signed address", async () => {
    const { id, educator } = await uploadedVideo(mp4({ seconds: 95.5, width: 1280, height: 720 }), "village.mp4");
    await scanUpload(env, getDb(env.DB), id, cleanScanner, localProvider(env));

    const page = await educator.browser.fetch(`/admin/media/${id}/video`);

    expect(page.status).toBe(200);
    expect(page.headers.get("Cache-Control")).toBe("private, no-store");
    expect(page.headers.get("Content-Security-Policy")).toContain("media-src 'self' blob:");
    const html = await page.text();
    expect(html).toContain("Ready to play");
    expect(html).toContain("1:36");
    expect(html).toContain("1280 × 720 (Landscape)");
    const src = html.match(/<video[^>]*src="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
    expect(src).toMatch(new RegExp(`^/admin/media/${id}/video/master\\?token=`));

    const played = await educator.browser.fetch(src as string, { headers: { Range: "bytes=0-15" } });
    expect(played.status).toBe(206);
    expect(new Uint8Array(await played.arrayBuffer())).toEqual(mp4({ seconds: 95.5 }).subarray(0, 16));
    expect((await educator.browser.fetch(`/admin/media/${id}/video/master?token=forged.token`)).status).toBe(403);
  });

  it("is only for staff who use the media library", async () => {
    const { id } = await uploadedVideo(mp4({ seconds: 20 }));
    await scanUpload(env, getDb(env.DB), id, cleanScanner, localProvider(env));
    const reviewer = await staff("reviewer", { role: "reviewer", reviewType: "editorial" });

    expect((await reviewer.browser.fetch(`/admin/media/${id}/video`)).status).toBe(403);
    expect((await reviewer.browser.fetch(`/admin/media/${id}/video/master`)).status).toBe(403);
  });

  it("shows why processing failed, and tries again when asked", async () => {
    const { id, educator } = await uploadedVideo(mp4({ seconds: 20 }));
    const unconfigured = { ...env, VIDEO_PROVIDER: "stream" } as unknown as Env;
    await scanUpload(unconfigured, getDb(env.DB), id, cleanScanner, streamProvider(unconfigured, fakeStream().send));

    const html = await (await educator.browser.fetch(`/admin/media/${id}/video`)).text();
    expect(html).toContain("Processing failed");
    expect(html).toContain("isn&#x27;t set up in this environment");
    expect(html).toContain("Try processing again");

    // Here the local stand-in takes it at once.
    const retried = await educator.browser.fetch(`/admin/media/${id}/video`, { form: { intent: "retry" } });
    expect(retried.status).toBe(200);
    expect((await video(id))?.state).toBe("ready");
    expect(await audits(id, "video_asset.uploaded")).toBe(1);
  });

  it("is linked from the media library with its processing state", async () => {
    const { id, educator } = await uploadedVideo(mp4({ seconds: 20 }), "linked.mp4");
    await scanUpload(env, getDb(env.DB), id, cleanScanner, localProvider(env));

    const html = await (await educator.browser.fetch("/admin/media")).text();

    expect(html).toContain(`href="/admin/media/${id}/video"`);
    expect(html).toContain("Video: Ready to play");
  });

  it("lets a playing page load media and playlists from the Stream customer subdomain only", () => {
    const headers = new Headers();
    applySecurityHeaders(headers, "nonce", {
      allowIndexing: false,
      video: { origin: "https://customer-abc123.cloudflarestream.com" },
    });
    const policy = headers.get("Content-Security-Policy");
    expect(policy).toContain("media-src 'self' blob: https://customer-abc123.cloudflarestream.com");
    expect(policy).toContain("connect-src 'self' https://customer-abc123.cloudflarestream.com");

    const plain = new Headers();
    applySecurityHeaders(plain, "nonce", { allowIndexing: false });
    expect(plain.get("Content-Security-Policy")).not.toContain("media-src");
    expect(plain.get("Content-Security-Policy")).toContain("connect-src 'self';");
  });
});
