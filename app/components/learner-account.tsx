import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { LEARNER_PATHS, type LearnerLayerState } from "~/lib/learner-progress";
import { accountStore, type LearnerStore, type StoreScope, sessionTab, tabStore } from "~/lib/learner-store";
import { IDLE_STATUS, type QueueStatus } from "~/lib/progress-queue";
import { progressQueue } from "~/lib/progress-queue.client";
import type { Segment } from "~/lib/segment-rules";

/**
 * A learner's side of the player (#33): the store it keeps their changes in (app/lib/learner-store.ts),
 * and, for a signed-in learner, saying honestly whether each change has reached their account
 * (VTECH-05). Nothing is called saved until the server has acknowledged it.
 */

/** The progress queue's status for a signed-in learner; for a visitor, nothing. */
export function useQueueStatus(userId: string | null) {
  const [status, setStatus] = useState<QueueStatus>(IDLE_STATUS);
  useEffect(() => (userId ? progressQueue(userId).subscribe(setStatus) : undefined), [userId]);
  return status;
}

/**
 * The player's store on a Learning Layer's published Revision: the account's for a signed-in
 * learner, the tab's for a visitor. Nothing is read or sent until it is used, after hydration.
 */
export function useLearnerStore(
  scope: StoreScope,
  learner: (LearnerLayerState & { userId: string }) | null,
  segments: Segment[],
): LearnerStore {
  const { layerId, revisionId, contentItemId } = scope;
  return useMemo(() => {
    const on = { layerId, revisionId, contentItemId };
    if (!learner) return tabStore(sessionTab, on);
    // The queue is the browser's (a .client module), so it is reached only once a change is made.
    const queue = () => progressQueue(learner.userId);
    return accountStore(
      { pending: () => queue().pending(), add: (event) => queue().add(event) },
      learner,
      on,
      segments,
    );
  }, [layerId, revisionId, contentItemId, learner, segments]);
}

const changes = (count: number) => `${count} ${count === 1 ? "change" : "changes"}`;

/** Whether everything the learner changed has been acknowledged and applied by the server. */
export const allSaved = (status: QueueStatus) => status.ready && !status.waiting && !status.signedOut;

/** Where the learner's changes are: saved, being sent, or waiting, and why. */
export function SaveStatus({ status }: { status: QueueStatus }) {
  let text: string;
  if (!status.ready) {
    text = "Checking for changes not yet saved on this device…";
  } else if (status.signedOut) {
    text = `You're signed out, so ${changes(status.waiting)} on this device can't be saved. Sign in again to save them.`;
  } else if (!status.waiting) {
    text = "Everything is saved to your account.";
  } else if (status.retrying) {
    text = `Not yet saved: ${changes(status.waiting)} waiting. They're kept on this device and will be sent when you're back online.`;
  } else {
    text = `Not yet saved: sending ${changes(status.waiting)}…`;
  }
  return (
    <div className="save-status">
      <p role="status" data-saved={allSaved(status) ? "true" : undefined}>
        {text}
      </p>
      {status.refused.length > 0 && (
        <p role="alert">
          {changes(status.refused.length)} couldn't be saved, because what{" "}
          {status.refused.length === 1 ? "it was" : "they were"} about is no longer available.
        </p>
      )}
      {status.signedOut && (
        <p>
          <Link to={LEARNER_PATHS.signIn} reloadDocument>
            Sign in again
          </Link>
        </p>
      )}
    </div>
  );
}

/**
 * A save button: pressed once chosen. Its words say "saved" only while nothing on this device is
 * waiting for the server: what the page was sent is saved, and a change made since is "saving"
 * until the server has acknowledged it.
 */
export function SaveToggle({
  saved,
  status,
  onChange,
  label,
  name,
}: {
  saved: boolean;
  status: QueueStatus;
  onChange: (saved: boolean) => void;
  /** What it says: before saving, while saving, and once saved. */
  label: { save: string; saving: string; saved: string };
  /** What is saved, for screen readers, after the words. */
  name?: string;
}) {
  const waiting = status.ready && (status.waiting > 0 || status.signedOut);
  const words = !saved ? label.save : waiting ? label.saving : label.saved;
  return (
    <button type="button" className="save-toggle" aria-pressed={saved} onClick={() => onChange(!saved)}>
      {words}
      {name && <span className="visually-hidden"> {name}</span>}
    </button>
  );
}
