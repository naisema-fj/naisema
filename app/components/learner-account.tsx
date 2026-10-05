import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import type { EventFields } from "~/lib/learner-progress";
import { LEARNER_PATHS } from "~/lib/learner-progress";
import { progressQueue, type QueueStatus } from "~/lib/progress-queue.client";

/**
 * A signed-in learner's side of the player (#33): sending each change through the progress queue,
 * and saying honestly whether it has reached their account (VTECH-05). Nothing is called saved
 * until the server has acknowledged it.
 */

const IDLE: QueueStatus = { waiting: 0, sending: false, retrying: false, signedOut: false };

/** The queue's status for a signed-in learner, and a way to send changes; for a visitor, nothing. */
export function useProgressQueue(userId: string | null) {
  const [status, setStatus] = useState<QueueStatus>(IDLE);
  useEffect(() => (userId ? progressQueue(userId).subscribe(setStatus) : undefined), [userId]);
  const record = useCallback(
    (event: EventFields) => {
      if (userId) progressQueue(userId).add(event);
    },
    [userId],
  );
  return { status, record };
}

const changes = (count: number) => `${count} ${count === 1 ? "change" : "changes"}`;

/** Where the learner's changes are: saved, being sent, or waiting, and why. */
export function SaveStatus({ status }: { status: QueueStatus }) {
  let text: string;
  if (status.signedOut) {
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
      <p role="status" data-saved={!status.waiting && !status.signedOut ? "true" : undefined}>
        {text}
      </p>
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

/** A save button: pressed while saved. */
export function SaveToggle({
  saved,
  onChange,
  children,
}: {
  saved: boolean;
  onChange: (saved: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="save-toggle" aria-pressed={saved} onClick={() => onChange(!saved)}>
      {children}
    </button>
  );
}
