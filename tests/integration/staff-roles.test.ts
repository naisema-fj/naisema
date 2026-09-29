import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { auditActions, signedInStaff } from "./support/staff";

async function activeRoles(email: string) {
  const { results } = await env.DB.prepare(
    `SELECT r.role, r.review_type AS reviewType, r.language_variety AS languageVariety
       FROM role_assignment r JOIN user u ON u.id = r.user_id
      WHERE u.email = ?1 AND r.revoked_at IS NULL ORDER BY r.role`,
  )
    .bind(email)
    .all();
  return results;
}

describe("staff management", () => {
  it("lets an administrator add a staff member with a role, and audits it", async () => {
    const admin = await signedInStaff("admin1@naisema.test", [{ role: "administrator" }]);

    const response = await admin.browser.fetch("/admin/staff", {
      form: { intent: "grant", email: "New.Editor@naisema.test", role: "editor" },
    });

    expect(response.status).toBe(302);
    expect(await activeRoles("new.editor@naisema.test")).toEqual([
      { role: "editor", reviewType: null, languageVariety: null },
    ]);
    expect(await auditActions(admin.userId)).toContain("role.granted");
    const page = await (await admin.browser.fetch("/admin/staff")).text();
    expect(page).toContain("new.editor@naisema.test");
  });

  it("scopes a language reviewer to a review type and language variety", async () => {
    const admin = await signedInStaff("admin2@naisema.test", [{ role: "administrator" }]);

    const missingScope = await admin.browser.fetch("/admin/staff", {
      form: { intent: "grant", email: "reviewer@naisema.test", role: "reviewer", reviewType: "language" },
    });
    await admin.browser.fetch("/admin/staff", {
      form: {
        intent: "grant",
        email: "reviewer@naisema.test",
        role: "reviewer",
        reviewType: "language",
        languageVariety: "standard-fijian",
      },
    });

    expect(missingScope.status).toBe(400);
    expect(await activeRoles("reviewer@naisema.test")).toEqual([
      { role: "reviewer", reviewType: "language", languageVariety: "standard-fijian" },
    ]);
  });

  it("revokes a role so it stops working on the staff member's next request", async () => {
    const admin = await signedInStaff("admin3@naisema.test", [{ role: "administrator" }]);
    const editor = await signedInStaff("leaving-editor@naisema.test", [{ role: "editor" }]);
    const { results } = await env.DB.prepare("SELECT id FROM role_assignment WHERE user_id = ?1")
      .bind(editor.userId)
      .all<{ id: string }>();

    await admin.browser.fetch("/admin/staff", { form: { intent: "revoke", assignmentId: results[0].id } });

    expect(await activeRoles("leaving-editor@naisema.test")).toEqual([]);
    expect((await editor.browser.fetch("/admin")).status).toBe(403);
    expect(await auditActions(admin.userId)).toContain("role.revoked");
  });

  it("will not revoke the last administrator", async () => {
    const admin = await signedInStaff("only-admin@naisema.test", [{ role: "administrator" }]);
    await env.DB.prepare("UPDATE role_assignment SET revoked_at = 1 WHERE role = 'administrator' AND user_id != ?1")
      .bind(admin.userId)
      .run();
    const { results } = await env.DB.prepare("SELECT id FROM role_assignment WHERE user_id = ?1")
      .bind(admin.userId)
      .all<{ id: string }>();

    const response = await admin.browser.fetch("/admin/staff", {
      form: { intent: "revoke", assignmentId: results[0].id },
    });

    expect(response.status).toBe(400);
    expect(await activeRoles("only-admin@naisema.test")).toEqual([
      { role: "administrator", reviewType: null, languageVariety: null },
    ]);
  });

  it("is refused to staff who are not administrators", async () => {
    const editor = await signedInStaff("editor2@naisema.test", [{ role: "editor" }]);

    expect((await editor.browser.fetch("/admin/staff")).status).toBe(403);
    expect(
      (
        await editor.browser.fetch("/admin/staff", {
          form: { intent: "grant", email: "x@naisema.test", role: "administrator" },
        })
      ).status,
    ).toBe(403);
  });
});
