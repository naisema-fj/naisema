/**
 * What a Na iSema Voices Episode adds to a Content Item (docs/phase-1a-defaults.md §9): its audio
 * from the media library, who is speaking, when it was recorded, how long it is, its transcript
 * and the approved places it is also distributed. Stored in the Episode's Revision snapshot.
 * Video Episodes arrive with the video pipeline (#16).
 */

export type DistributionLink = { label: string; url: string };

export type EpisodeDetails = {
  /** A media library MP3 or M4A that has passed its scan. */
  audioAssetId: string;
  host: string;
  guests: string[];
  /** The day it was recorded, YYYY-MM-DD. */
  recordedOn: string;
  durationSeconds: number;
  /** Plain text, paragraphs separated by blank lines, "Name: …" for who speaks. Required to publish. */
  transcript: string;
  /** Where else it can be heard, such as a podcast app; approved with the Revision. */
  distribution: DistributionLink[];
};

export const EPISODE_LIMITS = {
  name: 120,
  guests: 12,
  transcript: 200_000,
  distribution: 4,
  linkLabel: 60,
  url: 2000,
} as const;

export type EpisodeField =
  | "episodeAudioAssetId"
  | "episodeHost"
  | "episodeGuests"
  | "episodeRecordedOn"
  | "episodeDuration"
  | "episodeTranscript"
  | "episodeDistribution";

export type EpisodeFieldsResult =
  | { ok: true; details: EpisodeDetails }
  | { ok: false; errors: Partial<Record<EpisodeField, string>>; values: Partial<EpisodeDetails> };

/** Reads an Episode's fields from the content form. `today` bounds the recording date. */
export function readEpisodeFields(form: FormData, today = new Date()): EpisodeFieldsResult {
  const errors: Partial<Record<EpisodeField, string>> = {};
  const field = (name: EpisodeField) => String(form.get(name) ?? "").trim();

  const audioAssetId = field("episodeAudioAssetId");
  if (!audioAssetId) errors.episodeAudioAssetId = "Choose the audio from the media library.";

  const host = field("episodeHost");
  if (!host) errors.episodeHost = "Enter who hosts this Episode.";
  else if (host.length > EPISODE_LIMITS.name)
    errors.episodeHost = `This can be at most ${EPISODE_LIMITS.name} characters.`;

  const guests = field("episodeGuests")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (guests.length > EPISODE_LIMITS.guests) errors.episodeGuests = `List at most ${EPISODE_LIMITS.guests} guests.`;
  else if (guests.some((guest) => guest.length > EPISODE_LIMITS.name)) {
    errors.episodeGuests = `Each name can be at most ${EPISODE_LIMITS.name} characters.`;
  }

  const recordedOn = field("episodeRecordedOn");
  const recorded = /^\d{4}-\d{2}-\d{2}$/.test(recordedOn) ? new Date(`${recordedOn}T00:00:00Z`) : null;
  if (!recorded || Number.isNaN(recorded.getTime())) errors.episodeRecordedOn = "Enter the day it was recorded.";
  else if (recordedOn > today.toISOString().slice(0, 10)) errors.episodeRecordedOn = "That date is in the future.";

  const durationSeconds = parseDuration(field("episodeDuration"));
  if (durationSeconds === null) {
    errors.episodeDuration = "Enter how long it is as minutes and seconds, like 32:10, or 1:05:00.";
  }

  const transcript = String(form.get("episodeTranscript") ?? "")
    .replaceAll("\r\n", "\n")
    .trim();
  if (transcript.length > EPISODE_LIMITS.transcript) {
    errors.episodeTranscript = `The transcript can be at most ${EPISODE_LIMITS.transcript.toLocaleString("en")} characters.`;
  }

  const labels = form.getAll("episodeLinkLabel").map((value) => String(value).trim());
  const urls = form.getAll("episodeLinkUrl").map((value) => String(value).trim());
  const distribution = labels
    .map((label, index) => ({ label, url: urls[index] ?? "" }))
    .filter((link) => link.label || link.url);
  if (distribution.length > EPISODE_LIMITS.distribution) {
    errors.episodeDistribution = `Add at most ${EPISODE_LIMITS.distribution} links.`;
  } else if (distribution.some((link) => !link.label || link.label.length > EPISODE_LIMITS.linkLabel)) {
    errors.episodeDistribution = `Name each link, in at most ${EPISODE_LIMITS.linkLabel} characters, like "Spotify".`;
  } else if (distribution.some((link) => link.url.length > EPISODE_LIMITS.url || !isSecureUrl(link.url))) {
    errors.episodeDistribution = "Enter each link as a full web address starting with https://.";
  }

  const values = { audioAssetId, host, guests, recordedOn, transcript, distribution };
  if (Object.keys(errors).length || durationSeconds === null) {
    return { ok: false, errors, values: { ...values, ...(durationSeconds === null ? {} : { durationSeconds }) } };
  }
  return { ok: true, details: { ...values, durationSeconds } };
}

/** "32:10" or "1:05:00" as seconds; null for anything else, or for no time at all. */
export function parseDuration(value: string): number | null {
  const parts = value.trim().split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const [seconds, minutes, hours = 0] = parts.map(Number).reverse();
  if (seconds > 59 || (parts.length === 3 && minutes > 59)) return null;
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

/** A duration as a visitor reads it: "32 min", "1 hr 5 min" (to the nearest minute, at least one). */
export function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${minutes} min`;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/** A duration for `<time datetime>`: "PT32M10S". */
export function isoDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${rest ? `${rest}S` : ""}`;
}

/** A speaker's label: one to four capitalised words ("Ratu Joni", "Na iSema"), then a colon. */
const SPEAKER = /^((?:\p{Lu}|\p{Ll}\p{Lu})[\p{L}'’.-]*(?: (?:\p{Lu}|\p{Ll}\p{Lu})[\p{L}'’.-]*){0,3}):\s+/u;

/** A transcript as paragraphs, each with who is speaking when it starts "Name: …". */
export function transcriptParagraphs(transcript: string): { speaker: string | null; text: string }[] {
  return transcript
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const match = paragraph.match(SPEAKER);
      return match ? { speaker: match[1], text: paragraph.slice(match[0].length) } : { speaker: null, text: paragraph };
    });
}

function isSecureUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}
