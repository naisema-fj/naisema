import { eq, isNull } from "drizzle-orm";
import { roleAssignment, session, staffSession, twoFactor, user } from "~db/schema";
import { recordAudit } from "./audit.server";
import type { Database } from "./db.server";
import { sendEmail } from "./email.server";
import { type Actor, can } from "./permissions";

export type ResetResult = { ok: true } | { ok: false; error: string };

/**
 * Resets a staff member's two-factor after they lose their authenticator app: removes the
 * enrolled key and ends every session, so their next sign-in goes through setup again. Audited,
 * and the person is emailed in case they didn't ask for it.
 */
export async function resetTwoFactor(env: Env, db: Database, actor: Actor, userId: string): Promise<ResetResult> {
  if (!can(actor, { action: "twoFactor.reset", staffMember: { userId } })) {
    return { ok: false, error: "You can't reset your own two-factor." };
  }
  const member = await db.select().from(user).where(eq(user.id, userId)).get();
  if (!member?.twoFactorEnabled) return { ok: false, error: "That staff member hasn't set up two-factor." };

  await db.batch([
    db.delete(twoFactor).where(eq(twoFactor.userId, userId)),
    db.update(user).set({ twoFactorEnabled: false, updatedAt: new Date() }).where(eq(user.id, userId)),
    db.delete(staffSession).where(eq(staffSession.userId, userId)),
    db.delete(session).where(eq(session.userId, userId)),
  ]);
  await recordAudit(db, { actorId: actor.userId, action: "two_factor.reset", objectType: "user", objectId: userId });

  const administrator = await db.select({ email: user.email }).from(user).where(eq(user.id, actor.userId)).get();
  await sendEmail(env, {
    to: member.email,
    subject: "Your Na iSema two-factor was reset",
    text: [
      `An administrator (${administrator?.email}) reset the two-factor on your Na iSema staff account.`,
      "",
      "Next time you sign in to Na iSema staff tools, you'll set up your authenticator app again.",
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
  return members.map((member) => ({
    ...member,
    twoFactorEnabled: Boolean(member.twoFactorEnabled),
    canReset:
      Boolean(member.twoFactorEnabled) &&
      can(actor, { action: "twoFactor.reset", staffMember: { userId: member.userId } }),
  }));
}
