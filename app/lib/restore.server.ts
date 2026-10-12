import { eq } from "drizzle-orm";
import { consentRecord, learnerAccount } from "~db/schema";
import { auditInsert, recordAudit } from "./audit.server";
import type { Database } from "./db.server";
import { readLedger } from "./deletion-ledger.server";
import { deleteLearnerAgain, hasStaffRole, sha256Hex } from "./learner-records.server";
import { logError, logInfo } from "./log.server";

/**
 * Restoring a backup (ADR-0009, docs/handover/runbook.md, restoring): a restored database holds
 * people deleted since it was taken. Before the site serves anyone, every entry in the deletion
 * ledger is applied to it again. While a restore is under way the public site answers "back
 * shortly" (the restore lock), and an administrator reopens it from the staff restore page once
 * the replay has run. The daily job replays the ledger too, so a deletion that was recorded but
 * not carried out is finished.
 */

const LOCK_KEY = "state/restore-lock";
/**
 * How long a Worker remembers that the lock is off, so the check costs one R2 read in ten seconds.
 * A Worker never remembers that it is on: while the site is closed, every request looks again, so
 * reopening takes effect at once and a restore closes the site within ten seconds.
 */
const LOCK_CHECK_MS = 10_000;

let remembered: { at: number } | null = null;

/** Whether the site is closed for a restore. Fails open: if the ledger bucket can't be read, the site stays up. */
export async function restoreInProgress(env: Env, nowMs = Date.now()) {
  if (remembered && nowMs - remembered.at < LOCK_CHECK_MS) return false;
  try {
    const locked = (await env.LEDGER.head(LOCK_KEY)) !== null;
    remembered = locked ? null : { at: nowMs };
    return locked;
  } catch (error) {
    logError("Couldn't check for a restore in progress", { error });
    remembered = { at: nowMs };
    return false;
  }
}

/** Closes the public site for a restore. The runbook does this with wrangler first; this is the same thing. */
export async function lockForRestore(env: Env, now: Date) {
  await env.LEDGER.put(LOCK_KEY, JSON.stringify({ lockedAt: now.toISOString() }));
  remembered = null;
}

async function unlock(env: Env) {
  await env.LEDGER.delete(LOCK_KEY);
  remembered = null;
}

/** The records an object entry can delete again, by table. Add a table here before recording its deletions. */
const REPLAYABLE_OBJECTS = { consent_record: consentRecord } as const;

export type Replay = { learners: number; objects: number; unknown: string[] };

/**
 * Applies the whole deletion ledger to the database. Safe to run any number of times. Learner
 * entries are hashes, so each Learner Account is hashed and matched; a staff account is never
 * deleted. Entries for record types the replay doesn't know are returned, never skipped silently.
 */
export async function replayDeletionLedger(env: Env, db: Database): Promise<Replay> {
  const ledger = await readLedger(env.LEDGER);
  let learners = 0;
  if (ledger.learners.size > 0) {
    for (const { userId } of await db.select({ userId: learnerAccount.userId }).from(learnerAccount)) {
      const hash = await sha256Hex(userId);
      if (ledger.learners.has(hash) && !(await hasStaffRole(db, userId))) {
        await deleteLearnerAgain(db, userId, hash);
        learners++;
      }
    }
  }
  let objects = 0;
  const unknown: string[] = [];
  for (const { type, id } of ledger.objects) {
    const table = (REPLAYABLE_OBJECTS as Record<string, typeof consentRecord | undefined>)[type];
    if (!table) {
      unknown.push(`${type}/${id}`);
      continue;
    }
    if (!(await db.select({ id: table.id }).from(table).where(eq(table.id, id)).get())) continue;
    await db.batch([
      db.delete(table).where(eq(table.id, id)),
      auditInsert(db, { actorId: null, action: "restore.object_deleted", objectType: type, objectId: id }),
    ]);
    objects++;
  }
  logInfo("Deletion ledger replayed", { learners, objects, unknown: unknown.length });
  return { learners, objects, unknown };
}

/**
 * The staff restore page's button: replays the ledger, then reopens the site. The site stays
 * closed if any entry couldn't be applied.
 */
export async function finishRestore(env: Env, db: Database, actorId: string) {
  const replay = await replayDeletionLedger(env, db);
  if (replay.unknown.length === 0) await unlock(env);
  await recordAudit(db, {
    actorId,
    action: "restore.replayed",
    objectType: "deletion_ledger",
    details: { learners: replay.learners, objects: replay.objects, unknown: replay.unknown.length },
  });
  return { ...replay, reopened: replay.unknown.length === 0 };
}

/** What the staff restore page shows. */
export async function restoreStatus(env: Env) {
  const [locked, ledger] = await Promise.all([
    env.LEDGER.head(LOCK_KEY).then((found) => found !== null),
    readLedger(env.LEDGER),
  ]);
  return { locked, learnerEntries: ledger.learners.size, objectEntries: ledger.objects.length };
}
