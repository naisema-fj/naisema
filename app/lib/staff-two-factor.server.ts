import { eq, isNull } from "drizzle-orm";
import { roleAssignment, session as sessionTable, staffSession, twoFactor, user } from "~db/schema";
import { auditInsert } from "./audit.server";
import type { Database } from "./db.server";
import { sendEmail } from "./email.server";
import { type Actor, can } from "./permissions";

/** The administrator doing a reset: their session has passed the staff gate. */
type ResetBy = { db: Database; actor: Actor; user: { email: string } };

export type TwoFactorResetResult = { ok: true } | { ok: false; error: string };

/**
 * Resets a staff member's two-factor after they lose their authenticator app: removes the
 * enrolled key and ends every session, so their next sign-in goes through setup again. Audited,
 * and the person is emailed in case they didn't ask for it. `pnpm staff:reset-two-factor`
 * (scripts/reset-staff-two-factor.mjs) clears the same rows; change both together.
 */
export async function resetTwoFactor(env: Env, resetBy: ResetBy, userId: string): Promise<TwoFactorResetResult> {
  const { db, actor } = resetBy;
  if (!can(actor, { action: "twoFactor.reset", staffMember: { userId } })) {
    const error = userId === actor.userId ? "You can't reset your own two-factor." : "Only administrators can do that.";
    return { ok: false, error };
  }
  const member = await db.select().from(user).where(eq(user.id, userId)).get();
  if (!member?.twoFactorEnabled) return { ok: false, error: "That staff member hasn't set up two-factor." };

  await db.batch([
    db.delete(twoFactor).where(eq(twoFactor.userId, userId)),
    db.update(user).set({ twoFactorEnabled: false, updatedAt: new Date() }).where(eq(user.id, userId)),
    db.delete(staffSession).where(eq(staffSession.userId, userId)),
    db.delete(sessionTable).where(eq(sessionTable.userId, userId)),
    auditInsert(db, { actorId: actor.userId, action: "two_factor.reset", objectType: "user", objectId: userId }),
  ]);

  await sendEmail(env, {
    to: member.email,
    subject: "Your NAISEMA two-factor was reset",
    text: [
      `An administrator (${resetBy.user.email}) reset the two-factor on your NAISEMA staff account.`,
      "",
      "Next time you sign in to NAISEMA staff tools, you'll set up your authenticator app again.",
      "",
      "If you didn't ask for this, tell another administrator or the technical owner straight away.",
    ].join("\n"),
  });
  return { ok: true };
}

/** Everyone holding an active role, with whether this actor may reset their two-factor. */
export async function listTwoFactorStatus(db: Database, actor: Actor) {
  const members = await db
    .selectDistinct({ userId: user.id, email: user.email, twoFactorEnabled: user.twoFactorEnabled })
    .from(user)
    .innerJoin(roleAssignment, eq(roleAssignment.userId, user.id))
    .where(isNull(roleAssignment.revokedAt))
    .orderBy(user.email);
  return members.map(({ userId, email, twoFactorEnabled }) => {
    const enrolled = Boolean(twoFactorEnabled);
    return {
      userId,
      email,
      enrolled,
      canReset: enrolled && can(actor, { action: "twoFactor.reset", staffMember: { userId } }),
    };
  });
}
