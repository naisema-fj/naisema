import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { sendExpiryWarnings } from "~/lib/rights-expiry.server";
import { createArticle, staff } from "./support/articles";
import { emailsTo } from "./support/staff";

const DAY = 86_400_000;

async function insertRecord(articleId: string, createdBy: string, expiresAt: number) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO rights_record (id, subject_type, subject_id, rights_holder, permitted_uses, guardian_permission,
       evidence_key, evidence_name, evidence_type, expires_at, created_by, created_at)
     VALUES (?1, 'content_item', ?2, 'Sera Vula', '["publish"]', 0, 'rights/test', 'p.pdf', 'application/pdf', ?3, ?4, ?5)`,
  )
    .bind(id, articleId, expiresAt, createdBy, Date.now())
    .run();
  return id;
}

async function emailOf(userId: string) {
  return (
    (await env.DB.prepare("SELECT email FROM user WHERE id = ?1").bind(userId).first<{ email: string }>()) as {
      email: string;
    }
  ).email;
}

/** What the Worker's scheduled handler runs each day (workers/app.ts). */
const runDailyJob = (at: number) => sendExpiryWarnings(env, new Date(at));

describe("daily Rights Record expiry warnings", () => {
  it("emails the editor who recorded it as it enters the 30-day window, once", async () => {
    const editor = await staff("editor", { role: "editor" });
    const article = await createArticle(editor, { title: "Vakamalolo" });
    const now = Date.now();
    await insertRecord(article.id, editor.userId, now + 20 * DAY);
    const address = await emailOf(editor.userId);

    await runDailyJob(now);
    await runDailyJob(now + 1000);

    const emails = await emailsTo(address);
    const warnings = emails.filter((email) => email.subject.startsWith("Rights Records expiring"));
    expect(warnings).toHaveLength(1);
    expect(warnings[0].subject).toBe("Rights Records expiring within 30 days");
    expect(warnings[0].text).toContain("Vakamalolo");
    expect(warnings[0].text).toContain(`http://admin.localhost/admin/articles/${article.id}/rights`);
  });

  it("warns again in the 7-day window, but only once for a record first found inside it", async () => {
    const editor = await staff("editor", { role: "editor" });
    const article = await createArticle(editor, { title: "Lovo" });
    const now = Date.now();
    await insertRecord(article.id, editor.userId, now + 20 * DAY);
    const address = await emailOf(editor.userId);

    await runDailyJob(now);
    await runDailyJob(now + 15 * DAY);
    await runDailyJob(now + 16 * DAY);

    const subjects = (await emailsTo(address))
      .map((email) => email.subject)
      .filter((subject) => subject.startsWith("Rights Records expiring"));
    expect(subjects).toEqual(["Rights Records expiring within 30 days", "Rights Records expiring within 7 days"]);
  });

  it("warns every current editor when the one who recorded it is no longer an editor", async () => {
    const leaver = await staff("leaver", { role: "editor" });
    const article = await createArticle(leaver, { title: "Tabua" });
    await env.DB.prepare("UPDATE role_assignment SET revoked_at = ?1 WHERE user_id = ?2")
      .bind(Date.now(), leaver.userId)
      .run();
    const colleague = await staff("colleague", { role: "editor" });
    const now = Date.now();
    await insertRecord(article.id, leaver.userId, now + 3 * DAY);

    await runDailyJob(now);

    const colleagueWarnings = (await emailsTo(await emailOf(colleague.userId))).filter((email) =>
      email.text.includes("Tabua"),
    );
    const leaverWarnings = (await emailsTo(await emailOf(leaver.userId))).filter((email) =>
      email.subject.startsWith("Rights Records expiring"),
    );
    expect(colleagueWarnings).toHaveLength(1);
    expect(leaverWarnings).toEqual([]);
  });

  it("stays quiet about withdrawn records and those expiring later", async () => {
    const editor = await staff("editor", { role: "editor" });
    const article = await createArticle(editor, { title: "Masi" });
    const now = Date.now();
    await insertRecord(article.id, editor.userId, now + 45 * DAY);
    const withdrawn = await insertRecord(article.id, editor.userId, now + 5 * DAY);
    await env.DB.prepare("UPDATE rights_record SET withdrawn_at = ?1, withdrawn_by = 'test' WHERE id = ?2")
      .bind(now, withdrawn)
      .run();

    await runDailyJob(now);

    const warnings = (await emailsTo(await emailOf(editor.userId))).filter((email) =>
      email.subject.startsWith("Rights Records expiring"),
    );
    expect(warnings).toEqual([]);
  });
});
