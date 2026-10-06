import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { Browser, codeFor, emailsTo, seedStaff, signedInStaff, signInWithMagicLink } from "./support/staff";

describe("resetting a staff member's two-factor", () => {
  it("is offered on the staff page for each other staff member who has set up two-factor", async () => {
    const admin = await signedInStaff("reset-admin0@naisema.test", [{ role: "administrator" }]);
    await signedInStaff("enrolled@naisema.test", [{ role: "editor" }, { role: "educator" }]);
    await seedStaff("not-enrolled@naisema.test", [{ role: "editor" }]);

    const page = await (await admin.browser.fetch("/admin/staff")).text();

    expect(page.match(/aria-label="Reset two-factor for enrolled@naisema.test"/g)).toHaveLength(1);
    expect(page).not.toContain("Reset two-factor for not-enrolled@naisema.test");
    expect(page).not.toContain("Reset two-factor for reset-admin0@naisema.test");
  });

  it("ends their sessions and has them set up an authenticator app again at the next sign-in", async () => {
    const admin = await signedInStaff("reset-admin1@naisema.test", [{ role: "administrator" }]);
    const editor = await signedInStaff("lost-phone@naisema.test", [{ role: "editor" }]);

    const response = await admin.browser.fetch("/admin/staff", {
      form: { intent: "resetTwoFactor", userId: editor.userId },
    });

    expect(response.status).toBe(302);
    expect((await editor.browser.fetch("/admin")).headers.get("Location")).toBe("/admin/sign-in");
    const nextSignIn = new Browser();
    await signInWithMagicLink(nextSignIn, "lost-phone@naisema.test");
    expect((await nextSignIn.fetch("/admin")).headers.get("Location")).toBe("/admin/two-factor/setup");
  });

  it("is written to the audit log with who reset whom", async () => {
    const admin = await signedInStaff("reset-admin2@naisema.test", [{ role: "administrator" }]);
    const educator = await signedInStaff("lost-phone2@naisema.test", [{ role: "educator" }]);

    await admin.browser.fetch("/admin/staff", { form: { intent: "resetTwoFactor", userId: educator.userId } });

    const event = await env.DB.prepare(
      "SELECT actor_id AS actorId, object_type AS objectType, object_id AS objectId, created_at AS createdAt FROM audit_event WHERE action = 'two_factor.reset' AND object_id = ?1",
    )
      .bind(educator.userId)
      .first<{ actorId: string; objectType: string; objectId: string; createdAt: number }>();
    expect(event).toMatchObject({ actorId: admin.userId, objectType: "user", objectId: educator.userId });
    expect(event?.createdAt).toBeGreaterThan(0);
  });

  it("emails the person to say it happened and who to contact if they didn't ask for it", async () => {
    const admin = await signedInStaff("reset-admin3@naisema.test", [{ role: "administrator" }]);
    const reviewer = await signedInStaff("lost-phone3@naisema.test", [{ role: "reviewer", reviewType: "cultural" }]);

    await admin.browser.fetch("/admin/staff", { form: { intent: "resetTwoFactor", userId: reviewer.userId } });

    const email = (await emailsTo("lost-phone3@naisema.test")).at(-1);
    expect(email?.subject).toBe("Your NAISEMA two-factor was reset");
    expect(email?.text).toContain("reset-admin3@naisema.test");
    expect(email?.text).toMatch(/didn't ask for this/);
  });

  it("is refused to staff who are not administrators", async () => {
    const editor = await signedInStaff("reset-editor@naisema.test", [{ role: "editor" }]);
    const educator = await signedInStaff("keeps-phone@naisema.test", [{ role: "educator" }]);

    const response = await editor.browser.fetch("/admin/staff", {
      form: { intent: "resetTwoFactor", userId: educator.userId },
    });

    expect(response.status).toBe(403);
    expect((await educator.browser.fetch("/admin")).status).toBe(200);
  });

  it("is refused to an administrator whose session hasn't passed the code check", async () => {
    const admin = await signedInStaff("reset-admin4@naisema.test", [{ role: "administrator" }]);
    const educator = await signedInStaff("keeps-phone2@naisema.test", [{ role: "educator" }]);
    const uncheckedSession = new Browser();
    await signInWithMagicLink(uncheckedSession, "reset-admin4@naisema.test");

    const response = await uncheckedSession.fetch("/admin/staff", {
      form: { intent: "resetTwoFactor", userId: educator.userId },
    });

    expect(response.headers.get("Location")).toBe("/admin/two-factor");
    expect((await educator.browser.fetch("/admin")).status).toBe(200);
    expect((await admin.browser.fetch("/admin")).status).toBe(200);
  });

  it("won't let an administrator reset their own two-factor", async () => {
    const admin = await signedInStaff("reset-self@naisema.test", [{ role: "administrator" }]);

    const response = await admin.browser.fetch("/admin/staff", {
      form: { intent: "resetTwoFactor", userId: admin.userId },
    });

    expect(response.status).toBe(400);
    expect((await admin.browser.fetch("/admin")).status).toBe(200);
    const nextSignIn = new Browser();
    await signInWithMagicLink(nextSignIn, "reset-self@naisema.test");
    const codeCheck = await nextSignIn.fetch("/admin/two-factor", { form: { code: await codeFor(admin.secret) } });
    expect(codeCheck.headers.get("Location")).toBe("/admin");
  });
});
