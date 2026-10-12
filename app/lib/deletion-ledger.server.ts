/**
 * The deletion ledger (ADR-0009): a record of who and what was deleted, so a restored backup
 * deletes them again. It lives in its own private R2 bucket (LEDGER), apart from the database it
 * governs, so restoring the database can't roll it back, and is never expired.
 *
 * One small object per entry, created only if it doesn't exist yet, and never overwritten or
 * deleted by the app (the runbook also locks the bucket). Learner entries are named by a SHA-256
 * hash of the user ID, so the ledger holds nothing that identifies the person who asked to be
 * forgotten. Object entries name a record by type and ID; those IDs are random, not personal.
 *
 * Replaying the ledger is app/lib/restore.server.ts.
 */

export const LEARNER_PREFIX = "learner/";
export const OBJECT_PREFIX = "object/";

/** Why a deletion was recorded. `learner.deleted`: they asked. `learner.inactive`: unused for two years. */
export type LedgerReason = "learner.deleted" | "learner.inactive" | "object.deleted";

type Entry = { reason: LedgerReason; deletedAt: string };

const HASH = /^[0-9a-f]{64}$/;
const OBJECT_TYPE = /^[a-z_]{1,40}$/;
const OBJECT_ID = /^[A-Za-z0-9_-]{1,80}$/;

async function addOnce(ledger: R2Bucket, key: string, entry: Entry) {
  // Null when the entry is already there, which is fine: it says the same thing.
  await ledger.put(key, JSON.stringify(entry), { onlyIf: { etagDoesNotMatch: "*" } });
}

/** Records that a Learner Account was deleted. Throws if it can't be recorded, so nothing is deleted unrecorded. */
export async function recordLearnerDeletion(
  ledger: R2Bucket,
  subjectHash: string,
  reason: "learner.deleted" | "learner.inactive",
  at: Date,
) {
  if (!HASH.test(subjectHash)) throw new Error("A ledger entry needs a SHA-256 hash.");
  await addOnce(ledger, `${LEARNER_PREFIX}${subjectHash}`, { reason, deletedAt: at.toISOString() });
}

/** Records that a record (by its type, such as `consent_record`, and ID) was deleted. */
export async function recordObjectDeletion(ledger: R2Bucket, type: string, id: string, at: Date) {
  if (!OBJECT_TYPE.test(type) || !OBJECT_ID.test(id)) throw new Error("A ledger entry needs a table name and an ID.");
  await addOnce(ledger, `${OBJECT_PREFIX}${type}/${id}`, { reason: "object.deleted", deletedAt: at.toISOString() });
}

async function keysUnder(ledger: R2Bucket, prefix: string) {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await ledger.list({ prefix, cursor });
    keys.push(...page.objects.map((object) => object.key.slice(prefix.length)));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return keys;
}

/** Everything the ledger holds. Entries that don't look like entries are ignored. */
export async function readLedger(ledger: R2Bucket) {
  const learners = new Set((await keysUnder(ledger, LEARNER_PREFIX)).filter((hash) => HASH.test(hash)));
  const objects = (await keysUnder(ledger, OBJECT_PREFIX)).flatMap((rest) => {
    const [type, id, ...extra] = rest.split("/");
    return extra.length === 0 && OBJECT_TYPE.test(type) && OBJECT_ID.test(id ?? "") ? [{ type, id }] : [];
  });
  return { learners, objects };
}
