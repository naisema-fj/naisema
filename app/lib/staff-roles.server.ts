import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { roleAssignment, user } from "~db/schema";
import { recordAudit } from "./audit.server";
import type { Database } from "./db.server";
import { toLanguageVariety } from "./language-variety";
import { REVIEW_TYPES, type ReviewType, type RoleAssignment, STAFF_ROLES, type StaffRole } from "./permissions";

export type GrantRequest = RoleAssignment & { email: string };

/** Reads a role_assignment row as the domain's RoleAssignment. */
export function toRoleAssignment(row: {
  role: string;
  reviewType: string | null;
  languageVariety: string | null;
}): RoleAssignment {
  return {
    role: row.role as StaffRole,
    ...(row.reviewType ? { reviewType: row.reviewType as ReviewType } : {}),
    ...(row.languageVariety ? { languageVariety: row.languageVariety } : {}),
  };
}

export type GrantValidation = { ok: true; grant: GrantRequest } | { ok: false; error: string };

/** Checks a grant form: reviewers need a Review Type, and language reviewers a Language Variety. */
export function validateGrant(form: FormData): GrantValidation {
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = String(form.get("role") ?? "");
  const reviewType = String(form.get("reviewType") ?? "");
  const languageVariety = toLanguageVariety(String(form.get("languageVariety") ?? ""));

  if (!email.includes("@")) return { ok: false, error: "Enter the staff member's email address." };
  if (!(STAFF_ROLES as readonly string[]).includes(role)) return { ok: false, error: "Choose a role." };
  if (role !== "reviewer") return { ok: true, grant: { email, role: role as StaffRole } };

  if (!(REVIEW_TYPES as readonly string[]).includes(reviewType)) {
    return { ok: false, error: "Choose the Review Type this reviewer may approve." };
  }
  if (reviewType === "language" && !languageVariety) {
    return {
      ok: false,
      error: "Language reviewers need the Language Variety they may approve, in letters, digits and hyphens.",
    };
  }
  return {
    ok: true,
    grant: {
      email,
      role: "reviewer",
      reviewType: reviewType as ReviewType,
      ...(reviewType === "language" && languageVariety ? { languageVariety } : {}),
    },
  };
}

/** Grants a role, creating the staff member's account if needed. Audited as the administrator. */
export async function grantRole(db: Database, grantedBy: string, grant: GrantRequest) {
  const now = new Date();
  let member = await db.select({ id: user.id }).from(user).where(eq(user.email, grant.email)).get();
  if (!member) {
    member = { id: crypto.randomUUID() };
    await db.insert(user).values({ id: member.id, email: grant.email, name: grant.email.split("@")[0] });
    await recordAudit(db, { actorId: grantedBy, action: "user.created", objectType: "user", objectId: member.id });
  }
  const assignmentId = crypto.randomUUID();
  await db.insert(roleAssignment).values({
    id: assignmentId,
    userId: member.id,
    role: grant.role,
    reviewType: grant.reviewType ?? null,
    languageVariety: grant.languageVariety ?? null,
    grantedBy,
    grantedAt: now,
  });
  await recordAudit(db, {
    actorId: grantedBy,
    action: "role.granted",
    objectType: "role_assignment",
    objectId: assignmentId,
    details: {
      userId: member.id,
      role: grant.role,
      reviewType: grant.reviewType,
      languageVariety: grant.languageVariety,
    },
  });
}

export type RevokeResult = { ok: true } | { ok: false; error: string };

/** Revokes an active role assignment. The last active administrator can never be revoked. */
export async function revokeRole(db: Database, revokedBy: string, assignmentId: string): Promise<RevokeResult> {
  const assignment = await db
    .select()
    .from(roleAssignment)
    .where(and(eq(roleAssignment.id, assignmentId), isNull(roleAssignment.revokedAt)))
    .get();
  if (!assignment) return { ok: false, error: "That role has already been revoked." };

  if (assignment.role === "administrator") {
    const others = await db
      .select({ count: sql<number>`count(*)` })
      .from(roleAssignment)
      .where(
        and(
          eq(roleAssignment.role, "administrator"),
          isNull(roleAssignment.revokedAt),
          ne(roleAssignment.id, assignmentId),
        ),
      )
      .get();
    if (!others?.count) return { ok: false, error: "At least one administrator must remain." };
  }

  await db.update(roleAssignment).set({ revokedAt: new Date(), revokedBy }).where(eq(roleAssignment.id, assignmentId));
  await recordAudit(db, {
    actorId: revokedBy,
    action: "role.revoked",
    objectType: "role_assignment",
    objectId: assignmentId,
    details: { userId: assignment.userId, role: assignment.role },
  });
  return { ok: true };
}

export async function listStaff(db: Database) {
  const rows = await db
    .select({
      assignmentId: roleAssignment.id,
      email: user.email,
      role: roleAssignment.role,
      reviewType: roleAssignment.reviewType,
      languageVariety: roleAssignment.languageVariety,
    })
    .from(roleAssignment)
    .innerJoin(user, eq(user.id, roleAssignment.userId))
    .where(isNull(roleAssignment.revokedAt))
    .orderBy(user.email, roleAssignment.role);
  return rows.map((row) => ({
    assignmentId: row.assignmentId,
    email: row.email,
    assignment: toRoleAssignment(row),
  }));
}

/** Everyone who currently holds a role, for sending them staff email. */
export async function activeHolders(db: Database, role: StaffRole) {
  return db
    .selectDistinct({ id: user.id, email: user.email })
    .from(roleAssignment)
    .innerJoin(user, eq(user.id, roleAssignment.userId))
    .where(and(eq(roleAssignment.role, role), isNull(roleAssignment.revokedAt)));
}
