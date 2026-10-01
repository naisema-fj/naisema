/**
 * What may be uploaded (docs/phase-1a-defaults.md §1, TECH-02): an allowlist checked before an
 * upload starts, and a check that the file's first bytes are what its name and type claim.
 * Everything else is refused. Shared by the media library and Rights Record evidence.
 */

export type UploadType =
  | "video/mp4"
  | "video/quicktime"
  | "audio/mpeg"
  | "audio/mp4"
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export type UploadKind = "video" | "audio" | "document" | "image";

/** Where a clean file goes: the media library, or a Rights Record's private evidence. */
export type UploadPurpose = "media" | "evidence";

/**
 * Where an upload has got to: uploading → scanning → ready, or failed (refused: wrong type, never
 * finished, unscannable) or infected (ClamAV found something), and finally removed after 30 days.
 */
export type MediaStatus = "uploading" | "scanning" | "ready" | "infected" | "failed" | "removed";

const MB = 1024 * 1024;

/** Per-kind size limits; video follows the 2 GB source-master limit (docs/decision-log.md). */
export const MAX_BYTES: Record<UploadKind, number> = {
  video: 2048 * MB,
  audio: 500 * MB,
  document: 50 * MB,
  image: 25 * MB,
};

export const EVIDENCE_MAX_BYTES = 10 * MB;

/** How a type's content starts: the family of signatures its first bytes must belong to. */
type Family = "iso-video" | "iso-audio" | "quicktime" | "mp3" | "pdf" | "jpeg" | "png" | "webp";

const TYPES: Record<UploadType, { kind: UploadKind; extensions: string[]; aliases: string[]; families: Family[] }> = {
  // MP4 and MOV share the ISO media layout, and both are video masters for the same pipeline, so
  // either brand is accepted for either; older QuickTime files open with a bare atom instead.
  "video/mp4": { kind: "video", extensions: ["mp4", "m4v"], aliases: [], families: ["iso-video"] },
  "video/quicktime": { kind: "video", extensions: ["mov"], aliases: [], families: ["iso-video", "quicktime"] },
  "audio/mpeg": { kind: "audio", extensions: ["mp3"], aliases: ["audio/mp3"], families: ["mp3"] },
  "audio/mp4": { kind: "audio", extensions: ["m4a"], aliases: ["audio/x-m4a", "audio/m4a"], families: ["iso-audio"] },
  "application/pdf": { kind: "document", extensions: ["pdf"], aliases: [], families: ["pdf"] },
  "image/jpeg": { kind: "image", extensions: ["jpg", "jpeg"], aliases: ["image/jpg"], families: ["jpeg"] },
  "image/png": { kind: "image", extensions: ["png"], aliases: [], families: ["png"] },
  "image/webp": { kind: "image", extensions: ["webp"], aliases: [], families: ["webp"] },
};

const EVIDENCE_TYPES: readonly UploadType[] = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** ISO media major brands for video and for audio. Others (HEIC, AVIF, 3GP...) are refused. */
const VIDEO_BRANDS = ["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "dash", "mmp4", "qt  "];
const AUDIO_BRANDS = ["M4A ", "M4B ", "mp42", "isom", "iso2", "dash"];

/** Media library files a Resource can offer for download: documents and audio. */
export const DOWNLOADABLE_TYPES: readonly UploadType[] = ["application/pdf", "audio/mpeg", "audio/mp4"];

/** The images a media library offers for use in content, such as a Creator's portrait. */
export const IMAGE_TYPES: readonly UploadType[] = ["image/jpeg", "image/png", "image/webp"];

/** The audio a Voices Episode can play (docs/phase-1a-defaults.md §9). */
export const EPISODE_AUDIO_TYPES: readonly UploadType[] = ["audio/mpeg", "audio/mp4"];

/** How many leading bytes the content check reads. */
export const HEAD_BYTES = 16;

/** A file name as stored: at most 200 characters. */
export const storedName = (name: string) => name.slice(0, 200);

/** A file name safe to put in a Content-Disposition header. */
export const downloadName = (name: string) => name.replace(/[^\w.-]+/g, "_");

export const kindOf = (type: UploadType): UploadKind => TYPES[type].kind;

/** How a type is named to staff. */
export const UPLOAD_TYPE_NAMES: Record<UploadType, string> = {
  "video/mp4": "MP4 video",
  "video/quicktime": "MOV video",
  "audio/mpeg": "MP3 audio",
  "audio/mp4": "M4A audio",
  "application/pdf": "PDF",
  "image/jpeg": "JPEG image",
  "image/png": "PNG image",
  "image/webp": "WebP image",
};

/** A file size as staff read it: "820 KB", "12.5 MB", "1.2 GB". */
export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1).replace(/\.0$/, "")} GB`;
}

/** A file name's extension, as typed, for the accept list of a file input. */
export const acceptedExtensions = (purpose: UploadPurpose) =>
  (purpose === "evidence" ? EVIDENCE_TYPES : (Object.keys(TYPES) as UploadType[]))
    .flatMap((type) => TYPES[type].extensions.map((extension) => `.${extension}`))
    .join(",");

const sizeName = (bytes: number) => (bytes >= 1024 * MB ? `${bytes / (1024 * MB)} GB` : `${bytes / MB} MB`);

export type DeclaredCheck = { ok: true; type: UploadType } | { ok: false; error: string };

/**
 * Checks what a file says it is, before any of it is uploaded: its extension must be on the
 * allowlist, its declared type (if the browser gave one) must agree, and its size must fit.
 */
export function checkDeclared(
  file: { name: string; type: string; size: number },
  purpose: UploadPurpose,
): DeclaredCheck {
  const extension = file.name.includes(".") ? (file.name.split(".").at(-1)?.toLowerCase() ?? "") : "";
  const allowed = purpose === "evidence" ? EVIDENCE_TYPES : (Object.keys(TYPES) as UploadType[]);
  const type = allowed.find((candidate) => TYPES[candidate].extensions.includes(extension));
  if (!type) {
    return {
      ok: false,
      error:
        purpose === "evidence"
          ? "Evidence must be a PDF, JPEG, PNG or WebP file."
          : "Upload an MP4, MOV, MP3, M4A, PDF, JPEG, PNG or WebP file.",
    };
  }
  const declared = file.type.toLowerCase();
  if (declared && declared !== type && !TYPES[type].aliases.includes(declared)) {
    return { ok: false, error: "The file's name and type don't agree. Check it is the right file." };
  }
  const limit = purpose === "evidence" ? EVIDENCE_MAX_BYTES : MAX_BYTES[TYPES[type].kind];
  if (file.size <= 0) return { ok: false, error: "That file is empty." };
  if (file.size > limit) return { ok: false, error: `That file is too large: the limit is ${sizeName(limit)}.` };
  return { ok: true, type };
}

/** Whether four bytes open a valid MPEG audio frame header: sync, then no reserved fields. */
function mpegFrame(head: Uint8Array) {
  if (head.length < 3 || head[0] !== 0xff || (head[1] & 0xe0) !== 0xe0) return false;
  const version = (head[1] >> 3) & 0x03;
  const layer = (head[1] >> 1) & 0x03;
  const bitrate = head[2] >> 4;
  const sampleRate = (head[2] >> 2) & 0x03;
  return version !== 0x01 && layer !== 0x00 && bitrate !== 0x0f && sampleRate !== 0x03;
}

/** The signature families a file's first bytes belong to (an ISO media brand can be both video and audio). */
function familiesOf(head: Uint8Array): Family[] {
  const startsWith = (...signature: number[]) => signature.every((byte, index) => head[index] === byte);
  const ascii = (from: number, value: string) =>
    head.length >= from + value.length && [...value].every((char, index) => head[from + index] === char.charCodeAt(0));
  if (ascii(0, "%PDF-")) return ["pdf"];
  if (startsWith(0xff, 0xd8, 0xff)) return ["jpeg"];
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return ["png"];
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return ["webp"];
  if (ascii(4, "ftyp")) {
    const brand = String.fromCharCode(...head.subarray(8, 12));
    return [
      ...(VIDEO_BRANDS.includes(brand) ? (["iso-video"] as const) : []),
      ...(AUDIO_BRANDS.includes(brand) ? (["iso-audio"] as const) : []),
    ];
  }
  if (["moov", "mdat", "wide", "free", "skip", "pnot"].some((atom) => ascii(4, atom))) return ["quicktime"];
  // An ID3 tag, or straight into an MPEG audio frame.
  if (ascii(0, "ID3") || mpegFrame(head)) return ["mp3"];
  return [];
}

/** Checks a file's first bytes against its accepted type, so a renamed executable never gets in. */
export function checkContent(type: UploadType, head: Uint8Array): { ok: true } | { ok: false; error: string } {
  if (familiesOf(head).some((family) => TYPES[type].families.includes(family))) return { ok: true };
  return {
    ok: false,
    error: "The file's contents don't match its type. It may be renamed or damaged, so it wasn't accepted.",
  };
}
