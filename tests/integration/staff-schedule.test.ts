import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { fijiToday } from "~/lib/calendar";
import { createArticle, languageReviewerRole, staff, submittedArticle } from "./support/articles";
import { recordRights } from "./support/rights";

/** "What's coming up" (#59): what is due and what is waiting, for the roles a person holds. */

const DAY = 86_400_000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);
const dayIn = (days: number) => fijiToday(inDays(days));
type Who = Awaited<ReturnType<typeof staff>>;

// React puts a comment between text and the values inside it; the reader never sees them.
const schedule = async (who: Who, query = "") =>
  (await (await who.browser.fetch(`/admin/schedule${query}`)).text()).replaceAll("<!-- -->", "");
const main = (html: string) => html.slice(html.indexOf("<main"));
const rows = (html: string) =>
  [
    ...main(html).matchAll(/<th scope="row"><a href="([^"]+)">([^<]*)<\/a><\/th><td>([^<]*)<\/td><td>([^<]*)<\/td>/g),
  ].map(([, href, title, detail, when]) => ({ href, title, detail, when }));
const hrefs = (html: string) => rows(html).map((row) => row.href);

async function addSubmission(fields: { dueOn: string; status?: string; name?: string; email?: string; type?: string }) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO submission (id, type, form_key, name, email, fields, status, due_on, received_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, '{}', ?6, ?7, ?8, ?8)",
  )
    .bind(
      id,
      fields.type ?? "contribution",
      crypto.randomUUID(),
      fields.name ?? "Secret Sender",
      fields.email ?? "secret.sender@example.com",
      fields.status ?? "new",
      fields.dueOn,
      Date.now() - 2 * DAY,
    )
    .run();
  return id;
}

async function addCase(kind: string, receivedDaysAgo: number, state = "received") {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO case_record (id, kind, state, reason, details, affected_person, reporter_name, received_at, updated_at) VALUES (?1, ?2, ?3, 'Hidden reason', 'Hidden details', 'Hidden Person', 'Hidden Reporter', ?4, ?4)",
  )
    .bind(id, kind, state, Date.now() - receivedDaysAgo * DAY)
    .run();
  return id;
}

describe("what's coming up: Rights Records", () => {
  it("lists a Rights Record about to expire with its day, linked to the page that renews it, and respects the range", async () => {
    const editor = await staff("editor", { role: "editor" });
    const soon = await createArticle(editor, { title: `Soon ${crypto.randomUUID().slice(0, 6)}` });
    const later = await createArticle(editor, { title: `Later ${crypto.randomUUID().slice(0, 6)}` });
    await recordRights(editor.browser, soon.id, { expiresOn: dayIn(10) });
    await recordRights(editor.browser, later.id, { expiresOn: dayIn(60) });

    const thirty = await schedule(editor);
    const ninety = await schedule(editor, "?days=90");

    expect(hrefs(thirty)).toContain(`/admin/articles/${soon.id}/rights`);
    expect(hrefs(thirty)).not.toContain(`/admin/articles/${later.id}/rights`);
    expect(hrefs(ninety)).toEqual(
      expect.arrayContaining([`/admin/articles/${soon.id}/rights`, `/admin/articles/${later.id}/rights`]),
    );
    const entry = rows(thirty).find((row) => row.href === `/admin/articles/${soon.id}/rights`);
    expect(entry?.when).toMatch(/^due in 10 days \(\w+day,? \d+ \w+ 2026\)$/);
    expect(entry?.detail).toContain("Rights Record from Sera Vula expires on");
  });

  it("is not shown to someone who may not manage rights", async () => {
    const reviewer = await staff("reviewer", languageReviewerRole);

    expect(main(await schedule(reviewer))).not.toContain("Rights Record");
  });
});

describe("what's coming up: Submissions", () => {
  it("lists overdue Submissions first, then those coming up, soonest first, without who sent them", async () => {
    const editor = await staff("editor", { role: "editor" });
    const overdue = await addSubmission({ dueOn: dayIn(-3) });
    const soon = await addSubmission({ dueOn: dayIn(5) });
    const far = await addSubmission({ dueOn: dayIn(40) });
    const closed = await addSubmission({ dueOn: dayIn(-9), status: "closed" });

    const html = await schedule(editor);
    const list = hrefs(html);

    expect(list.indexOf(`/admin/submissions/${overdue}`)).toBeGreaterThan(-1);
    expect(list.indexOf(`/admin/submissions/${overdue}`)).toBeLessThan(list.indexOf(`/admin/submissions/${soon}`));
    expect(list).not.toContain(`/admin/submissions/${far}`);
    expect(list).not.toContain(`/admin/submissions/${closed}`);
    expect(rows(html).find((row) => row.href === `/admin/submissions/${overdue}`)?.when).toMatch(/^overdue by 3 days/);
    expect(rows(html).find((row) => row.href === `/admin/submissions/${soon}`)?.when).toMatch(/^due in 5 days/);
    expect(html).not.toContain("Secret Sender");
    expect(html).not.toContain("secret.sender@example.com");
    expect(hrefs(await schedule(editor, "?days=90"))).toContain(`/admin/submissions/${far}`);
  });
});

describe("what's coming up: Cases", () => {
  it("shows each case team only the Cases it handles, by how long they have waited, with no detail", async () => {
    const lead = await staff("lead", { role: "safeguarding_lead" });
    const privacy = await staff("privacy", { role: "privacy_contact" });
    const editor = await staff("editor", { role: "editor" });
    const report = await addCase("report", 6);
    const rights = await addCase("rights_concern", 2);
    const request = await addCase("data_request", 4);
    const triaged = await addCase("report", 9, "triaged");
    const appeal = await addCase("report", 12, "appealed");

    const leadHtml = await schedule(lead);
    const privacyHtml = await schedule(privacy);
    const editorHtml = await schedule(editor);

    expect(hrefs(leadHtml)).toEqual(
      expect.arrayContaining([`/admin/cases/${report}`, `/admin/cases/${rights}`, `/admin/cases/${appeal}`]),
    );
    expect(hrefs(leadHtml)).not.toContain(`/admin/cases/${request}`);
    expect(hrefs(leadHtml)).not.toContain(`/admin/cases/${triaged}`);
    expect(hrefs(privacyHtml)).toContain(`/admin/cases/${request}`);
    expect(hrefs(privacyHtml)).not.toContain(`/admin/cases/${report}`);
    expect(hrefs(editorHtml).filter((href) => href.startsWith("/admin/cases/"))).toEqual([]);
    for (const html of [leadHtml, privacyHtml]) {
      expect(html).not.toMatch(/Hidden (reason|details|Person|Reporter)/);
    }
    const waiting = rows(leadHtml).filter((row) => row.href.startsWith("/admin/cases/"));
    expect(waiting.map((row) => row.href).indexOf(`/admin/cases/${appeal}`)).toBeLessThan(
      waiting.map((row) => row.href).indexOf(`/admin/cases/${report}`),
    );
    expect(waiting.find((row) => row.href === `/admin/cases/${appeal}`)?.detail).toBe("Appeal waiting for a decision");
    expect(waiting.find((row) => row.href === `/admin/cases/${report}`)?.when).toBe("waiting 6 days");
  });
});

describe("what's coming up: reviews", () => {
  it("shows a reviewer what waits for them and an editor everything waiting on a review, longest first", async () => {
    const reviewer = await staff("lang-reviewer", languageReviewerRole);
    const { editor, article: older } = await submittedArticle(
      ["languageInstruction"],
      [{ reviewType: "language", reviewer }],
    );
    const { article: newer } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);
    await env.DB.prepare(
      "UPDATE revision_submission SET submitted_at = ?1 WHERE revision_id IN (SELECT id FROM revision WHERE content_item_id = ?2)",
    )
      .bind(Date.now() - 8 * DAY, older.id)
      .run();

    const mine = await schedule(reviewer);
    const everything = await schedule(editor);

    expect(hrefs(mine)).toEqual([`/admin/articles/${older.id}/revisions/1`, `/admin/articles/${newer.id}/revisions/1`]);
    expect(rows(mine)[0].detail).toBe("Waiting for your language review");
    expect(rows(mine)[0].when).toBe("waiting 8 days");
    expect(hrefs(everything)).toEqual(
      expect.arrayContaining([`/admin/articles/${older.id}/revisions/1`, `/admin/articles/${newer.id}/revisions/1`]),
    );
    const editorsRow = rows(everything).find((row) => row.href === `/admin/articles/${older.id}/revisions/1`);
    expect(editorsRow?.detail).toBe("Waiting on Language review (standard-fijian)");
  });

  it("gives a person who is both an editor and the reviewer one line with both wordings", async () => {
    const both = await staff("both", { role: "editor" }, languageReviewerRole);
    const { article } = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer: both }]);

    const entry = rows(await schedule(both)).filter((row) => row.href === `/admin/articles/${article.id}/revisions/1`);

    expect(entry).toHaveLength(1);
    expect(entry[0].detail).toBe("Waiting for your language review. Waiting on Language review (standard-fijian)");
  });

  it("says plainly that nothing is on the schedule, with a way to look further ahead", async () => {
    const reviewer = await staff("lang-reviewer", languageReviewerRole);

    const html = main(await schedule(reviewer));

    expect(html).toContain("Nothing is due in the next 30 days, nothing is overdue and nothing is waiting.");
    expect(html).toContain("Choose a longer range");
    expect(html).toContain('<option value="30" selected="">30 days</option>');
  });
});

describe("what's coming up: who sees what", () => {
  it("tells someone whose roles handle none of it so, and leaves it out of their navigation", async () => {
    const educator = await staff("educator", { role: "educator" });

    const html = await schedule(educator);

    expect(main(html)).toContain("Nothing on this page is handled by your roles.");
    expect(html).not.toContain('href="/admin/schedule"');
  });

  it("lists, for each person, the kinds of thing their page covers", async () => {
    const lead = await staff("lead", { role: "safeguarding_lead" });

    const html = main(await schedule(lead));

    expect(html).toContain("Cases waiting to be triaged or to have an appeal decided");
    expect(html).not.toContain("Submission due dates");
  });

  it("needs a staff sign-in", async () => {
    const response = await (await import("cloudflare:test")).SELF.fetch("http://admin.localhost/admin/schedule", {
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("/admin/sign-in");
  });

  it("falls back to 30 days for a range it does not offer", async () => {
    const editor = await staff("editor", { role: "editor" });

    expect(main(await schedule(editor, "?days=1000"))).toContain('<option value="30" selected="">30 days</option>');
  });
});
