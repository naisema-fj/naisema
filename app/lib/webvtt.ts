import type { Segment } from "./segment-rules";

/**
 * WebVTT import and export for a Learning Layer (VCMS-04, ADR-0008). Segments are the source of
 * truth: a WebVTT file is one language's text at the Segments' times, with each Segment's ID as
 * its cue ID so an English file can be matched back to the Segments it came from. Imported text is
 * always marked as an unreviewed draft. Times are relative to the Learning Layer's clip.
 */

export type Cue = { id: string; startMs: number; endMs: number; speaker: string; text: string };

export type ParsedWebVtt = { ok: true; cues: Cue[] } | { ok: false; error: string };

export type SegmentLanguage = "fijian" | "english";

const TIME = /^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})$/;

function readTime(text: string): number | null {
  const match = text.match(TIME);
  if (!match) return null;
  const [, hours, minutes, seconds, millis] = match;
  if (Number(minutes) > 59 || Number(seconds) > 59) return null;
  return Number(hours ?? 0) * 3_600_000 + Number(minutes) * 60_000 + Number(seconds) * 1000 + Number(millis);
}

const pad = (value: number, width = 2) => String(value).padStart(width, "0");

/** A WebVTT timestamp, always with hours: "00:01:04.250". */
function writeTime(ms: number) {
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor((ms % 3_600_000) / 60_000))}:${pad(Math.floor((ms % 60_000) / 1000))}.${pad(ms % 1000, 3)}`;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
  "&lrm;": "",
  "&rlm;": "",
};

/** A cue's text without its markup: the voice is taken out, other tags dropped, entities read. */
function readCueText(lines: string[]) {
  let speaker = "";
  const text = lines
    .join("\n")
    .replace(/<v(?:\.[\w.-]+)?\s+([^>]*)>/g, (_, name: string) => {
      speaker ||= name.trim();
      return "";
    })
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|nbsp|lrm|rlm);/g, (entity) => ENTITIES[entity]);
  return { speaker, text: text.trim() };
}

const escapeText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Reads a WebVTT file's cues; notes, style and region blocks and cue settings are skipped. */
export function parseWebVtt(input: string): ParsedWebVtt {
  const lines = input.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  if (!/^WEBVTT(?:$|[ \t])/.test(lines[0] ?? "")) {
    return { ok: false, error: "This isn't a WebVTT file: it must start with WEBVTT." };
  }
  const cues: Cue[] = [];
  let index = 1;
  // Skip the rest of the header block.
  while (index < lines.length && lines[index].trim() !== "") index++;
  while (index < lines.length) {
    while (index < lines.length && lines[index].trim() === "") index++;
    if (index >= lines.length) break;
    const blockStart = index;
    const block: string[] = [];
    while (index < lines.length && lines[index].trim() !== "") block.push(lines[index++]);
    if (/^(NOTE|STYLE|REGION)(?:$|[ \t])/.test(block[0])) continue;
    const timingAt = block[0].includes("-->") ? 0 : 1;
    const timing = block[timingAt];
    if (!timing?.includes("-->")) return { ok: false, error: `Line ${blockStart + 1} isn't a cue's times.` };
    const [start, rest = ""] = timing.split("-->");
    const startMs = readTime(start.trim());
    const endMs = readTime(rest.trim().split(/[ \t]+/)[0] ?? "");
    if (startMs === null || endMs === null) {
      return { ok: false, error: `Line ${blockStart + timingAt + 1} has a time that can't be read.` };
    }
    cues.push({
      id: timingAt === 1 ? block[0].trim() : "",
      startMs,
      endMs,
      ...readCueText(block.slice(timingAt + 1)),
    });
  }
  return { ok: true, cues };
}

/** One language's text as a WebVTT file; Segments without text in that language are left out. */
export function toWebVtt(segments: Segment[], language: SegmentLanguage) {
  const blocks = segments
    .filter((segment) => segment[language].trim())
    .map((segment) => {
      const voice = segment.speaker ? `<v ${escapeText(segment.speaker)}>` : "";
      return `${segment.id}\n${writeTime(segment.startMs)} --> ${writeTime(segment.endMs)}\n${voice}${escapeText(segment[language])}\n`;
    });
  return ["WEBVTT", "", ...blocks.flatMap((block) => [block.trimEnd(), ""])].join("\n");
}

/** How far a cue's start and end may be from a Segment's for an English cue to match it. */
const MATCH_MS = 250;

export type WebVttImport = { segments: Segment[]; matched: number; unmatched: number };

/**
 * Imports cues as one language. Fijian cues become new Segments, replacing the old ones. English
 * cues fill the translation of the Segment with their ID, or with the same times; cues that match
 * no Segment are counted and left out. Everything imported is an unreviewed draft.
 */
export function importWebVtt(cues: Cue[], existing: Segment[], language: SegmentLanguage): WebVttImport {
  if (language === "fijian") {
    return {
      segments: cues.map((cue) => ({
        id: crypto.randomUUID(),
        startMs: cue.startMs,
        endMs: cue.endMs,
        speaker: cue.speaker,
        fijian: cue.text,
        english: "",
        overlapIntended: false,
        draft: true,
        retimed: false,
      })),
      matched: cues.length,
      unmatched: 0,
    };
  }
  const segments = existing.map((segment) => ({ ...segment }));
  let matched = 0;
  for (const cue of cues) {
    const target =
      segments.find((segment) => cue.id && segment.id === cue.id) ??
      segments.find(
        (segment) =>
          Math.abs(segment.startMs - cue.startMs) <= MATCH_MS && Math.abs(segment.endMs - cue.endMs) <= MATCH_MS,
      );
    if (!target) continue;
    target.english = cue.text;
    target.draft = true;
    matched += 1;
  }
  return { segments, matched, unmatched: cues.length - matched };
}
