import { latestToday } from "./calendar";
import type { RightsPart } from "./rights-rules";

/**
 * What a Na iSema Voices Episode adds to a Content Item (docs/phase-1a-defaults.md §9): its
 * recording from the media library (audio, or a video in its place), who is speaking, the music and
 * archive clips it uses, when it was recorded, how long it is, its transcript and the approved
 * places it is also distributed. Stored in the Episode's Revision snapshot.
 */

export type DistributionLink = { label: string; url: string };

export type EpisodeDetails = {
  /** A media library MP3 or M4A that has passed its scan; empty for a video Episode. */
  audioAssetId: string;
  /** A video Episode's recording: a Video Asset that has finished processing, in place of audio. */
  videoAssetId?: string;
  host: string;
  guests: string[];
  /** The music it uses, one piece each ("Isa Lei, 1962 recording"); absent in early Revisions. */
  music?: string[];
  /** The archive clips it uses, one each; absent in early Revisions. */
  archiveClips?: string[];
  /** The day it was recorded, YYYY-MM-DD. */
  recordedOn: string;
  durationSeconds: number;
  /** Plain text, paragraphs separated by blank lines, "Name: …" for who speaks. Required to publish. */
  transcript: string;
  /** Where else it can be heard, such as a podcast app; approved with the Revision. */
  distribution: DistributionLink[];
};

export const EPISODE_LIMITS = {
  /** A person's name, or a piece of music or clip as listed. */
  partName: 200,
  /** Guests, pieces of music and archive clips, each. */
  parts: 20,
  transcript: 200_000,
  distribution: 4,
  linkLabel: 60,
  url: 2000,
} as const;

export type EpisodeField =
  | "episodeRecording"
  | "episodeAudioAssetId"
  | "episodeVideoAssetId"
  | "episodeHost"
  | "episodeGuests"
  | "episodeMusic"
  | "episodeArchiveClips"
  | "episodeRecordedOn"
  | "episodeDuration"
  | "episodeTranscript"
  | "episodeDistribution";

export type EpisodeFieldsResult =
  | { ok: true; details: EpisodeDetails }
  | {
      ok: false;
      errors: Partial<Record<EpisodeField, string>>;
      /** What was entered, the length as typed, so the form can show it again. */
      values: Partial<EpisodeDetails> & { durationEntered: string };
    };

/** Reads an Episode's fields from the content form. `today` bounds the recording date. */
export function readEpisodeFields(form: FormData, today = new Date()): EpisodeFieldsResult {
  const errors: Partial<Record<EpisodeField, string>> = {};
  const field = (name: EpisodeField) => String(form.get(name) ?? "").trim();

  // Audio, or a video in its place.
  const video = field("episodeRecording") === "video";
  const audioAssetId = video ? "" : field("episodeAudioAssetId");
  const videoAssetId = video ? field("episodeVideoAssetId") : "";
  if (!video && !audioAssetId) errors.episodeAudioAssetId = "Choose the audio from the media library.";
  if (video && !videoAssetId) errors.episodeVideoAssetId = "Choose the video from the media library.";

  const host = field("episodeHost");
  if (!host) errors.episodeHost = "Enter who hosts this Episode.";
  else if (host.length > EPISODE_LIMITS.partName) {
    errors.episodeHost = `This can be at most ${EPISODE_LIMITS.partName} characters.`;
  }
  const list = (name: EpisodeField, what: string) => {
    const lines = field(name)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length > EPISODE_LIMITS.parts) errors[name] = `List at most ${EPISODE_LIMITS.parts} ${what}.`;
    else if (lines.some((line) => line.length > EPISODE_LIMITS.partName)) {
      errors[name] = `Each line can be at most ${EPISODE_LIMITS.partName} characters.`;
    }
    return lines;
  };
  const guests = list("episodeGuests", "guests");
  const music = list("episodeMusic", "pieces of music");
  const archiveClips = list("episodeArchiveClips", "archive clips");

  const recordedOn = field("episodeRecordedOn");
  const recorded = /^\d{4}-\d{2}-\d{2}$/.test(recordedOn) ? new Date(`${recordedOn}T00:00:00Z`) : null;
  if (!recorded || Number.isNaN(recorded.getTime())) errors.episodeRecordedOn = "Enter the day it was recorded.";
  else if (recordedOn > latestToday(today)) errors.episodeRecordedOn = "That date is in the future.";

  const durationEntered = field("episodeDuration");
  const durationSeconds = parseDuration(durationEntered);
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

  const values = {
    audioAssetId,
    ...(video ? { videoAssetId } : {}),
    host,
    guests,
    music,
    archiveClips,
    recordedOn,
    transcript,
    distribution,
  };
  if (Object.keys(errors).length || durationSeconds === null) {
    return {
      ok: false,
      errors,
      values: { ...values, ...(durationSeconds === null ? {} : { durationSeconds }), durationEntered },
    };
  }
  return { ok: true, details: { ...values, durationSeconds } };
}

/** An Episode's recording: its audio, or the video in its place. */
export const episodeRecording = (details: Pick<EpisodeDetails, "audioAssetId" | "videoAssetId">) =>
  details.videoAssetId
    ? ({ kind: "video", assetId: details.videoAssetId } as const)
    : ({ kind: "audio", assetId: details.audioAssetId } as const);

/** "32:10" or "1:05:00" as seconds; null for anything else, or for no time at all. */
export function parseDuration(value: string): number | null {
  const parts = value.trim().split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const [seconds, minutes, hours = 0] = parts.map(Number).reverse();
  if (seconds > 59 || (parts.length === 3 && minutes > 59)) return null;
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

/** Seconds as staff type them: "32:10", "1:05:00" (the inverse of parseDuration). */
export function clockDuration(seconds: number) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}` : `${minutes}:${pad(seconds % 60)}`;
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

/** Who speaks in an Episode: its host and guests. */
export const episodeSpeakers = (episode: Pick<EpisodeDetails, "host" | "guests">) => [episode.host, ...episode.guests];

/**
 * A transcript as paragraphs, each with who is speaking when it starts "Name: …". Only a speaker's
 * full name or one word of it ("Mere" for Mere Vula) counts, so "Translation: …" stays text.
 */
export function transcriptParagraphs(
  transcript: string,
  speakers: string[],
): { speaker: string | null; text: string }[] {
  const known = new Set(
    speakers.flatMap((name) => [name, ...name.split(/\s+/)]).map((name) => name.trim().toLowerCase()),
  );
  known.delete("");
  return transcript
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const match = paragraph.match(/^([^:\n]{1,80}):\s+/);
      return match && known.has(match[1].trim().toLowerCase())
        ? { speaker: match[1].trim(), text: paragraph.slice(match[0].length) }
        : { speaker: null, text: paragraph };
    });
}

/** The parts of an Episode that can have Rights Records of their own (CONTEXT.md, Rights Record). */
export function episodeParts(episode: EpisodeDetails): RightsPart[] {
  return [
    ...episodeSpeakers(episode).map((name) => ({ kind: "speaker" as const, name })),
    ...(episode.music ?? []).map((name) => ({ kind: "music" as const, name })),
    ...(episode.archiveClips ?? []).map((name) => ({ kind: "archive" as const, name })),
  ];
}

/** Distribution links as one line, for staff pages. */
export const distributionText = (links: DistributionLink[]) =>
  links.map((link) => `${link.label} (${link.url})`).join(", ");

function isSecureUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}
