import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { type Scanner, scanUpload } from "~/lib/scan.server";
import { TURNSTILE_TEST_KEYS } from "~/lib/turnstile";
import { staff } from "./support/articles";
import { Browser } from "./support/staff";

const PUBLIC = "https://naisema.test";
const address = () => `visitor-${crypto.randomUUID().slice(0, 8)}@example.com`;

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

const enquiry = (email: string, fields: Record<string, string | string[]> = {}) => ({
  formKey: crypto.randomUUID(),
  name: "Mere Vula",
  email,
  message: "Bula! Is there a class in Lauan?",
  consent: "reply",
  "notice-reply": "notice-reply-1",
  "cf-turnstile-response": TURNSTILE_TEST_KEYS.token,
  ...fields,
});

const rows = async <T>(sql: string, ...values: unknown[]) =>
  (
    await env.DB.prepare(sql)
      .bind(...values)
      .all<T>()
  ).results;

const outbox = (email: string) =>
  rows<{ subject: string; text: string }>('SELECT subject, text FROM email_outbox WHERE "to" = ?1 ORDER BY id', email);

const linkIn = (text: string, path: string) => {
  const match = text.match(new RegExp(`https://naisema\\.test(/${path}/[^\\s]+)`));
  if (!match) throw new Error(`No /${path} link in: ${text}`);
  return match[1];
};

describe("public forms (PUB-05)", () => {
  it("store an enquiry and its consent apart, then show success and email a confirmation", async () => {
    const send = visitor();
    const email = address();

    const response = await send("/forms/enquiry", enquiry(email));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toContain("Thank you, it&#x27;s been sent");
    const [stored] = await rows<{ id: string; type: string; fields: string; status: string; due_on: string }>(
      "SELECT id, type, fields, status, due_on FROM submission WHERE email = ?1",
      email,
    );
    expect(stored).toMatchObject({ type: "enquiry", status: "new" });
    expect(JSON.parse(stored.fields)).toEqual({ message: "Bula! Is there a class in Lauan?" });
    expect(stored.due_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const consents = await rows<{ purpose: string; notice_id: string; source_form: string; submission_id: string }>(
      "SELECT purpose, notice_id, source_form, submission_id FROM consent_record WHERE email = ?1",
      email,
    );
    expect(consents).toEqual([
      { purpose: "reply", notice_id: "notice-reply-1", source_form: "enquiry", submission_id: stored.id },
    ]);
    const [confirmation] = await outbox(email);
    expect(confirmation.subject).toBe("We've received your enquiry");
    expect(confirmation.text).toContain("Bula! Is there a class in Lauan?");
    expect(confirmation.text).toContain(`${PUBLIC}/consent/`);
  });

  it("allow Turnstile in the page's policy, and nothing else that runs", async () => {
    const page = await visitor()("/forms/teach");

    expect(page.status).toBe(200);
    const policy = page.headers.get("Content-Security-Policy") ?? "";
    expect(policy).toContain("script-src https://challenges.cloudflare.com");
    expect(policy).toContain("frame-src https://challenges.cloudflare.com");
    const html = await page.text();
    expect(html).toContain('class="cf-turnstile"');
    expect(html).toContain(`data-sitekey="${TURNSTILE_TEST_KEYS.siteKey}"`);
    expect(html).toContain("NAISEMA keeps what you send on this form");
    expect(html).not.toContain("checked");
  });

  it("store the same form sent twice once, and confirm it once", async () => {
    const send = visitor();
    const email = address();
    const form = enquiry(email);

    expect((await send("/forms/enquiry", form)).status).toBe(200);
    const again = await send("/forms/enquiry", form);

    expect(again.status).toBe(200);
    expect(await again.text()).toContain("it&#x27;s been sent");
    expect(await rows("SELECT id FROM submission WHERE email = ?1", email)).toHaveLength(1);
    expect(await rows("SELECT id FROM consent_record WHERE email = ?1", email)).toHaveLength(1);
    expect(await outbox(email)).toHaveLength(1);
  });

  it("answer a resend from what was stored, though Turnstile never takes a token twice", async () => {
    const send = visitor();
    const email = address();
    const form = enquiry(email);
    expect((await send("/forms/enquiry", form)).status).toBe(200);

    const again = await send("/forms/enquiry", { ...form, "cf-turnstile-response": "" });

    expect(again.status).toBe(200);
    expect(await again.text()).toContain("it&#x27;s been sent");
    expect(await rows("SELECT id FROM submission WHERE email = ?1", email)).toHaveLength(1);
  });

  it("keep everything typed when refused, and store nothing", async () => {
    const send = visitor();
    const email = address();

    const response = await send("/forms/enquiry", enquiry(email, { consent: [], message: "Kept as typed <b>" }));

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain("Nothing was sent");
    expect(html).toContain(`value="${email}"`);
    expect(html).toContain("Kept as typed &lt;b&gt;</textarea>");
    expect(html).toContain('id="consent-reply-error"');
    expect(await rows("SELECT id FROM submission WHERE email = ?1", email)).toHaveLength(0);
  });

  it("refuse a form Turnstile hasn't passed, keeping what was typed", async () => {
    const email = address();

    const response = await visitor()("/forms/enquiry", enquiry(email, { "cf-turnstile-response": "" }));

    expect(response.status).toBe(403);
    const html = await response.text();
    expect(html).toContain("check that a person sent this");
    expect(html).toContain(`value="${email}"`);
    expect(await rows("SELECT id FROM submission WHERE email = ?1", email)).toHaveLength(0);
  });

  it("are rate-limited per visitor and form", async () => {
    const send = visitor();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      statuses.push((await send("/forms/enquiry", enquiry(address(), { consent: [] }))).status);
    }

    expect(statuses.slice(0, 5)).toEqual([400, 400, 400, 400, 400]);
    expect(statuses[5]).toBe(429);
    expect((await send("/forms/teach", { name: "" })).status).not.toBe(429);
  });

  it("take educator interest with the EDU-01 category and no evidence", async () => {
    const email = address();

    const response = await visitor()("/forms/teach", {
      ...enquiry(email),
      message: [],
      category: "qualified_teacher",
      languages: "Standard Fijian\nLauan",
      experience: "Ten years teaching.",
      scope: "Adults online.",
    });

    expect(response.status).toBe(200);
    const [stored] = await rows<{ type: string; fields: string }>(
      "SELECT type, fields FROM submission WHERE email = ?1",
      email,
    );
    expect(stored.type).toBe("educator_interest");
    expect(JSON.parse(stored.fields)).toEqual({
      category: "qualified_teacher",
      languages: ["Standard Fijian", "Lauan"],
      experience: "Ten years teaching.",
      scope: "Adults online.",
    });
  });

  it("record the consultation consent as its own record", async () => {
    const email = address();

    const response = await visitor()("/forms/consultation", {
      ...enquiry(email),
      consent: ["reply", "consultation"],
      "notice-consultation": "notice-consultation-1",
      ways: ["survey", "interview"],
    });

    expect(response.status).toBe(200);
    expect(
      (
        await rows<{ purpose: string }>("SELECT purpose FROM consent_record WHERE email = ?1 ORDER BY purpose", email)
      ).map((row) => row.purpose),
    ).toEqual(["consultation", "reply"]);
  });

  it("don't exist for other kinds", async () => {
    expect((await visitor()("/forms/payment")).status).toBe(404);
  });
});

describe("Consent Records (DATA-02)", () => {
  it("are withdrawn from the emailed link, by a button, never by opening it", async () => {
    const send = visitor();
    const email = address();
    await send("/forms/enquiry", enquiry(email));
    const link = linkIn((await outbox(email))[0].text, "consent");

    const opened = await send(link);
    expect(opened.status).toBe(200);
    const page = await opened.text();
    // The agreement was given under version 1, so the page shows version 1's words exactly.
    expect(page).toContain("Na iSema keeps what you send on this form");
    expect(page).toContain("notice version 1");
    expect(
      (
        await rows<{ withdrawn_at: number | null }>("SELECT withdrawn_at FROM consent_record WHERE email = ?1", email)
      )[0].withdrawn_at,
    ).toBeNull();

    const withdrawn = await send(link, {});
    expect(withdrawn.status).toBe(200);
    expect(await withdrawn.text()).toContain("You withdrew this agreement");
    expect(
      await rows("SELECT withdrawn_via FROM consent_record WHERE email = ?1 AND withdrawn_at IS NOT NULL", email),
    ).toEqual([{ withdrawn_via: "link" }]);
  });

  it("can't be reached with a made-up or altered link", async () => {
    const send = visitor();
    const email = address();
    await send("/forms/enquiry", enquiry(email));
    const link = linkIn((await outbox(email))[0].text, "consent");

    expect((await send(`${link}x`)).status).toBe(404);
    expect((await send("/consent/not-a-token")).status).toBe(404);
  });

  it("can't be changed, except to withdraw", async () => {
    const send = visitor();
    const email = address();
    await send("/forms/enquiry", enquiry(email));

    await expect(
      env.DB.prepare("UPDATE consent_record SET notice_id = 'notice-newsletter-1' WHERE email = ?1").bind(email).run(),
    ).rejects.toThrow(/only be withdrawn/);
    await expect(
      env.DB.prepare("UPDATE notice SET wording = 'changed' WHERE id = 'notice-reply-1'").run(),
    ).rejects.toThrow(/never changed/);
  });

  it("are found and withdrawn by the privacy contact on request", async () => {
    const send = visitor();
    const email = address();
    await send("/forms/enquiry", enquiry(email));
    const privacy = await staff("privacy", { role: "privacy_contact" });
    const editor = await staff("editor", { role: "editor" });

    const found = await privacy.browser.fetch(`/admin/consents?email=${encodeURIComponent(email)}`);
    expect(found.status).toBe(200);
    const [record] = await rows<{ id: string }>("SELECT id FROM consent_record WHERE email = ?1", email);
    expect(await found.text()).toContain(record.id);
    expect((await editor.browser.fetch(`/admin/consents?email=${encodeURIComponent(email)}`)).status).toBe(403);

    expect((await privacy.browser.fetch("/admin/consents", { form: { recordId: record.id } })).status).toBe(200);
    expect(await rows("SELECT withdrawn_via FROM consent_record WHERE id = ?1", record.id)).toEqual([
      { withdrawn_via: "staff" },
    ]);
  });
});

describe("notices", () => {
  it("get new versions from the privacy contact, which forms show from then on, keeping the old", async () => {
    const privacy = await staff("privacy", { role: "privacy_contact" });
    const editor = await staff("editor", { role: "editor" });
    const wording = `NAISEMA keeps what you send, version ${crypto.randomUUID()}.`;

    expect((await editor.browser.fetch("/admin/notices", { form: { purpose: "reply", wording } })).status).toBe(403);
    const published = await privacy.browser.fetch("/admin/notices", { form: { purpose: "reply", wording } });
    expect(published.status).toBe(200);

    const [latest] = await rows<{ id: string; version: number }>(
      "SELECT id, version FROM notice WHERE purpose = 'reply' ORDER BY version DESC LIMIT 1",
    );
    expect(latest.version).toBeGreaterThan(1);
    const form = await (await visitor()("/forms/enquiry")).text();
    expect(form).toContain(wording);
    expect(form).toContain(`value="${latest.id}"`);
    expect(await rows("SELECT id FROM notice WHERE id = 'notice-reply-1'")).toHaveLength(1);

    // A form opened before the change records the version its sender read.
    const email = address();
    await visitor()("/forms/enquiry", enquiry(email));
    expect(await rows("SELECT notice_id FROM consent_record WHERE email = ?1", email)).toEqual([
      { notice_id: "notice-reply-1" },
    ]);
  });

  it("must be a real version of the purpose's own notice", async () => {
    const email = address();

    const response = await visitor()("/forms/enquiry", enquiry(email, { "notice-reply": "notice-newsletter-1" }));

    expect(response.status).toBe(400);
    expect(await rows("SELECT id FROM submission WHERE email = ?1", email)).toHaveLength(0);
  });
});

describe("the newsletter (PUB-06)", () => {
  const tags = async (email: string) =>
    rows<{ action: string; tags: string }>(
      "SELECT action, tags FROM newsletter_outbox WHERE email = ?1 ORDER BY id",
      email,
    );

  it("signs up through the double-opt-in tool, tagged with the notice version", async () => {
    const email = address();

    const response = await visitor()("/newsletter", {
      email: email.toUpperCase(),
      consent: "newsletter",
      "notice-newsletter": "notice-newsletter-1",
      "cf-turnstile-response": TURNSTILE_TEST_KEYS.token,
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Check your email");
    expect(await tags(email)).toEqual([{ action: "subscribe", tags: '["notice-newsletter-v1"]' }]);
    expect(await rows("SELECT source_form FROM consent_record WHERE email = ?1", email)).toEqual([
      { source_form: "newsletter" },
    ]);
  });

  it("can be asked for alongside a form, as a separate consent", async () => {
    const email = address();

    await visitor()(
      "/forms/enquiry",
      enquiry(email, { consent: ["reply", "newsletter"], "notice-newsletter": "notice-newsletter-1" }),
    );

    expect(await tags(email)).toEqual([{ action: "subscribe", tags: '["notice-newsletter-v1"]' }]);
    expect(await rows("SELECT purpose FROM consent_record WHERE email = ?1 ORDER BY purpose", email)).toEqual([
      { purpose: "newsletter" },
      { purpose: "reply" },
    ]);
  });

  it("is withdrawn from a form's emailed link, recorded as withdrawn by link", async () => {
    const send = visitor();
    const email = address();
    await send(
      "/forms/enquiry",
      enquiry(email, { consent: ["reply", "newsletter"], "notice-newsletter": "notice-newsletter-1" }),
    );
    const links = [...(await outbox(email))[0].text.matchAll(/https:\/\/naisema\.test(\/consent\/\S+)/g)].map(
      (match) => match[1],
    );
    const [newsletterRecord] = await rows<{ id: string }>(
      "SELECT id FROM consent_record WHERE email = ?1 AND purpose = 'newsletter'",
      email,
    );
    const link = links.find((each) => each.includes(newsletterRecord.id)) as string;

    expect((await send(link, {})).status).toBe(200);

    expect((await tags(email)).map((row) => row.action)).toEqual(["subscribe", "unsubscribe"]);
    expect(await rows("SELECT withdrawn_via FROM consent_record WHERE id = ?1", newsletterRecord.id)).toEqual([
      { withdrawn_via: "link" },
    ]);
  });

  it("unsubscribes, withdrawing every newsletter consent for the address", async () => {
    const send = visitor();
    const email = address();
    await send("/newsletter", {
      email,
      consent: "newsletter",
      "notice-newsletter": "notice-newsletter-1",
      "cf-turnstile-response": TURNSTILE_TEST_KEYS.token,
    });

    const response = await send("/newsletter/unsubscribe", {
      email,
      "cf-turnstile-response": TURNSTILE_TEST_KEYS.token,
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("You&#x27;re unsubscribed");
    expect((await tags(email)).map((row) => row.action)).toEqual(["subscribe", "unsubscribe"]);
    expect(await rows("SELECT withdrawn_via FROM consent_record WHERE email = ?1", email)).toEqual([
      { withdrawn_via: "unsubscribe" },
    ]);
  });
});

describe("the staff Submission queue", () => {
  it("lets editors own a Submission and set when it's due; nobody else sees it", async () => {
    const editor = await staff("editor", { role: "editor" });
    const educator = await staff("educator", { role: "educator" });
    const email = address();
    await visitor()("/forms/enquiry", enquiry(email));
    const [{ id }] = await rows<{ id: string }>("SELECT id FROM submission WHERE email = ?1", email);

    expect(await (await editor.browser.fetch("/admin/submissions")).text()).toContain(`/admin/submissions/${id}`);
    expect((await educator.browser.fetch("/admin/submissions")).status).toBe(403);
    expect((await educator.browser.fetch(`/admin/submissions/${id}`)).status).toBe(403);

    const saved = await editor.browser.fetch(`/admin/submissions/${id}`, {
      form: { status: "in_progress", ownerId: editor.userId, dueOn: "2026-10-20" },
    });
    expect(saved.status).toBe(200);
    expect(await rows("SELECT status, owner_id, due_on FROM submission WHERE id = ?1", id)).toEqual([
      { status: "in_progress", owner_id: editor.userId, due_on: "2026-10-20" },
    ]);
    const refused = await editor.browser.fetch(`/admin/submissions/${id}`, {
      form: { status: "in_progress", ownerId: educator.userId, dueOn: "soon" },
    });
    expect(refused.status).toBe(400);
    const impossible = await editor.browser.fetch(`/admin/submissions/${id}`, {
      form: { status: "in_progress", ownerId: "", dueOn: "2026-02-31" },
    });
    expect(impossible.status).toBe(400);
    expect(await rows("SELECT action FROM audit_event WHERE object_id = ?1 ORDER BY created_at", id)).toEqual([
      { action: "submission.received" },
      { action: "submission.updated" },
    ]);
  });
});

describe("upload links for requested material", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7\nA story from Lakeba.\n");
  const clean: Scanner = async ({ body }) => {
    await new Response(body).arrayBuffer();
    return { verdict: "clean" };
  };

  async function contribution() {
    const email = address();
    await visitor()("/forms/contribute", { ...enquiry(email), message: [], description: "My grandmother's meke." });
    const [{ id }] = await rows<{ id: string }>("SELECT id FROM submission WHERE email = ?1", email);
    return { id, email };
  }

  async function sendLink(id: string, email: string) {
    const editor = await staff("editor", { role: "editor" });
    expect((await editor.browser.fetch(`/admin/submissions/${id}`, { form: { intent: "upload-link" } })).status).toBe(
      200,
    );
    const emails = await outbox(email);
    return { editor, path: linkIn(emails[emails.length - 1].text, "upload") };
  }

  it("lets a contributor upload into quarantine once, and staff download what passed its scan", async () => {
    const { id, email } = await contribution();
    const { editor, path } = await sendLink(id, email);
    const send = visitor();
    const json = (body: unknown) => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const page = await send(path);
    expect(page.status).toBe(200);
    expect(page.headers.get("Cache-Control")).toBe("no-store");
    const browser = new Browser();
    const started = await browser.fetch(
      `${PUBLIC}${path}/files`,
      json({
        name: "meke.pdf",
        type: "application/pdf",
        size: pdf.length,
        head: btoa(String.fromCharCode(...pdf.subarray(0, 16))),
      }),
    );
    expect(started.status, await started.clone().text()).toBe(201);
    const { id: assetId } = (await started.json()) as { id: string };
    expect(
      (await browser.fetch(`${PUBLIC}${path}/files/${assetId}/parts/1`, { method: "PUT", body: pdf.slice() })).status,
    ).toBe(200);
    expect((await browser.fetch(`${PUBLIC}${path}/files/${assetId}`, { method: "POST" })).status).toBe(200);

    const [asset] = await rows<{ purpose: string; status: string; destination_key: string }>(
      "SELECT purpose, status, destination_key FROM media_asset WHERE id = ?1",
      assetId,
    );
    expect(asset).toMatchObject({ purpose: "submission", status: "scanning" });
    expect(await scanUpload(env, getDb(env.DB), assetId, clean)).toBe("clean");
    expect(await env.EVIDENCE.head(asset.destination_key)).not.toBeNull();
    expect(await env.MEDIA.head(asset.destination_key)).toBeNull();
    expect(await (await editor.browser.fetch("/admin/media")).text()).not.toContain("meke.pdf");

    const download = await editor.browser.fetch(`/admin/submissions/${id}/files/${assetId}`);
    expect(download.status).toBe(200);
    expect(download.headers.get("Content-Disposition")).toContain("attachment");
    expect(await download.text()).toContain("A story from Lakeba.");

    expect(await (await send(path, {})).text()).toContain("that&#x27;s everything");
    expect(await (await send(path)).text()).toContain("This link no longer works");
    expect(
      (await browser.fetch(`${PUBLIC}${path}/files`, json({ name: "more.pdf", type: "application/pdf", size: 10 })))
        .status,
    ).toBe(410);
  });

  it("stops an earlier link when a new one is sent, and expires", async () => {
    const { id, email } = await contribution();
    const first = await sendLink(id, email);
    const second = await sendLink(id, email);

    const works = async (path: string) => !(await (await visitor()(path)).text()).includes("no longer works");
    expect(await works(first.path)).toBe(false);
    expect(await works(second.path)).toBe(true);
    await env.DB.prepare("UPDATE upload_link SET expires_at = ?1 WHERE submission_id = ?2")
      .bind(Date.now() - 1000, id)
      .run();
    expect(await works(second.path)).toBe(false);
  });

  it("takes at most 20 files", async () => {
    const { id, email } = await contribution();
    const { path } = await sendLink(id, email);
    const browser = new Browser();
    const start = () =>
      browser.fetch(`${PUBLIC}${path}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "meke.pdf",
          type: "application/pdf",
          size: pdf.length,
          head: btoa(String.fromCharCode(...pdf.subarray(0, 16))),
        }),
      });
    for (let file = 0; file < 20; file++) expect((await start()).status).toBe(201);

    const refused = await start();

    expect(refused.status).toBe(409);
    expect(((await refused.json()) as { error: string }).error).toContain("at most 20 files");
  });

  it("only reaches the link's own uploads", async () => {
    const one = await contribution();
    const two = await contribution();
    const { path: pathOne } = await sendLink(one.id, one.email);
    const { path: pathTwo } = await sendLink(two.id, two.email);
    const browser = new Browser();
    const started = await browser.fetch(`${PUBLIC}${pathOne}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "meke.pdf",
        type: "application/pdf",
        size: pdf.length,
        head: btoa(String.fromCharCode(...pdf.subarray(0, 16))),
      }),
    });
    const { id: assetId } = (await started.json()) as { id: string };

    expect((await browser.fetch(`${PUBLIC}${pathTwo}/files/${assetId}`)).status).toBe(404);
  });

  it("is only for contribution proposals", async () => {
    const editor = await staff("editor", { role: "editor" });
    const email = address();
    await visitor()("/forms/enquiry", enquiry(email));
    const [{ id }] = await rows<{ id: string }>("SELECT id FROM submission WHERE email = ?1", email);

    expect((await editor.browser.fetch(`/admin/submissions/${id}`, { form: { intent: "upload-link" } })).status).toBe(
      400,
    );
  });
});
