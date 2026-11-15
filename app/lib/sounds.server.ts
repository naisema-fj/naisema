import { asc, eq } from "drizzle-orm";
import { media, sound, soundApproval } from "~db/schema";
import { audit } from "./audit.server";
import { Refused } from "./content.server";
import type { Database } from "./db.server";
import { languageName } from "./language-variety";
import { publicMediaIds } from "./media.server";
import { can, type Staff } from "./roles";
import {
  checkSoundInput,
  formatSeconds,
  SOUND_GROUP_NAMES,
  type SoundApprovalFacts,
  type SoundInput,
  type SoundWording,
  soundFingerprint,
  soundLabel,
  soundReview,
} from "./sound-rules";

/**
 * The sound guide (change note 0003): Sounds, their recordings and their language review. Staff
 * edit and attach recordings; a Language Reviewer approves a Sound's exact wording and recording,
 * and any later change leaves it a draft again. Whether a recording plays publicly is decided on
 * every request from its own Rights Record, like any media file (app/lib/media.server.ts).
 */

export const SOUND_VARIETY = "standard-fijian";
/** Where the preview's own recordings are served from until a library recording is attached. */
export const PREVIEW_AUDIO_ROOT = "/apps/dictionary/pronunciation/";

export type SoundRow = typeof sound.$inferSelect;

/** Editors change the sound guide and Language Reviewers approve it; either may open its screens. */
export const mayUseSounds = (person: Pick<Staff, "roles">) =>
  can(person, "content.edit") || can(person, "review.language");

/** The recording a Sound is heard with: its library file, or the preview's own file until it has one. */
export const wordingOf = (row: SoundRow): SoundWording => ({
  letter: row.letter,
  display: row.display,
  group: row.group,
  ipa: row.ipa,
  englishComparison: row.englishComparison,
  note: row.note,
  recording: row.mediaId ?? row.previewAudio ?? "",
});

/** Every Sound of a variety in the guide's order, each with its review as it stands now. */
export async function loadSounds(db: Database, variety = SOUND_VARIETY) {
  const [rows, approvals] = await Promise.all([
    db.select().from(sound).where(eq(sound.variety, variety)).orderBy(asc(sound.position)),
    db.select().from(soundApproval),
  ]);
  const byId = new Map<string, SoundApprovalFacts[]>();
  for (const approval of approvals) byId.set(approval.soundId, [...(byId.get(approval.soundId) ?? []), approval]);
  return Promise.all(
    rows.map(async (row) => {
      const fingerprint = await soundFingerprint(wordingOf(row));
      return { row, fingerprint, review: soundReview(fingerprint, byId.get(row.id) ?? []) };
    }),
  );
}

/** One Sound with what staff need to review it: its fingerprint, review and every approval so far. */
export async function loadSound(db: Database, id: string) {
  const row = await db.query.sound.findFirst({ where: eq(sound.id, id) });
  if (!row) return null;
  const approvals = await db.select().from(soundApproval).where(eq(soundApproval.soundId, id));
  const fingerprint = await soundFingerprint(wordingOf(row));
  const recording = row.mediaId ? await db.query.media.findFirst({ where: eq(media.id, row.mediaId) }) : null;
  const isPublic = row.mediaId ? (await publicMediaIds(db, [row.mediaId])).has(row.mediaId) : false;
  return {
    row,
    fingerprint,
    review: soundReview(fingerprint, approvals),
    approvals: approvals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    recording,
    recordingIsPublic: isPublic,
  };
}

/**
 * Changes a Sound's wording or its recording. Any change clears its approval, because the approval
 * named the exact wording and recording that were approved.
 */
export async function saveSound(
  db: Database,
  actor: Staff,
  id: string,
  input: SoundInput & { mediaId: string | null },
) {
  if (!can(actor, "content.edit")) throw new Refused("Only editors change the sound guide.", 403);
  const found = await loadSound(db, id);
  if (!found) throw new Refused("That sound doesn't exist.", 404);
  const checked = checkSoundInput(input);
  if (!checked.ok) throw new Refused(checked.error);
  let durationMs = found.row.durationMs;
  const mediaId = input.mediaId || null;
  if (mediaId !== found.row.mediaId) {
    if (mediaId) {
      const file = await db.query.media.findFirst({ where: eq(media.id, mediaId) });
      if (file?.kind !== "audio") throw new Refused("Choose a recording from the media library's audio.");
      durationMs = file.durationMs ?? null;
    }
  }
  const next = { ...found.row, ...checked.value, mediaId, durationMs };
  const changed = (["ipa", "englishComparison", "note", "mediaId"] as const).filter(
    (field) => found.row[field] !== next[field],
  );
  if (!changed.length) return { changed };
  await db.batch([
    db
      .update(sound)
      .set({ ...checked.value, mediaId, durationMs, updatedBy: actor.email, updatedAt: new Date() })
      .where(eq(sound.id, id)),
    audit(
      db,
      actor.email,
      "sound.edited",
      { type: "sound", id },
      { changed, clearedReview: found.review.state === "reviewed" },
    ),
  ]);
  return { changed };
}

/**
 * A Language Reviewer approves a Sound as it stands, naming the fingerprint they were looking at,
 * so an edit made while they read can't be approved unseen. They say they listened to the
 * recording, because the IPA and the English comparison describe expected sounds, not this recording.
 */
export async function approveSound(
  db: Database,
  actor: Staff,
  id: string,
  input: { fingerprint: string; listened: boolean; notes: string },
) {
  if (!can(actor, "review.language")) throw new Refused("Only a Language Reviewer approves a sound.", 403);
  const found = await loadSound(db, id);
  if (!found) throw new Refused("That sound doesn't exist.", 404);
  if (actor.languageVariety !== found.row.variety) {
    throw new Refused(`Your staff record doesn't say you review ${languageName(found.row.variety)}.`, 403);
  }
  if (found.row.updatedBy.toLowerCase() === actor.email.toLowerCase()) {
    throw new Refused("You last changed this sound, so someone else has to review it.", 403);
  }
  if (!found.row.mediaId && !found.row.previewAudio) throw new Refused("This sound has no recording to listen to yet.");
  if (!input.listened) throw new Refused("Listen to the recording, then confirm that you did.");
  if (input.fingerprint !== found.fingerprint) {
    throw new Refused("This sound changed while you were reading it. Look at it again, then approve it.", 409);
  }
  if (found.review.state === "reviewed") return found.review;
  const approvalId = crypto.randomUUID();
  await db.batch([
    db.insert(soundApproval).values({
      id: approvalId,
      soundId: id,
      fingerprint: found.fingerprint,
      variety: found.row.variety,
      reviewerEmail: actor.email,
      notes: input.notes.trim().slice(0, 2000),
    }),
    audit(db, actor.email, "sound.approved", { type: "sound", id }, { approval: approvalId }),
  ]);
  return { state: "reviewed" as const };
}

export type RecordingState =
  /** Plays from a library file whose own Rights Record grants Publish. */
  | "library"
  /** Plays the preview's own file, until a library recording is attached. */
  | "preview"
  /** A library file is attached, but its rights don't allow it to play today. */
  | "withheld"
  /** Nothing to play yet. */
  | "none";

export type PublicSound = {
  id: string;
  letter: string;
  display: string;
  groupName: string;
  ipa: string;
  englishComparison: string;
  note: string;
  recording: RecordingState;
  /** The address to play, only when `recording` is "library" or "preview". */
  src: string | null;
  seconds: string | null;
  reviewed: boolean;
  /** What the page says about its review, in the Review Labels' words. */
  label: string;
};

/** The sound guide as visitors see it, each Sound's recording and review decided now. */
export async function publicSounds(db: Database, variety = SOUND_VARIETY): Promise<PublicSound[]> {
  const sounds = await loadSounds(db, variety);
  const allowed = await publicMediaIds(
    db,
    sounds.flatMap(({ row }) => (row.mediaId ? [row.mediaId] : [])),
  );
  const language = languageName(variety);
  return sounds.map(({ row, review }) => {
    const recording: RecordingState = row.mediaId
      ? allowed.has(row.mediaId)
        ? "library"
        : "withheld"
      : row.previewAudio
        ? "preview"
        : "none";
    return {
      id: row.id,
      letter: row.letter,
      display: row.display,
      groupName: SOUND_GROUP_NAMES[row.group],
      ipa: row.ipa,
      englishComparison: row.englishComparison,
      note: row.note,
      recording,
      src:
        recording === "library"
          ? `/media/files/${row.mediaId}`
          : recording === "preview"
            ? `${PREVIEW_AUDIO_ROOT}${row.previewAudio}`
            : null,
      seconds: formatSeconds(row.durationMs),
      reviewed: review.state === "reviewed",
      label: soundLabel(review, language),
    };
  });
}
