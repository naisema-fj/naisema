import { r2PresignedGet } from "./presign.server";
import { optionalSecret } from "./secrets.server";
import { signToken, verifyToken } from "./signed-tokens.server";
import { signPlaybackToken } from "./stream-signing.server";
import {
  MASTER_URL_SECONDS,
  PLAYBACK_TOKEN_SECONDS,
  type ProviderUpdate,
  readStreamVideo,
  safeReason,
  type VideoProviderName,
} from "./video-rules";

/**
 * The small interface every video provider sits behind (ADR-0008), so another provider could be
 * pointed at the same R2 masters. Cloudflare Stream is the real one; development and tests use a
 * local stand-in that "processes" a video at once and plays the master itself.
 *
 * Stream is only ever asked to copy, report on, delete and play a video. Its automatic captions
 * are never asked for: captions come from our own reviewed Segments.
 */

export type CopyRequest = { assetId: string; name: string; masterKey: string; environment: string };

export type Playback = {
  url: string;
  /** An HLS playlist (played by hls.js where the browser can't), or a plain file. */
  hls: boolean;
};

export interface VideoProvider {
  readonly name: VideoProviderName;
  /** Asks the provider to copy a master from R2; its ID for the copy, and its state if already known. */
  copy(request: CopyRequest, now: Date): Promise<{ providerId: string; update?: ProviderUpdate }>;
  /** Where the provider says its copy has got to, or null if it has no such video. */
  status(providerId: string): Promise<ProviderUpdate | null>;
  /** Deletes the provider's copy; one already gone needs nothing more. */
  remove(providerId: string): Promise<void>;
  /** A signed address to play the copy, lasting about ten minutes. */
  playback(video: { id: string; providerId: string }, now: Date): Promise<Playback>;
}

/**
 * A provider call that failed. Its message is safe to show staff (no addresses or credentials).
 * `retry` says whether trying again later could help (a lost connection, a server error) or not
 * (a refusal, missing set-up).
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retry: boolean,
  ) {
    super(safeReason(message));
  }
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Secrets that are set per environment once Stream is set up (docs/handover/runbook.md, video). */
const STREAM_SECRETS = [
  "STREAM_API_TOKEN",
  "STREAM_CUSTOMER_CODE",
  "STREAM_SIGNING_KEY_ID",
  "STREAM_SIGNING_KEY_JWK",
  "R2_MASTERS_ACCESS_KEY_ID",
  "R2_MASTERS_SECRET_ACCESS_KEY",
] as const;
type StreamSecret = (typeof STREAM_SECRETS)[number];

const NOT_SET_UP =
  "Video processing isn't set up in this environment yet (Stream's secrets are missing). Tell the technical owner.";

/** Cloudflare Stream, reached through its API with a token allowed to edit Stream only. */
export function streamProvider(env: Env, send: Fetch = (input, init) => fetch(input, init)): VideoProvider {
  const secret = (name: StreamSecret) => {
    const value = optionalSecret(env, name);
    if (!value) throw new ProviderError(NOT_SET_UP, false);
    return value;
  };
  const api = (path: string) =>
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream${path}`;

  async function call(path: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await send(api(path), {
        ...init,
        headers: { Authorization: `Bearer ${secret("STREAM_API_TOKEN")}`, "Content-Type": "application/json" },
      });
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError("Stream couldn't be reached.", true);
    }
    const body = (await response.json().catch(() => null)) as {
      result?: unknown;
      errors?: { message?: string }[];
    } | null;
    return { response, body };
  }

  const refusal = (status: number, body: { errors?: { message?: string }[] } | null) => {
    const message = body?.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join("; ");
    return new ProviderError(
      `Stream refused the video (${status})${message ? `: ${message}` : "."}`,
      status >= 500 || status === 429,
    );
  };

  return {
    name: "stream",

    async copy(request, now) {
      const url = await r2PresignedGet({
        accountId: env.CLOUDFLARE_ACCOUNT_ID,
        bucket: env.VIDEO_MASTERS_BUCKET,
        key: request.masterKey,
        accessKeyId: secret("R2_MASTERS_ACCESS_KEY_ID"),
        secretAccessKey: secret("R2_MASTERS_SECRET_ACCESS_KEY"),
        expiresSeconds: MASTER_URL_SECONDS,
        now,
      });
      const { response, body } = await call("/copy", {
        method: "POST",
        body: JSON.stringify({
          url,
          // Every video needs a signed token to play (VTECH-05).
          requireSignedURLs: true,
          meta: { name: request.name, naisemaAssetId: request.assetId, environment: request.environment },
        }),
      });
      const video = response.ok ? readStreamVideo(body?.result) : null;
      if (!video) throw refusal(response.status, body);
      return { providerId: video.providerId, update: video.update };
    },

    async status(providerId) {
      const { response, body } = await call(`/${encodeURIComponent(providerId)}`);
      if (response.status === 404) return null;
      if (!response.ok) throw refusal(response.status, body);
      return readStreamVideo(body?.result)?.update ?? null;
    },

    async remove(providerId) {
      const { response, body } = await call(`/${encodeURIComponent(providerId)}`, { method: "DELETE" });
      if (!response.ok && response.status !== 404) throw refusal(response.status, body);
    },

    async playback(video, now) {
      const token = await signPlaybackToken({
        keyId: secret("STREAM_SIGNING_KEY_ID"),
        jwk: secret("STREAM_SIGNING_KEY_JWK"),
        videoId: video.providerId,
        now,
        seconds: PLAYBACK_TOKEN_SECONDS,
      });
      return {
        url: `https://customer-${secret("STREAM_CUSTOMER_CODE")}.cloudflarestream.com/${token}/manifest/video.m3u8`,
        hls: true,
      };
    },
  };
}

const LOCAL_PLAYBACK = "local-video-playback";

/** The address the local stand-in plays a master from, signed and expiring like Stream's. */
export const localPlaybackPath = (id: string) => `/admin/media/${id}/video/master`;

/**
 * The local stand-in: a copy is ready at once, and plays the master from VIDEO_MASTERS through a
 * staff-only route with a token that expires as Stream's does.
 */
export function localProvider(env: Env): VideoProvider {
  return {
    name: "local",
    async copy(request) {
      return { providerId: `local-${request.assetId}`, update: { state: "ready", reason: null, durationMs: null } };
    },
    async status() {
      return { state: "ready", reason: null, durationMs: null };
    },
    async remove() {},
    async playback(video, now) {
      const expires = Math.floor(now.getTime() / 1000) + PLAYBACK_TOKEN_SECONDS;
      const token = await signToken(env.BETTER_AUTH_SECRET, LOCAL_PLAYBACK, `${video.id}:${expires}`);
      return {
        url: `${localPlaybackPath(video.id)}?token=${encodeURIComponent(token)}`,
        hls: false,
      };
    },
  };
}

/** Whether a local playback token is for this video and hasn't expired. */
export async function localPlaybackAllowed(env: Env, id: string, token: string | null, now = new Date()) {
  const value = token && (await verifyToken(env.BETTER_AUTH_SECRET, LOCAL_PLAYBACK, token));
  if (!value) return false;
  const [tokenId, expires] = value.split(":");
  return tokenId === id && Number(expires) * 1000 > now.getTime();
}

/**
 * Where this environment's videos play from, for a playing page's content security policy: the
 * Stream customer subdomain, or null when videos play from the site itself (the local stand-in).
 */
export function videoPlaybackOrigin(env: Env) {
  const code = optionalSecret(env, "STREAM_CUSTOMER_CODE");
  return env.VIDEO_PROVIDER === "stream" && code ? `https://customer-${code}.cloudflarestream.com` : null;
}

/** The provider this environment uses (`VIDEO_PROVIDER` in wrangler.jsonc). */
export const videoProvider = (env: Env, send?: Fetch): VideoProvider =>
  env.VIDEO_PROVIDER === "stream" ? streamProvider(env, send) : localProvider(env);
