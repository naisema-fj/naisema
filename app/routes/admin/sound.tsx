import { data, Form, redirect } from "react-router";
import { WhatsThis } from "~/components/whats-this";
import { cloudflareContext } from "~/lib/cloudflare";
import { Refused } from "~/lib/content.server";
import { getDb } from "~/lib/db.server";
import { listMedia } from "~/lib/media.server";
import { formatDay } from "~/lib/rights-rules";
import { can } from "~/lib/roles";
import { formatSeconds, SOUND_GROUP_NAMES, SOUND_LIMITS } from "~/lib/sound-rules";
import { approveSound, loadSound, mayUseSounds, saveSound } from "~/lib/sounds.server";
import { requireStaff } from "~/lib/staff.server";
import type { Route } from "./+types/sound";

/**
 * /admin/sounds/:id: one sound. An editor changes its wording or its recording; a Language
 * Reviewer who has listened approves it as it stands (change note 0003).
 */
/** Signed in, and an editor or a Language Reviewer. */
async function requireSoundStaff(env: Env, request: Request) {
  const actor = await requireStaff(env, request);
  if (!mayUseSounds(actor)) throw new Response("Your roles don't allow this page.", { status: 403 });
  return actor;
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireSoundStaff(env, request);
  const db = getDb(env.DB);
  const found = await loadSound(db, params.id);
  if (!found) throw new Response("Not found", { status: 404 });
  const { row, review } = found;
  return {
    id: row.id,
    display: row.display,
    group: SOUND_GROUP_NAMES[row.group],
    ipa: row.ipa,
    englishComparison: row.englishComparison,
    note: row.note,
    origin: row.origin,
    seconds: formatSeconds(row.durationMs),
    mediaId: row.mediaId,
    previewAudio: row.previewAudio,
    recordingName: found.recording?.filename ?? null,
    recordingIsPublic: found.recordingIsPublic,
    fingerprint: found.fingerprint,
    reviewed: review.state === "reviewed",
    reviewedBy: review.state === "reviewed" ? `${review.by}, ${formatDay(review.at)}` : null,
    approvals: found.approvals.map((approval) => ({
      id: approval.id,
      by: approval.reviewerEmail,
      on: formatDay(approval.createdAt),
      notes: approval.notes,
      current: approval.fingerprint === found.fingerprint,
    })),
    audio: await listMedia(db, "audio").then((files) =>
      files.map((file) => ({ id: file.id, name: file.filename, seconds: formatSeconds(file.durationMs) })),
    ),
    mayEdit: can(actor, "content.edit"),
    mayApprove:
      can(actor, "review.language") &&
      actor.languageVariety === row.variety &&
      row.updatedBy.toLowerCase() !== actor.email.toLowerCase(),
    lastChangedBy: row.updatedBy,
    rights: can(actor, "rights.manage"),
  };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireSoundStaff(env, request);
  const db = getDb(env.DB);
  const form = await request.formData();
  const field = (name: string) => String(form.get(name) ?? "");
  try {
    if (field("intent") === "approve") {
      await approveSound(db, actor, params.id, {
        fingerprint: field("fingerprint"),
        listened: field("listened") === "on",
        notes: field("notes"),
      });
    } else {
      await saveSound(db, actor, params.id, {
        ipa: field("ipa"),
        englishComparison: field("englishComparison"),
        note: field("note"),
        mediaId: field("mediaId") || null,
      });
    }
  } catch (error) {
    if (error instanceof Refused) return data({ error: error.message }, { status: error.status });
    throw error;
  }
  return redirect(`/admin/sounds/${params.id}`);
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.display ?? "Sound"} · Sound guide · NAISEMA staff` }];
}

export default function Sound({ loaderData, actionData }: Route.ComponentProps) {
  const sound = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin/sounds">Back to the sound guide</a>
      </p>
      <h1>
        {sound.display} <span className="meta">{sound.group}</span>
      </h1>
      <p className="meta">
        {sound.reviewed
          ? `Reviewed by ${sound.reviewedBy}. Changing the wording or the recording makes it a draft again.`
          : "Draft: no Language Reviewer has approved it as it stands."}{" "}
        Last changed by {sound.lastChangedBy}.
      </p>
      {actionData?.error && (
        <p role="alert" className="error">
          {actionData.error}
        </p>
      )}

      <section aria-labelledby="recording-heading">
        <h2 id="recording-heading">Recording</h2>
        {sound.mediaId ? (
          <>
            <p>
              {sound.recordingName ?? "A file in the media library"}
              {sound.seconds ? `, ${sound.seconds}` : ""}.{" "}
              {sound.recordingIsPublic
                ? "Its Rights Record grants Publish, so it plays on the public page."
                : "It does not play publicly: no current Rights Record for it grants Publish."}{" "}
              {sound.rights && <a href={`/admin/rights/media/${sound.mediaId}`}>Rights Records</a>}
            </p>
            {/* biome-ignore lint/a11y/useMediaCaption: a single spoken letter has nothing to caption */}
            <audio controls preload="none" src={`/media/files/${sound.mediaId}`} />
          </>
        ) : sound.previewAudio ? (
          <>
            <p>
              Plays the preview's own file{sound.seconds ? ` (${sound.seconds})` : ""}, which has no Rights Record yet.
              {sound.origin ? ` Origin: ${sound.origin}.` : ""} Attach a library recording below.
            </p>
            {/* biome-ignore lint/a11y/useMediaCaption: a single spoken letter has nothing to caption */}
            <audio controls preload="none" src={`/apps/dictionary/pronunciation/${sound.previewAudio}`} />
          </>
        ) : (
          <p>No recording yet.</p>
        )}
      </section>

      {sound.mayEdit ? (
        <Form method="post" aria-labelledby="edit-heading">
          <h2 id="edit-heading">Wording and recording</h2>
          <p className="hint">Saving makes it a draft again, so a Language Reviewer approves what is now there.</p>
          <input type="hidden" name="intent" value="save" />
          <label htmlFor="ipa">Broad IPA, without the slashes (leave empty if none)</label>
          <input id="ipa" name="ipa" defaultValue={sound.ipa} maxLength={SOUND_LIMITS.ipa} lang="und-fonipa" />
          <label htmlFor="englishComparison">Closest English sound</label>
          <input
            id="englishComparison"
            name="englishComparison"
            defaultValue={sound.englishComparison}
            maxLength={SOUND_LIMITS.englishComparison}
          />
          <label htmlFor="note">How the sound is made</label>
          <textarea id="note" name="note" rows={3} defaultValue={sound.note} maxLength={SOUND_LIMITS.note} required />
          <label htmlFor="mediaId">Recording from the media library</label>
          <select id="mediaId" name="mediaId" defaultValue={sound.mediaId ?? ""}>
            <option value="">{sound.previewAudio ? "The preview's own file" : "None"}</option>
            {sound.audio.map((file) => (
              <option key={file.id} value={file.id}>
                {file.name}
                {file.seconds ? ` (${file.seconds})` : ""}
              </option>
            ))}
          </select>
          <p className="hint">
            Not listed? <a href="/admin/media">Upload it to the media library</a> first, then add its Rights Record,
            naming who spoke and what they permit.
          </p>
          <button type="submit">Save</button>
        </Form>
      ) : (
        <dl>
          <dt>Broad IPA</dt>
          <dd>{sound.ipa ? `/${sound.ipa}/` : "None"}</dd>
          <dt>Closest English sound</dt>
          <dd>{sound.englishComparison}</dd>
          <dt>How it is made</dt>
          <dd>{sound.note}</dd>
        </dl>
      )}

      <section aria-labelledby="review-heading">
        <h2 id="review-heading">Language review</h2>
        <WhatsThis summary="What a reviewer approves">
          <p>
            The wording and the recording it is heard with, exactly as shown. The IPA and the English comparison
            describe expected sounds, not this particular recording, so listen before approving. Any later change clears
            the approval.
          </p>
        </WhatsThis>
        {sound.approvals.length ? (
          <ul>
            {sound.approvals.map((approval) => (
              <li key={approval.id}>
                {approval.by}, {approval.on}:{" "}
                {approval.current ? "matches what is shown now" : "approved earlier wording, no longer counts"}
                {approval.notes && <span className="meta"> ({approval.notes})</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p>No approvals yet.</p>
        )}
        {sound.mayApprove && !sound.reviewed && (
          <Form method="post" className="review-form">
            <input type="hidden" name="intent" value="approve" />
            <input type="hidden" name="fingerprint" value={sound.fingerprint} />
            <label className="checkbox">
              <input type="checkbox" name="listened" required /> I have listened to this recording and checked the
              wording against it
            </label>
            <label htmlFor="notes">Notes (optional)</label>
            <textarea id="notes" name="notes" rows={2} maxLength={2000} />
            <button type="submit">Approve this sound</button>
          </Form>
        )}
      </section>
    </main>
  );
}
