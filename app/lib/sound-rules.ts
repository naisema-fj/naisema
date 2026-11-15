import { formatDay } from "./rights-rules";

/**
 * The rules for Sounds (docs/change-notes/0003-pronunciation-sound-guide.md): the letters of a
 * Language Variety's sound guide, each with its own language review. A Sound is not a Content Item
 * and has no Revisions. A Language Reviewer approves its exact wording together with the recording
 * it is heard with, and the approval is recorded against a fingerprint of both, so any change
 * leaves the Sound a draft again until it is approved anew. Pure, so the staff screen and the
 * public page share one rule.
 */

export const SOUND_GROUPS = ["vowel", "consonant", "label"] as const;
export type SoundGroup = (typeof SOUND_GROUPS)[number];
export const SOUND_GROUP_NAMES: Record<SoundGroup, string> = {
  vowel: "Vowel",
  consonant: "Consonant",
  label: "Recording label",
};
export const isSoundGroup = (value: string): value is SoundGroup => (SOUND_GROUPS as readonly string[]).includes(value);

/** What a Language Reviewer approves: the wording, and the recording it is heard with. */
export type SoundWording = {
  letter: string;
  display: string;
  group: SoundGroup;
  ipa: string;
  englishComparison: string;
  note: string;
  /** The recording's media file ID, or the preview's file path while it has none of its own. */
  recording: string;
};

/**
 * A SHA-256 of the wording and recording, so an approval names exactly what was approved. The
 * parts are length-prefixed, so no way of splitting the text can give two Sounds the same input.
 */
export async function soundFingerprint(wording: SoundWording): Promise<string> {
  const parts = [
    wording.letter,
    wording.display,
    wording.group,
    wording.ipa,
    wording.englishComparison,
    wording.note,
    wording.recording,
  ];
  const text = parts.map((part) => `${part.length}:${part}`).join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** What the rules need to know about a Language Reviewer's approval of a Sound. */
export type SoundApprovalFacts = {
  fingerprint: string;
  reviewerEmail: string;
  variety: string;
  createdAt: Date;
};

export type SoundReview =
  | { state: "reviewed"; by: string; variety: string; at: Date }
  | { state: "draft"; by: null; variety: null; at: null };

/**
 * A Sound is reviewed only while an approval matches its wording as it stands now (the newest such
 * approval is the one shown). Approvals of wording since changed never count.
 */
export function soundReview(currentFingerprint: string, approvals: SoundApprovalFacts[]): SoundReview {
  const match = approvals
    .filter((approval) => approval.fingerprint === currentFingerprint)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .at(-1);
  return match
    ? { state: "reviewed", by: match.reviewerEmail, variety: match.variety, at: match.createdAt }
    : { state: "draft", by: null, variety: null, at: null };
}

/**
 * What the public page says about a Sound's review. A reviewed Sound uses the Review Label's own
 * words ("Language reviewed · Fijian · 1 Oct 2026"), so the help beside the labels explains it.
 */
export function soundLabel(review: SoundReview, languageName: string): string {
  return review.state === "reviewed"
    ? ["Language reviewed", languageName, formatDay(review.at.toISOString().slice(0, 10))].join(" · ")
    : "Not reviewed yet";
}

/** The fields staff may change, as typed, checked and trimmed; or the first thing wrong. */
export type SoundInput = { ipa: string; englishComparison: string; note: string };

export const SOUND_LIMITS = { ipa: 40, englishComparison: 200, note: 600 } as const;

export function checkSoundInput(input: SoundInput): { ok: true; value: SoundInput } | { ok: false; error: string } {
  const value = {
    ipa: input.ipa.trim(),
    englishComparison: input.englishComparison.trim(),
    note: input.note.trim(),
  };
  if (value.ipa.length > SOUND_LIMITS.ipa) return { ok: false, error: "The IPA is too long." };
  if (value.englishComparison.length > SOUND_LIMITS.englishComparison)
    return { ok: false, error: "The English comparison is too long." };
  if (!value.note) return { ok: false, error: "Add a short note on how the sound is made." };
  if (value.note.length > SOUND_LIMITS.note) return { ok: false, error: "The note is too long." };
  return { ok: true, value };
}

/** A recording's length as the page shows it: "4.5s". */
export const formatSeconds = (durationMs: number | null) => (durationMs ? `${(durationMs / 1000).toFixed(1)}s` : null);
