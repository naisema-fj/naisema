import { and, eq, like, lt, sql } from "drizzle-orm";
import {
  activityAttempt,
  bookmark,
  deletionLedger,
  learnerAccount,
  learnerEvent,
  learnerSignInLink,
  learnerVideoState,
  roleAssignment,
  savedVocabulary,
  session as sessionTable,
  user as userTable,
  verification,
} from "~db/schema";
import { auditInsert } from "./audit.server";
import type { Database } from "./db.server";
import { letterText, sendEmail } from "./email.server";
import { INACTIVE_DAYS, INACTIVITY_WARNING_DAYS, inactivityStep, LEARNER_PATHS } from "./learner-progress";
import { logError } from "./log.server";
import { primaryPublicOrigin } from "./public-cache.server";

/**
 * What happens to a Learner Account's records over its life (#33, docs/decision-log.md, learner
 * data): clearing history, deleting the account with a deletion ledger entry (ADR-0009), and the
 * daily job that warns and deletes inactive accounts. Signing in and the learner gate are in
 * app/lib/learners.server.ts; it shares `hasStaffRole` from here, since deleting must never reach a
 * staff account either.
 */

export const sha256Hex = async (value: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

/** Whether a user has, or ever had, a staff role; such a user never holds a Learner Account. */
export async function hasStaffRole(db: Database, userId: string) {
  return Boolean(
    await db.select({ id: roleAssignment.id }).from(roleAssignment).where(eq(roleAssignment.userId, userId)).get(),
  );
}

/** A learner's history: where they are in each Learning Layer, their answers, and the events applied. */
const historyDeletes = (db: Database, userId: string) =>
  [
    db.delete(learnerVideoState).where(eq(learnerVideoState.userId, userId)),
    db.delete(activityAttempt).where(eq(activityAttempt.userId, userId)),
    db.delete(learnerEvent).where(eq(learnerEvent.userId, userId)),
  ] as const;

/** Clears a learner's history at once. Their saved videos and words stay. */
export async function clearHistory(db: Database, userId: string) {
  await db.batch([...historyDeletes(db, userId)]);
}

const DELETION_REASONS = {
  "learner.deleted": "Deleted by the learner",
  "learner.inactive": "Unused for two years",
} as const;

/**
 * Deletes a Learner Account and everything it holds, at once, and adds it to the deletion ledger so
 * a restored backup deletes it again (ADR-0009). Backups older than this keep it for at most 35
 * days. Only ever called for a Learner Account, never a staff account.
 */
export async function deleteLearnerAccount(
  db: Database,
  userId: string,
  reason: "learner.deleted" | "learner.inactive",
) {
  const deletedAt = new Date();
  const subjectHash = await sha256Hex(userId);
  const person = await db.select({ email: userTable.email }).from(userTable).where(eq(userTable.id, userId)).get();
  await db.batch([
    db.insert(deletionLedger).values({ subjectHash, reason, deletedAt }),
    // Audited by the ledger's hash: the audit log outlives the account and must not name it (CMS-05).
    auditInsert(db, {
      actorId: null,
      action: "learner_account.deleted",
      objectType: "learner_account",
      objectId: subjectHash,
      details: { reason: DELETION_REASONS[reason] },
    }),
    ...historyDeletes(db, userId),
    // Sign-in links not yet used, which name the address.
    db
      .delete(verification)
      .where(
        and(
          like(verification.identifier, "learner:%"),
          sql`json_valid(${verification.value}) AND json_extract(${verification.value}, '$.email') = ${person?.email ?? ""}`,
        ),
      ),
    db.delete(bookmark).where(eq(bookmark.userId, userId)),
    db.delete(savedVocabulary).where(eq(savedVocabulary.userId, userId)),
    db.delete(sessionTable).where(eq(sessionTable.userId, userId)),
    db.delete(learnerAccount).where(eq(learnerAccount.userId, userId)),
    db.delete(userTable).where(eq(userTable.id, userId)),
  ]);
}

/** Forgets event IDs and sign-in link counts kept longer than any retry or throttle needs them. */
export async function tidyLearnerRecords(db: Database, now: Date) {
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);
  await db.batch([
    db.delete(learnerEvent).where(lt(learnerEvent.receivedAt, monthAgo)),
    db.delete(learnerSignInLink).where(lt(learnerSignInLink.sentAt, new Date(now.getTime() - 86_400_000))),
  ]);
}

/**
 * The daily learner-accounts job's part for inactive Learner Accounts: a warning email 30 days before 24 months
 * without activity, then deletion 30 days later unless the account was used since
 * (app/lib/learner-progress.ts). Each account is handled on its own, so one failed email doesn't
 * stop the rest; a failure is thrown at the end, so the job shows as failed.
 */
export async function handleInactiveLearners(env: Env, db: Database, now: Date) {
  const idleSince = new Date(now.getTime() - (INACTIVE_DAYS - INACTIVITY_WARNING_DAYS) * 86_400_000);
  const accounts = await db
    .select({
      userId: learnerAccount.userId,
      email: userTable.email,
      lastActiveAt: learnerAccount.lastActiveAt,
      inactivityWarnedAt: learnerAccount.inactivityWarnedAt,
    })
    .from(learnerAccount)
    .innerJoin(userTable, eq(userTable.id, learnerAccount.userId))
    .where(lt(learnerAccount.lastActiveAt, idleSince));
  const failed: unknown[] = [];
  for (const account of accounts) {
    try {
      const step = inactivityStep(account, now);
      if (step === "delete") {
        if (!(await hasStaffRole(db, account.userId)))
          await deleteLearnerAccount(db, account.userId, "learner.inactive");
      } else if (step === "warn") {
        await sendEmail(env, {
          to: account.email,
          subject: "Your NAISEMA learning account will be deleted",
          text: letterText("", [
            "You haven't used your NAISEMA learning account for nearly two years. We don't keep accounts nobody uses, so in 30 days it will be deleted, with everything saved in it.",
            `To keep it, sign in at ${primaryPublicOrigin(env)}${LEARNER_PATHS.signIn} before then. To keep a copy of what you saved, download it from your learning page first.`,
            "If you're happy for it to go, you don't need to do anything.",
          ]),
        });
        await db
          .update(learnerAccount)
          .set({ inactivityWarnedAt: now })
          .where(eq(learnerAccount.userId, account.userId));
      }
    } catch (error) {
      logError("Inactive learner account not handled", { error });
      failed.push(error);
    }
  }
  if (failed.length) throw new AggregateError(failed, "Some inactive learner accounts weren't handled");
}
