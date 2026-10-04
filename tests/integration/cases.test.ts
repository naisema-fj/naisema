import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { type Scanner, scanUpload } from "~/lib/scan.server";
import { TURNSTILE_TEST_KEYS } from "~/lib/turnstile";
import { act, approve, languageReviewerRole, type Staff, staff, submittedArticle } from "./support/articles";
import { pdfEvidence } from "./support/rights";
import { Browser, emailsTo } from "./support/staff";

const PUBLIC = "https://naisema.test";
const address = () => `reporter-${crypto.randomUUID().slice(0, 8)}@example.com`;

/** A visitor's browser on the public site, with its own address. */
const visitor = () => {
  const browser = new Browser();
  return (path: string, form?: Record<string, string | string[]>) => {
    if (!form) return browser.fetch(`${PUBLIC}${path}`);
    const body = new URLSearchParams();
    for (const [name, value] of Object.entries(form)) for (const each of [value].flat()) body.append(name, each);
    return browser.fetch(`${PUBLIC}${path}`, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  };
};

const rows = async <T>(sql: string, ...values: unknown[]) =>
  (
    await env.DB.prepare(sql)
      .bind(...values)
      .all<T>()
  ).results;

const report = (fields: Record<string, string | string[]> = {}) => ({
  formKey: crypto.randomUUID(),
  reason: "harm",
  details: "It shows a child's full name and school.",
  "cf-turnstile-response": TURNSTILE_TEST_KEYS.token,
  ...fields,
});

const withEmail = (email: string) => ({ email, name: "Sera", consent: "reply", "notice-reply": "notice-reply-1" });

async function publishedArticle() {
  const reviewer = await staff("lang-reviewer", languageReviewerRole);
  const { editor, article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);
  await approve(reviewer, article.id, 1, "language");
  expect((await act(editor, article.id, 1, { intent: "publish" })).status).toBe(302);
  const row = await env.DB.prepare("SELECT primary_area AS area, slug FROM content_item WHERE id = ?1")
    .bind(article.id)
    .first<{ area: string; slug: string }>();
  return { id: article.id, path: `/${row?.area}/${row?.slug}` };
}

async function caseFor(where: string, value: string) {
  const [found] = await rows<{ id: string; kind: string; state: string; content_item_id: string | null }>(
    `SELECT id, kind, state, content_item_id FROM case_record WHERE ${where} = ?1`,
    value,
  );
  return found;
}

const caseAction = (who: Staff, id: string, form: Record<string, string>) =>
  who.browser.fetch(`/admin/cases/${id}`, { form });

const clean: Scanner = async ({ body }) => {
  await new Response(body).arrayBuffer();
  return { verdict: "clean" };
};

describe("reporting (SAFE-01)", () => {
  it("is linked from every content page with the item's id, and names the item it's about", async () => {
    const { id, path } = await publishedArticle();

    expect(await (await visitor()(path)).text()).toContain(`href="/report?item=${id}"`);
    const form = await visitor()(`/report?item=${id}`);
    expect(form.headers.get("Cache-Control")).toBe("no-store");
    expect(await form.text()).toContain("You&#x27;re reporting");
  });

  it("opens a restricted Case for an anonymous report, telling the safeguarding lead nothing of its contents", async () => {
    const lead = await staff("lead", { role: "safeguarding_lead" });
    const { id } = await publishedArticle();
    const formKey = crypto.randomUUID();

    const sent = await visitor()("/report", report({ formKey, item: id }));

    expect(sent.status).toBe(200);
    expect(await sent.text()).toContain("Thank you for telling us");
    const found = await caseFor("form_key", formKey);
    expect(found).toMatchObject({ kind: "report", state: "received", content_item_id: id });
    const notice = (await emailsTo(lead.email)).at(-1) as { subject: string; text: string };
    expect(notice.subject).toMatch(/^A new report \(/);
    expect(notice.text).not.toContain("full name and school");
    expect(notice.text).toContain(`/admin/cases/${found.id}`);
  });

  it("makes a rights issue a rights concern, and tells a reporter who left an address its reference", async () => {
    const email = address();
    const formKey = crypto.randomUUID();

    await visitor()("/report", report({ formKey, reason: "rights", ...withEmail(email) }));

    expect(await caseFor("form_key", formKey)).toMatchObject({ kind: "rights_concern" });
    const [acknowledgement] = await emailsTo(email);
    expect(acknowledgement.subject).toMatch(/^We've received your rights concern \([0-9A-F]{8}\)$/);
    expect(await rows("SELECT purpose, source_form FROM consent_record WHERE email = ?1", email)).toEqual([
      { purpose: "reply", source_form: "report" },
    ]);
    // That an address sent a report is for the case team, not the privacy contact's consent lookup.
    const privacy = await staff("privacy", { role: "privacy_contact" });
    const lookup = await (await privacy.browser.fetch(`/admin/consents?email=${encodeURIComponent(email)}`)).text();
    expect(lookup).toContain("a restricted form");
    expect(lookup).not.toContain("<td>report</td>");
  });

  it("opens one Case for a form sent twice, though Turnstile won't take the token again", async () => {
    const send = visitor();
    const form = report();

    await send("/report", form);
    const again = await send("/report", { ...form, "cf-turnstile-response": "" });

    expect(again.status).toBe(200);
    expect(await rows("SELECT id FROM case_record WHERE form_key = ?1", form.formKey)).toHaveLength(1);
  });

  it("is refused without Turnstile, keeping what was typed", async () => {
    const response = await visitor()("/report", report({ "cf-turnstile-response": "", details: "Kept as typed" }));

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("Kept as typed</textarea>");
  });

  it("has a route from the community standards page, and the privacy page offers data requests", async () => {
    expect(await (await visitor()("/community-standards")).text()).toContain('href="/report"');
    expect(await (await visitor()("/privacy")).text()).toContain('href="/privacy/request"');
  });
});

describe("who can open a Case (AC-05)", () => {
  it("only the role that handles its kind; administrators and editors are refused, and every attempt is recorded", async () => {
    const lead = await staff("lead", { role: "safeguarding_lead" });
    const privacy = await staff("privacy", { role: "privacy_contact" });
    const admin = await staff("admin", { role: "administrator" });
    const editor = await staff("editor", { role: "editor" });
    const formKey = crypto.randomUUID();
    await visitor()("/report", report({ formKey }));
    const { id } = await caseFor("form_key", formKey);

    expect((await lead.browser.fetch(`/admin/cases/${id}`)).status).toBe(200);
    expect((await privacy.browser.fetch(`/admin/cases/${id}`)).status).toBe(403);
    expect((await admin.browser.fetch(`/admin/cases/${id}`)).status).toBe(403);
    expect((await admin.browser.fetch("/admin/cases")).status).toBe(403);
    expect((await editor.browser.fetch(`/admin/cases/${id}`)).status).toBe(403);
    expect(await (await lead.browser.fetch("/admin/cases")).text()).toContain(`/admin/cases/${id}`);
    expect(await (await privacy.browser.fetch("/admin/cases")).text()).not.toContain(`/admin/cases/${id}`);

    const audit = await rows<{ action: string; actor_id: string }>(
      "SELECT action, actor_id FROM audit_event WHERE object_id = ?1 AND action IN ('case.viewed', 'case.refused') ORDER BY created_at",
      id,
    );
    expect(audit).toEqual([
      { action: "case.viewed", actor_id: lead.userId },
      { action: "case.refused", actor_id: privacy.userId },
      { action: "case.refused", actor_id: admin.userId },
      { action: "case.refused", actor_id: editor.userId },
    ]);
    // The queue itself: looking at it, and being turned away from it, are recorded too.
    expect(
      await rows(
        "SELECT action FROM audit_event WHERE actor_id = ?1 AND object_id IS NULL AND action LIKE 'case.%'",
        admin.userId,
      ),
    ).toEqual([{ action: "case.refused" }]);
    expect(
      await rows("SELECT action FROM audit_event WHERE actor_id = ?1 AND action = 'case.queue_viewed'", lead.userId),
    ).toHaveLength(1);
  });

  it("data requests go to the privacy contact, who sees what Na iSema holds for the address", async () => {
    const privacy = await staff("privacy", { role: "privacy_contact" });
    const lead = await staff("lead", { role: "safeguarding_lead" });
    const email = address();
    const formKey = crypto.randomUUID();

    const sent = await visitor()("/privacy/request", {
      formKey,
      request: "access",
      ...withEmail(email),
      name: "Sera Vula",
      "cf-turnstile-response": TURNSTILE_TEST_KEYS.token,
    });

    expect(sent.status).toBe(200);
    const found = await caseFor("form_key", formKey);
    expect(found).toMatchObject({ kind: "data_request" });
    expect((await lead.browser.fetch(`/admin/cases/${found.id}`)).status).toBe(403);
    const page = await (await privacy.browser.fetch(`/admin/cases/${found.id}`)).text();
    expect(page).toContain("What Na iSema holds for this address");
    expect(page).toContain("Sera Vula");
  });
});

describe("a report through triage, action and appeal (AC-05)", () => {
  it("hides the item, decides, and has the appeal decided by someone else", async () => {
    const lead = await staff("lead", { role: "safeguarding_lead" });
    const backup = await staff("backup-lead", { role: "safeguarding_lead" });
    const editor = await staff("editor", { role: "editor" });
    const { id: itemId, path } = await publishedArticle();
    const email = address();
    const formKey = crypto.randomUUID();
    await visitor()("/report", report({ formKey, item: itemId, ...withEmail(email) }));
    const { id } = await caseFor("form_key", formKey);

    // Triage: an owner must be someone who handles reports.
    expect((await caseAction(lead, id, { intent: "triage", severity: "high", ownerId: editor.userId })).status).toBe(
      400,
    );
    expect(
      (
        await caseAction(lead, id, {
          intent: "triage",
          severity: "high",
          ownerId: lead.userId,
          affectedPerson: "A child",
        })
      ).status,
    ).toBe(200);

    // Hidden pending review: off the public site, and nobody can republish it.
    expect((await caseAction(editor, id, { intent: "hide" })).status).toBe(403);
    expect(await (await visitor()("/sitemap.xml")).text()).toContain(path);
    expect((await caseAction(lead, id, { intent: "hide" })).status).toBe(200);
    expect((await visitor()(path)).status).not.toBe(200);
    expect(await (await visitor()("/sitemap.xml")).text()).not.toContain(path);
    expect(await (await caseAction(lead, id, { intent: "hide" })).text()).toContain("It is already hidden.");
    await expect(
      env.DB.prepare(
        "INSERT INTO content_hold (id, content_item_id, case_id, placed_by, placed_at) VALUES (?1, ?2, ?3, 'x', 0)",
      )
        .bind(crypto.randomUUID(), itemId, id)
        .run(),
    ).rejects.toThrow(/UNIQUE/);
    const editorView = await (await editor.browser.fetch(`/admin/articles/${itemId}/revisions/1`)).text();
    expect(editorView).toContain("hidden while a Case about it is reviewed");
    expect(editorView).not.toContain(email);

    // The decision, and the reporter is told how to appeal.
    expect(
      (
        await caseAction(lead, id, {
          intent: "decide",
          outcome: "content_changed",
          action: "Asked the editor to remove the school's name.",
          rationale: "Identifies a child (SAFE-02).",
        })
      ).status,
    ).toBe(200);
    const decision = (await emailsTo(email)).at(-1);
    expect(decision?.text).toContain("The content has been changed.");
    const appealPath = decision?.text.match(/https:\/\/naisema\.test(\/cases\/appeal\/\S+)/)?.[1] as string;
    expect(appealPath).toBeTruthy();

    // The reporter appeals; the backup lead is told, the decision's maker isn't.
    const before = (await emailsTo(lead.email)).length;
    expect((await visitor()(appealPath, { reasons: "The photo still shows her school badge." })).status).toBe(200);
    expect(await caseFor("id", id)).toMatchObject({ state: "appealed" });
    expect((await emailsTo(backup.email)).at(-1)?.subject).toMatch(/^An appeal on report/);
    expect(await emailsTo(lead.email)).toHaveLength(before);
    expect((await visitor()(appealPath, { reasons: "Again" })).status).toBe(409);
    expect(await rows("SELECT id FROM audit_event WHERE object_id = ?1 AND action = 'case.appealed'", id)).toHaveLength(
      1,
    );

    // The appeal goes to someone other than the original decision-maker.
    const own = await caseAction(lead, id, { intent: "decide-appeal", outcome: "overturned", rationale: "Mine." });
    expect(own.status).toBe(409);
    expect(
      (
        await caseAction(backup, id, {
          intent: "decide-appeal",
          outcome: "overturned",
          rationale: "The badge identifies her.",
        })
      ).status,
    ).toBe(200);
    expect(await caseFor("id", id)).toMatchObject({ state: "closed" });
    expect((await emailsTo(email)).at(-1)?.text).toContain("The decision was changed.");

    // Shown again once reviewed.
    expect((await caseAction(lead, id, { intent: "show" })).status).toBe(200);
    expect((await visitor()(path)).status).toBe(200);

    const audit = await rows<{ action: string }>(
      "SELECT action FROM audit_event WHERE object_id IN (?1, ?2) AND action NOT IN ('case.viewed') ORDER BY created_at",
      id,
      itemId,
    );
    expect(audit.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        "case.received",
        "case.triaged",
        "content.hidden_pending_review",
        "case.actioned",
        "case.appealed",
        "case.appeal_decided",
        "content.shown_after_review",
      ]),
    );
  });

  it("can't skip triage, and closes a decision that nobody appeals", async () => {
    const lead = await staff("lead", { role: "safeguarding_lead" });
    const formKey = crypto.randomUUID();
    await visitor()("/report", report({ formKey }));
    const { id } = await caseFor("form_key", formKey);
    const decide = {
      intent: "decide",
      outcome: "no_action",
      action: "Checked it.",
      rationale: "Nothing identifies anyone.",
    };

    expect((await caseAction(lead, id, decide)).status).toBe(409);
    await caseAction(lead, id, { intent: "triage", severity: "low", ownerId: lead.userId });
    expect((await caseAction(lead, id, decide)).status).toBe(200);
    expect((await caseAction(lead, id, { intent: "close" })).status).toBe(200);
    expect(await caseFor("id", id)).toMatchObject({ state: "closed" });
  });

  it("takes an appeal only within 30 days of the decision", async () => {
    const lead = await staff("lead", { role: "safeguarding_lead" });
    const email = address();
    const formKey = crypto.randomUUID();
    await visitor()("/report", report({ formKey, ...withEmail(email) }));
    const { id } = await caseFor("form_key", formKey);
    await caseAction(lead, id, { intent: "triage", severity: "low", ownerId: lead.userId });
    await caseAction(lead, id, { intent: "decide", outcome: "no_action", action: "Checked.", rationale: "Fine." });
    const appealPath = (await emailsTo(email))
      .at(-1)
      ?.text.match(/https:\/\/naisema\.test(\/cases\/appeal\/\S+)/)?.[1] as string;
    await env.DB.prepare("UPDATE case_record SET decided_at = ?1 WHERE id = ?2")
      .bind(Date.now() - 31 * 86_400_000, id)
      .run();

    expect(await (await visitor()(appealPath)).text()).toContain("can no longer be appealed");
    expect((await visitor()(appealPath, { reasons: "Late" })).status).toBe(409);
    expect((await visitor()(`${appealPath}x`)).status).toBe(404);
  });
});

describe("restricted evidence", () => {
  it("is added by the case team, scanned, and opened only by them, audited", async () => {
    const lead = await staff("lead", { role: "safeguarding_lead" });
    const privacy = await staff("privacy", { role: "privacy_contact" });
    const admin = await staff("admin", { role: "administrator" });
    const formKey = crypto.randomUUID();
    await visitor()("/report", report({ formKey }));
    const { id } = await caseFor("form_key", formKey);
    const multipart = new FormData();
    multipart.set("intent", "evidence");
    multipart.set("evidence", pdfEvidence());

    expect((await lead.browser.fetch(`/admin/cases/${id}`, { multipart })).status).toBe(200);
    const [{ asset_id: assetId }] = await rows<{ asset_id: string }>(
      "SELECT asset_id FROM case_evidence WHERE case_id = ?1",
      id,
    );
    expect((await lead.browser.fetch(`/admin/cases/${id}/evidence/${assetId}`)).status).toBe(409);
    expect(await scanUpload(env, getDb(env.DB), assetId, clean)).toBe("clean");

    const download = await lead.browser.fetch(`/admin/cases/${id}/evidence/${assetId}`);
    expect(download.status).toBe(200);
    expect(download.headers.get("Content-Security-Policy")).toContain("sandbox");
    expect((await privacy.browser.fetch(`/admin/cases/${id}/evidence/${assetId}`)).status).toBe(403);
    expect((await admin.browser.fetch(`/admin/cases/${id}/evidence/${assetId}`)).status).toBe(403);
    // Each attempt is recorded, including the one turned away while the file was still being scanned.
    expect(
      await rows(
        "SELECT actor_id, details FROM audit_event WHERE object_id = ?1 AND action = 'case.evidence_read' ORDER BY created_at",
        id,
      ),
    ).toEqual([
      { actor_id: lead.userId, details: JSON.stringify({ assetId, delivered: false }) },
      { actor_id: lead.userId, details: JSON.stringify({ assetId, delivered: true }) },
    ]);
  });
});
