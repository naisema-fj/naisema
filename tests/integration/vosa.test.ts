import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

/**
 * Vosa on the Expression library (change note 0002, ADR-0017), against the built Worker: the import,
 * the public dictionary, and an Expression from a suggestion through its language review.
 */

const ADMIN = "http://admin.localhost";
const PUBLIC = "http://localhost";
const EDITOR = "vosa-editor@naisema.test";
const REVIEWER = "vosa-reviewer@naisema.test";

const visit = (path: string) => SELF.fetch(`${PUBLIC}${path}`, { redirect: "manual" });

async function addStaff(email: string, roles: string[], variety: string | null = null) {
  await env.DB.prepare("INSERT OR REPLACE INTO staff (email, name, roles, language_variety) VALUES (?, ?, ?, ?)")
    .bind(email, email.split("@")[0], JSON.stringify(roles), variety)
    .run();
}

function as(email: string, path: string, form?: Record<string, string>) {
  const headers = new Headers({ "X-Dev-Staff-Email": email });
  if (form) {
    headers.set("Content-Type", "application/x-www-form-urlencoded");
    headers.set("Origin", ADMIN);
  }
  return SELF.fetch(`${ADMIN}${path}`, {
    method: form ? "POST" : "GET",
    body: form ? new URLSearchParams(form) : undefined,
    headers,
    redirect: "manual",
  });
}

describe("the Vosa import", () => {
  it("brings every entry, grammar term and saying over as a draft", async () => {
    const counts = await env.DB.prepare("SELECT kind, count(*) AS n FROM expression GROUP BY kind ORDER BY kind").all<{
      kind: string;
      n: number;
    }>();
    expect(counts.results).toEqual([
      { kind: "grammar-term", n: 121 },
      { kind: "saying", n: 161 },
      { kind: "word", n: 1231 },
    ]);
    const reviews = await env.DB.prepare("SELECT count(*) AS n FROM expression_review").first<{ n: number }>();
    expect(reviews?.n).toBe(0);
  });
});

describe("the public dictionary", () => {
  it("lists and finds words, each saying it isn't reviewed yet", async () => {
    const home = await (await visit("/vosa")).text();
    expect(home).toContain("Words A to Z");
    expect(home).toContain("0<!-- --> reviewed");
    const found = await (await visit("/vosa?q=bait")).text();
    expect(found).toContain('href="/vosa/baca"');
    expect(found).toContain("Not reviewed yet");
  });

  it("shows a headword with each of its meanings, its sources and a way to correct it", async () => {
    const response = await visit("/vosa/baca");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Bait put on a fishhook or in a fishing trap.");
    expect(html).toContain("Not reviewed yet");
    expect(html).toContain("Sources and review");
    expect(html).toContain('href="/forms/correct-word?word=Baca"');
    expect((await visit("/vosa/not-a-fijian-word")).status).toBe(404);
  });

  it("keeps words apart that differ only by a macron or a hyphen", async () => {
    expect((await visit("/vosa/v%C5%ABt%C5%AB")).status).toBe(200);
    expect((await visit("/vosa/vutu")).status).toBe(200);
    expect((await visit("/vosa/vaka-")).status).toBe(200);
  });

  it("serves its quiz as a disclosure, with only its own script", async () => {
    const response = await visit("/vosa/durusau");
    const html = await response.text();
    expect(html).toContain('class="vosa-quiz-answer"');
    expect(html).toContain('src="/vosa/quiz.js"');
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src 'self'");
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
  });

  it("is where the apps preview's dictionary now sends people, except Vakavanua and Icavuti", async () => {
    const moved = await visit("/apps/dictionary/");
    expect(moved.status).toBe(301);
    expect(moved.headers.get("Location")).toBe("/vosa");
    expect((await visit("/apps/dictionary/?view=icavuti")).status).toBe(200);
    expect((await visit("/apps/dictionary/?view=culture")).status).toBe(200);
  });

  it("is in the sitemap, word by word", async () => {
    const sitemap = await (await visit("/sitemap.xml")).text();
    expect(sitemap).toContain("/vosa/baca</loc>");
  });
});

describe("an Expression through its language review", () => {
  it("starts as a suggestion, is approved, and is a draft again once its wording changes", async () => {
    await addStaff(EDITOR, ["editor"]);
    await addStaff(REVIEWER, ["reviewer"], "standard-fijian");
    const suggestion = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO submission (id, form, fields, notice_version) VALUES (?, 'suggest-word', ?, '2026-11-v1')",
    )
      .bind(suggestion, JSON.stringify({ word: "vakarorogo", meaning: "To listen carefully." }))
      .run();

    const draft = await (await as(EDITOR, `/admin/expressions/new?submission=${suggestion}`)).text();
    expect(draft).toContain('value="vakarorogo"');
    const created = await as(EDITOR, "/admin/expressions/new", {
      headword: "vakarorogo",
      kind: "word",
      generalMeaning: "To listen carefully.",
      submission: suggestion,
    });
    expect(created.status).toBe(302);
    const id = created.headers.get("Location")?.match(/expressions\/([^?]+)/)?.[1] ?? "";
    expect(await (await visit("/vosa/vakarorogo")).text()).toContain("Not reviewed yet");

    // The editor wrote it, so only someone else may approve it, and only the wording they saw.
    const editorView = await (await as(EDITOR, `/admin/expressions/${id}`)).text();
    expect(editorView).toContain("Your roles don&#x27;t include language review.");
    expect((await as(REVIEWER, `/admin/expressions/${id}`, { intent: "approve", fingerprint: "stale" })).status).toBe(
      400,
    );
    const page = await (await as(REVIEWER, `/admin/expressions/${id}`)).text();
    const fingerprint = page.match(/name="fingerprint" value="([0-9a-f]{64})"/)?.[1] ?? "";
    expect((await as(REVIEWER, `/admin/expressions/${id}`, { intent: "approve", fingerprint })).status).toBe(302);
    expect(await (await visit("/vosa/vakarorogo")).text()).toContain("Language reviewed · Standard Fijian");

    // A change of wording makes it a draft again.
    await as(EDITOR, `/admin/expressions/${id}`, {
      headword: "vakarorogo",
      kind: "word",
      generalMeaning: "To listen carefully, attentively.",
    });
    expect(await (await visit("/vosa/vakarorogo")).text()).toContain("Not reviewed yet");

    const audit = await env.DB.prepare("SELECT action FROM audit_event WHERE subject_id = ? ORDER BY created_at, rowid")
      .bind(id)
      .all<{ action: string }>();
    expect(audit.results.map((row) => row.action)).toEqual([
      "expression.added",
      "expression.approved",
      "expression.changed",
    ]);
  });

  it("refuses an approval from a Language Reviewer of the wording they wrote", async () => {
    await addStaff("both@naisema.test", ["editor", "reviewer"], "standard-fijian");
    const created = await as("both@naisema.test", "/admin/expressions/new", {
      headword: "sautu",
      kind: "word",
      generalMeaning: "Peace and plenty.",
    });
    const id = created.headers.get("Location")?.match(/expressions\/([^?]+)/)?.[1] ?? "";
    const page = await (await as("both@naisema.test", `/admin/expressions/${id}`)).text();
    expect(page).toContain("You wrote this wording, so someone else has to review it.");
    expect(page).not.toContain('name="fingerprint"');
  });
});
