import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  auditActions,
  Browser,
  codeFor,
  emailsTo,
  seedStaff,
  signInWithMagicLink,
  startTwoFactorSetup,
} from "./support/staff";

async function enrolledAdministrator(email: string) {
  const userId = await seedStaff(email, [{ role: "administrator" }]);
  const browser = new Browser();
  await signInWithMagicLink(browser, email);
  const secret = await startTwoFactorSetup(browser);
  await browser.fetch("/admin/two-factor/setup", { form: { intent: "verify", code: await codeFor(secret) } });
  return { userId, browser, secret };
}

describe("staff admin host", () => {
  it("does not exist on the public site", async () => {
    expect((await SELF.fetch("https://naisema.test/admin")).status).toBe(404);
    expect((await SELF.fetch("https://naisema.test/api/auth/get-session")).status).toBe(404);
  });

  it("sends visitors without a session to sign in", async () => {
    const response = await new Browser().fetch("/admin");

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/admin/sign-in");
  });

  it("refuses form posts from another site", async () => {
    const response = await new Browser().fetch("/admin/sign-in", {
      form: { email: "anyone@naisema.test" },
      headers: { Origin: "https://attacker.example" },
    });

    expect(response.status).toBe(403);
  });
});

describe("staff sign-in", () => {
  it("emails a magic link to a staff member and gives the same answer for unknown addresses", async () => {
    await seedStaff("editor@naisema.test", [{ role: "editor" }]);

    const known = await (
      await new Browser().fetch("/admin/sign-in", { form: { email: "editor@naisema.test" } })
    ).text();
    const unknown = await (
      await new Browser().fetch("/admin/sign-in", { form: { email: "nobody@naisema.test" } })
    ).text();

    expect(known).toContain("Check your email");
    expect(unknown).toContain("Check your email");
    const [email] = await emailsTo("editor@naisema.test");
    expect(email.text).toMatch(/http:\/\/admin\.localhost\/api\/auth\/magic-link\/verify\?token=/);
    expect(await emailsTo("nobody@naisema.test")).toEqual([]);
  });

  it("sets a session cookie that scripts cannot read and that only travels over HTTPS", async () => {
    await seedStaff("cookie-check@naisema.test", [{ role: "editor" }]);
    const browser = new Browser();
    await browser.fetch("https://admin.localhost/admin/sign-in", { form: { email: "cookie-check@naisema.test" } });
    const [email] = await emailsTo("cookie-check@naisema.test");
    const link = email.text.match(/https:\/\/\S+/)?.[0] as string;

    const response = await browser.fetch(link);
    const cookie = response.headers.getSetCookie().find((value) => value.includes("session_token")) ?? "";

    expect(cookie).toMatch(/^__Secure-naisema\.session_token=/);
    expect(cookie).toMatch(/; HttpOnly/i);
    expect(cookie).toMatch(/; Secure/i);
    expect(cookie).toMatch(/; SameSite=Lax/i);
  });

  it("gives no staff access until an authenticator app is set up", async () => {
    await seedStaff("new-staff@naisema.test", [{ role: "editor" }]);
    const browser = new Browser();

    await signInWithMagicLink(browser, "new-staff@naisema.test");
    const response = await browser.fetch("/admin");

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/admin/two-factor/setup");
  });

  it("activates staff access once a code from the authenticator app is confirmed", async () => {
    const { userId, browser } = await enrolledAdministrator("founder@naisema.test");

    const home = await browser.fetch("/admin");

    expect(home.status).toBe(200);
    const html = await home.text();
    expect(html).toContain("founder@naisema.test");
    expect(html).toContain("Administrator");
    expect(await auditActions(userId)).toEqual(expect.arrayContaining(["session.created", "two_factor.enrolled"]));
  });

  it("asks for a code again on every new sign-in", async () => {
    const { secret } = await enrolledAdministrator("returning@naisema.test");
    const laterBrowser = new Browser();

    await signInWithMagicLink(laterBrowser, "returning@naisema.test");
    const beforeCode = await laterBrowser.fetch("/admin");
    await laterBrowser.fetch("/admin/two-factor", { form: { code: await codeFor(secret) } });
    const afterCode = await laterBrowser.fetch("/admin");

    expect(beforeCode.headers.get("Location")).toBe("/admin/two-factor");
    expect(afterCode.status).toBe(200);
  });

  it("ends the session after five wrong codes", async () => {
    const { userId } = await enrolledAdministrator("guesser@naisema.test");
    const browser = new Browser();
    await signInWithMagicLink(browser, "guesser@naisema.test");

    for (let attempt = 0; attempt < 5; attempt++) {
      await browser.fetch("/admin/two-factor", { form: { code: "000000" } });
    }
    const response = await browser.fetch("/admin");

    expect(response.headers.get("Location")).toBe("/admin/sign-in");
    expect(await auditActions(userId)).toContain("session.ended_after_failed_codes");
  });

  it("refuses an account that holds no staff role", async () => {
    const userId = await seedStaff("former-staff@naisema.test", []);
    const browser = new Browser();
    await signInWithMagicLink(browser, "former-staff@naisema.test");
    const secret = await startTwoFactorSetup(browser);
    await browser.fetch("/admin/two-factor/setup", { form: { intent: "verify", code: await codeFor(secret) } });

    const response = await browser.fetch("/admin");

    expect(userId).toBeTruthy();
    expect(response.status).toBe(403);
  });
});
