import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { recordAudit } from "~/lib/audit.server";
import { getDb } from "~/lib/db.server";
import { act, staff, submittedArticle } from "./support/articles";

/** The audit log (CMS-05): append-only, and read by administrators only. */

const text = async (response: Response) => (await response.text()).replaceAll("<!-- -->", "");

describe("the audit log", () => {
  it("can't be changed or deleted once written", async () => {
    const objectId = crypto.randomUUID();
    await recordAudit(getDb(env.DB), { actorId: null, action: "test.recorded", objectType: "test", objectId });
    await expect(
      env.DB.prepare("UPDATE audit_event SET action = 'test.changed' WHERE object_id = ?1").bind(objectId).run(),
    ).rejects.toThrow(/append-only/);
    await expect(env.DB.prepare("DELETE FROM audit_event WHERE object_id = ?1").bind(objectId).run()).rejects.toThrow(
      /append-only/,
    );
  });

  it("shows administrators who did what to which object, when and why, newest first", async () => {
    const administrator = await staff("admin", { role: "administrator" });
    const objectId = crypto.randomUUID();
    const db = getDb(env.DB);
    await recordAudit(db, {
      actorId: administrator.userId,
      action: "content_item.withdrawn",
      objectType: "content_item",
      objectId,
      details: { reason: "Rights holder asked for it to come down" },
    });
    await recordAudit(db, {
      actorId: administrator.userId,
      action: "content_item.published",
      objectType: "content_item",
      objectId,
    });

    const page = await administrator.browser.fetch(`/admin/audit?object=${objectId}`);
    expect(page.status).toBe(200);
    const html = await text(page);
    expect(html).toContain("content_item.withdrawn");
    expect(html).toContain("Rights holder asked for it to come down");
    expect(html).toContain(administrator.email);
    expect(html.indexOf("content_item.published")).toBeLessThan(html.indexOf("content_item.withdrawn"));
    // Only that object's events.
    expect(html).not.toContain("session.created");
  });

  it("filters by who acted and by kind of action", async () => {
    const administrator = await staff("admin", { role: "administrator" });
    const other = await staff("editor", { role: "editor" });
    await recordAudit(getDb(env.DB), { actorId: other.userId, action: "topic.created", objectType: "topic" });
    const html = await text(
      await administrator.browser.fetch(`/admin/audit?actor=${encodeURIComponent(other.email)}&action=session.`),
    );
    expect(html).toContain("session.created");
    expect(html).toContain(other.email);
    expect(html).not.toContain(administrator.email);
    expect(html).not.toContain("topic.created");
  });

  it("records why an editor withdrew an item, when they say", async () => {
    const administrator = await staff("admin", { role: "administrator" });
    const { editor, article } = await submittedArticle([]);
    expect((await act(editor, article.id, 1, { intent: "publish" })).status).toBe(302);
    const withdrawn = await act(editor, article.id, 1, {
      intent: "withdraw",
      reason: "The family asked for the photograph to come down",
    });
    expect(withdrawn.status).toBe(302);

    const html = await text(
      await administrator.browser.fetch(`/admin/audit?object=${article.id}&action=content_item.`),
    );
    expect(html).toContain("content_item.withdrawn");
    expect(html).toContain("The family asked for the photograph to come down");
  });

  it("is closed to everyone but administrators", async () => {
    for (const role of ["editor", "safeguarding_lead", "privacy_contact"] as const) {
      const person = await staff(role, { role });
      expect((await person.browser.fetch("/admin/audit")).status).toBe(403);
    }
  });
});
