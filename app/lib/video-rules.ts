/**
 * Rules for a Video Asset (ADR-0008, docs/decision-log.md "Video implementation decisions"): its
 * processing states, the 15-minute limit, and how a video provider's reports are read. A Video
 * Asset is a scanned video master kept in R2 and the copy a provider (Cloudflare Stream) made of it
 * for delivery.
 */

/**
 * uploaded (the master is in R2, not yet sent) → processing (the provider is copying and encoding
 * it) → ready, or failed with a reason. A failure can be tried again, which starts over at uploaded.
 */
export const VIDEO_STATES = ["uploaded", "processing", "ready", "failed"] as const;
export type VideoState = (typeof VIDEO_STATES)[number];

export const VIDEO_STATE_NAMES: Record<VideoState, string> = {
  uploaded: "Waiting to be sent for processing",
  processing: "Processing in Stream",
  ready: "Ready to play",
  failed: "Processing failed",
};

/** The longest source master accepted; longer sources are used through Excerpts. */
export const MAX_VIDEO_SECONDS = 15 * 60;
/** How long a signed playback token lasts (about ten minutes, VTECH-05). */
export const PLAYBACK_TOKEN_SECONDS = 10 * 60;
/** How long the provider's pre-signed address for a master lasts: long enough to start a 2 GB copy. */
export const MASTER_URL_SECONDS = 60 * 60;

export type Orientation = "landscape" | "portrait" | "square";

/** Who holds a video's delivery copy: Cloudflare Stream, or the local stand-in in development and tests. */
export type VideoProviderName = "stream" | "local";

export const VIDEO_PROVIDER_NAMES: Record<VideoProviderName, string> = {
  stream: "Cloudflare Stream",
  local: "Local stand-in (development)",
};

/** Whether an upload is a video master for the pipeline: a video in the media library. */
export const isVideoMaster = (upload: { purpose: string; type: string }) =>
  upload.purpose === "media" && upload.type.startsWith("video/");

const MOVES: Record<VideoState, readonly VideoState[]> = {
  uploaded: ["processing", "ready", "failed"],
  processing: ["ready", "failed"],
  ready: [],
  failed: ["uploaded"],
};

/**
 * Whether a Video Asset may move between two states. Provider reports can arrive twice or out of
 * order, so a state is only ever left forwards: a late "processing" never undoes "ready".
 */
export const canMoveVideo = (from: VideoState, to: VideoState) => MOVES[from].includes(to);

/** A length as minutes and seconds, "1:01", or with hours, "1:02:05". */
export function formatVideoLength(ms: number) {
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

/**
 * Why a video is too long to accept, or null. Judged to the second as its length is shown, so a
 * 15-minute video whose container says 900.02 seconds is accepted.
 */
export function lengthProblem(durationMs: number) {
  if (Math.round(durationMs / 1000) <= MAX_VIDEO_SECONDS) return null;
  return `This video is ${formatVideoLength(durationMs)} long. The limit is 15 minutes: trim it, or upload the part you need, and try again.`;
}

export const orientationOf = (width: number, height: number): Orientation =>
  width > height ? "landscape" : width < height ? "portrait" : "square";

/**
 * A reason as staff may read it: no addresses (a pre-signed one carries a signature), no bearer
 * tokens or signing fields, and at most 300 characters.
 */
export function safeReason(text: string) {
  return text
    .replace(/https?:\/\/\S+/gi, "[address removed]")
    .replace(/Bearer\s+\S+/gi, "Bearer [removed]")
    .replace(/X-Amz-[\w-]+=\S+/gi, "[removed]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** What a provider reported about one of its videos. */
export type ProviderUpdate = {
  state: Exclude<VideoState, "uploaded">;
  reason: string | null;
  durationMs: number | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/**
 * Reads a Stream video object, as a webhook delivers it or the API answers for one video. Anything
 * not ready or in error is still processing. Null if it isn't a video object.
 */
export function readStreamVideo(body: unknown): { providerId: string; update: ProviderUpdate } | null {
  if (!isRecord(body) || typeof body.uid !== "string" || !body.uid) return null;
  const status = isRecord(body.status) ? body.status : {};
  const duration = typeof body.duration === "number" && body.duration > 0 ? Math.round(body.duration * 1000) : null;
  if (status.state === "error") {
    // Stream's documentation spells these both ways (errorReason… and errReason…).
    const why = [status.errorReasonText, status.errReasonText, status.errorReasonCode, status.errReasonCode].find(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    return {
      providerId: body.uid,
      update: {
        state: "failed",
        reason: safeReason(`Stream couldn't process it: ${why ?? "no reason was given."}`),
        durationMs: duration,
      },
    };
  }
  const ready = body.readyToStream === true || status.state === "ready";
  return {
    providerId: body.uid,
    update: { state: ready ? "ready" : "processing", reason: null, durationMs: duration },
  };
}
