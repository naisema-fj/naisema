import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  approve,
  body,
  languageReviewerRole,
  type Staff,
  saveNewRevision,
  staff,
  submittedArticle,
} from "./support/articles";

/** Bulk exports (CMS-05, OWN-03): documented JSON, restricted by role, and every one audited. */

const download = (who: Staff, form: Record<string, string>) => who.browser.fetch("/admin/exports/download", { form });

async function exported(who: Staff, form: Record<string, string>) {
  const response = await download(who, form);
  expect(response.status, await response.clone().text()).toBe(200);
  expect(response.headers.get("Content-Type")).toContain("application/json");
  expect(response.headers.get("Content-Disposition")).toMatch(
    /^attachment; filename="naisema-[\w-]+-\d{4}-\d{2}-\d{2}\.json"$/,
  );
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  return response.json<Record<string, unknown> & { format: string; version: number }>();
}

const exportsAudited = async (actorId: string) =>
  (
    await env.DB.prepare(
      "SELECT object_id AS kind, details FROM audit_event WHERE action = 'export.downloaded' AND actor_id = ?1 ORDER BY created_at",
    )
      .bind(actorId)
      .all<{ kind: string; details: string }>()
  ).results.map((row) => ({ kind: row.kind, details: JSON.parse(row.details) }));

type Item = { id: string; revisions: { number: number; html: string; snapshot: { title: string } }[] };

describe("the content export", () => {
  it("has every Content Item with all its Revisions, as JSON and rendered HTML, and is audited", async () => {
    const reviewer = await staff("reviewer", languageReviewerRole);
    const { editor, article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);
    await approve(reviewer, article.id, 1, "language");
    await saveNewRevision(editor, article, { title: "Vosa vakaviti, again", body: body("Ni sa bula & moce.") });

    const content = await exported(editor, { kind: "content" });

    expect(content).toMatchObject({ format: "naisema.content", version: 1 });
    const item = (content.items as Item[]).find((candidate) => candidate.id === article.id);
    expect(item?.revisions.map((revision) => revision.number)).toEqual([1, 2]);
    expect(item?.revisions[0].html).toBe("<p>Bula vinaka.</p>");
    expect(item?.revisions[1].html).toBe("<p>Ni sa bula &amp; moce.</p>");
    expect(item?.revisions[1].snapshot.title).toBe("Vosa vakaviti, again");
    expect(await exportsAudited(editor.userId)).toEqual([
      { kind: "content", details: expect.objectContaining({ items: expect.any(Number) }) },
    ]);
  });
});

describe("the Rights Record and approvals exports", () => {
  it("list the records with what they grant and the approvals with what was decided", async () => {
    const reviewer = await staff("reviewer", languageReviewerRole);
    const { editor, article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);
    await approve(reviewer, article.id, 1, "language");

    const rights = await exported(editor, { kind: "rights" });
    expect(rights.format).toBe("naisema.rights");
    const record = (rights.records as { subjectId: string; permittedUses: string[]; evidenceName: string }[]).find(
      (candidate) => candidate.subjectId === article.id,
    );
    expect(record?.permittedUses).toEqual(["publish"]);
    expect(record?.evidenceName).toBeTruthy();

    const approvals = await exported(editor, { kind: "approvals" });
    expect(approvals.format).toBe("naisema.approvals");
    const decided = (
      approvals.contentItems as { approvals: { reviewType: string; decision: string; reviewerId: string }[] }
    ).approvals.filter((approval) => approval.reviewerId === reviewer.userId);
    expect(decided).toEqual([expect.objectContaining({ reviewType: "language", decision: "approved" })]);
  });
});

describe("the audit export", () => {
  it("is for administrators only", async () => {
    const administrator = await staff("admin", { role: "administrator" });
    const editor = await staff("editor", { role: "editor" });
    expect((await download(editor, { kind: "audit" })).status).toBe(403);

    const audit = await exported(administrator, { kind: "audit" });
    expect(audit.format).toBe("naisema.audit");
    const events = audit.events as { actorId: string; action: string }[];
    expect(events).toContainEqual(expect.objectContaining({ actorId: editor.userId, action: "session.created" }));
    expect(await exportsAudited(administrator.userId)).toEqual([
      { kind: "audit", details: expect.objectContaining({ events: expect.any(Number) }) },
    ]);
  });
});

describe("the contacts export", () => {
  const sent = async () => {
    const email = `${crypto.randomUUID()}@example.org`;
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO submission (id, type, form_key, name, email, fields, status, due_on, received_at, updated_at)
       VALUES (?1, 'enquiry', ?1, 'Sera', ?2, '{"message":"Bula"}', 'new', '2026-10-13', 0, 0)`,
    )
      .bind(id, email)
      .run();
    await env.DB.prepare(
      `INSERT INTO consent_record (id, purpose, notice_id, email, source_form, submission_id, given_at)
       VALUES (?1, 'reply', 'notice-reply-2', ?2, 'enquiry', ?3, 0)`,
    )
      .bind(crypto.randomUUID(), email, id)
      .run();
    // Someone who sent a report: their Case is the case team's, so they are never a contact.
    const reporter = `${crypto.randomUUID()}@example.org`;
    await env.DB.prepare(
      `INSERT INTO consent_record (id, purpose, notice_id, email, source_form, given_at)
       VALUES (?1, 'reply', 'notice-reply-2', ?2, 'report', 0)`,
    )
      .bind(crypto.randomUUID(), reporter)
      .run();
    return { email, reporter };
  };

  it("needs the privacy contact to say what it is for, and records that purpose", async () => {
    const privacy = await staff("privacy", { role: "privacy_contact" });
    const { email, reporter } = await sent();

    const unexplained = await download(privacy, { kind: "contacts", purpose: " " });
    expect(unexplained.status).toBe(400);
    expect(await unexplained.text()).toContain("Say what the contacts are for");

    const purpose = "Inviting enquirers to the October consultation";
    const contacts = await exported(privacy, { kind: "contacts", purpose });
    expect(contacts).toMatchObject({ format: "naisema.contacts", purpose });
    expect(JSON.stringify(contacts)).toContain(email);
    expect(JSON.stringify(contacts)).not.toContain(reporter);
    expect(await exportsAudited(privacy.userId)).toEqual([
      { kind: "contacts", details: expect.objectContaining({ reason: purpose }) },
    ]);
  });

  it("is closed to editors and administrators", async () => {
    for (const role of ["editor", "administrator"] as const) {
      const person = await staff(role, { role });
      expect((await download(person, { kind: "contacts", purpose: "Just looking" })).status).toBe(403);
    }
  });
});

describe("the exports page", () => {
  it("offers each person only the exports their roles allow", async () => {
    const editor = await staff("editor", { role: "editor" });
    const page = await (await editor.browser.fetch("/admin/exports")).text();
    expect(page).toContain('value="content"');
    expect(page).toContain('value="learningLayer"');
    expect(page).not.toContain('value="audit"');
    expect(page).not.toContain('value="contacts"');

    const educator = await staff("educator", { role: "educator" });
    expect((await educator.browser.fetch("/admin/exports")).status).toBe(403);
  });
});
