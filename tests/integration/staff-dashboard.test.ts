import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { approve, languageReviewerRole, type Staff, staff, submittedArticle } from "./support/articles";

/** The staff dashboard (#56): what needs each person's attention, by the roles they hold. */

const DAY = 86_400_000;
const home = async (who: Staff) => (await who.browser.fetch("/admin")).text();
/** The number in front of an item, or 0 where the item isn't listed. */
const count = (html: string, label: string) =>
  Number(new RegExp(`<strong>(\\d+)</strong> (?:<!-- -->)?${label}`).exec(html)?.[1] ?? 0);

/** A Video Asset whose processing failed (a ready one can't move back, so it is made as it is). */
async function failedVideoAsset(ownerId: string) {
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO media_asset (id, purpose, type, name, size, status, quarantine_key, destination_key, uploaded_by, created_at, updated_at, scanned_at)
       VALUES (?1, 'media', 'video/mp4', 'broken.mp4', 1, 'ready', ?2, ?3, ?4, 0, 0, 0)`,
    ).bind(id, `uploads/${id}`, `masters/${id}`, ownerId),
    env.DB.prepare(
      `INSERT INTO video_asset (id, owner_id, master_key, provider, state, state_reason, duration_ms, width, height, orientation, environment, created_at, updated_at)
       VALUES (?1, ?3, ?2, 'local', 'failed', 'Stream could not process it.', 1000, 720, 1280, 'portrait', 'development', 0, 0)`,
    ).bind(id, `masters/${id}`, ownerId),
  ]);
}

describe("the staff dashboard", () => {
  it("tells a reviewer what waits for them and for how long, and an educator that nothing does", async () => {
    const reviewer = await staff("reviewer", languageReviewerRole);
    const educator = await staff("educator", { role: "educator" });
    await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);

    const html = await home(reviewer);

    expect(count(html, "waiting for your review")).toBe(1);
    expect(html).toContain("The longest has been waiting since today.");
    // Nothing of an editor's is offered to a reviewer, and an educator has no queue.
    expect(count(html, "Content Items")).toBe(0);
    const educatorHtml = await home(educator);
    expect(educatorHtml).toContain("Nothing needs your attention.");
    expect(educatorHtml).not.toContain("Platform");
  });

  it("tells an editor what is waiting on a review, what is ready to publish, and which Videos failed", async () => {
    const editorView = await staff("editor", { role: "editor" });
    const before = await home(editorView);
    const reviewer = await staff("reviewer", languageReviewerRole);

    const waiting = await submittedArticle(["languageInstruction"], [{ reviewType: "language", reviewer }]);
    const ready = await submittedArticle([]);
    await failedVideoAsset(editorView.userId);
    const after = await home(editorView);

    const label = "Content Items submitted and still waiting on a review";
    expect(count(after, label)).toBe(count(before, label) + 1);
    expect(count(after, "Content Items ready to publish")).toBe(count(before, "Content Items ready to publish") + 1);
    expect(count(after, "Videos that failed processing")).toBe(count(before, "Videos that failed processing") + 1);
    // Once the review is approved, the same item is ready instead.
    await approve(reviewer, waiting.article.id, 1, "language");
    const approved = await home(editorView);
    expect(count(approved, label)).toBe(count(before, label));
    expect(count(approved, "Content Items ready to publish")).toBe(count(before, "Content Items ready to publish") + 2);
    void ready;
  });

  it("counts Submissions past their due date and due soon, for those who manage them", async () => {
    const editor = await staff("editor", { role: "editor" });
    const reviewer = await staff("reviewer", languageReviewerRole);
    const before = await home(editor);
    const dueOn = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
    for (const [index, due] of [-3, 1, 20].entries()) {
      await env.DB.prepare(
        `INSERT INTO submission (id, type, form_key, name, email, fields, due_on, received_at, updated_at)
         VALUES (?1, 'enquiry', ?2, 'Someone', 'someone@example.test', '{}', ?3, 0, 0)`,
      )
        .bind(`dash-sub-${crypto.randomUUID()}`, `dash-key-${index}-${crypto.randomUUID()}`, dueOn(due))
        .run();
    }

    const after = await home(editor);

    expect(count(after, "Submissions past their due date")).toBe(count(before, "Submissions past their due date") + 1);
    expect(count(after, "Submissions due in the next two days")).toBe(
      count(before, "Submissions due in the next two days") + 1,
    );
    expect(after).not.toContain("someone@example.test");
    expect(count(await home(reviewer), "Submissions")).toBe(0);
  });

  it("gives the case team a count of Cases not yet triaged, with no detail and no audit trail", async () => {
    const lead = await staff("safeguarding", { role: "safeguarding_lead" });
    const editor = await staff("editor", { role: "editor" });
    const before = count(await home(lead), "Cases not yet triaged");
    await env.DB.prepare(
      `INSERT INTO case_record (id, kind, reason, details, reporter_name, reporter_email, received_at, updated_at)
       VALUES (?1, 'report', 'Unsafe', 'A detail only the case team may read', 'Reporter Name', 'reporter@example.test', ?2, ?2)`,
    )
      .bind(crypto.randomUUID(), Date.now() - 3 * DAY)
      .run();

    const html = await home(lead);

    expect(count(html, "Cases not yet triaged")).toBe(before + 1);
    expect(html).toContain("The longest has been waiting 3 days.");
    for (const secret of ["A detail only the case team may read", "Reporter Name", "reporter@example.test"]) {
      expect(html).not.toContain(secret);
    }
    const viewed = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM audit_event WHERE action = 'case.queue_viewed' AND actor_id = ?1",
    )
      .bind(lead.userId)
      .first<{ n: number }>();
    expect(viewed?.n).toBe(0);
    // An editor doesn't handle Cases, so never sees the count.
    expect(count(await home(editor), "Cases not yet triaged")).toBe(0);
  });

  it("shows only administrators the platform's state: monitoring and the last backup", async () => {
    const administrator = await staff("admin", { role: "administrator" });
    const editor = await staff("editor", { role: "editor" });

    const first = await home(administrator);
    await env.DB.prepare("INSERT INTO job_run (id, job, started_at, finished_at, ok) VALUES (?1, 'backup', ?2, ?2, 1)")
      .bind(crypto.randomUUID(), Date.now() - 5 * 3_600_000)
      .run();
    await env.DB.prepare(
      "INSERT INTO monitor_alert (`check`, failing_since, last_alerted_at, summary) VALUES ('errors', ?1, ?1, '12 of 40 requests failed.')",
    )
      .bind(Date.now())
      .run();
    const second = await home(administrator);

    expect(first).toContain("No backup has run yet.");
    expect(first).toContain("No problems are being reported.");
    expect(second).toContain("The last backup succeeded 5 hours ago.");
    expect(second).toContain("12 of 40 requests failed.");
    expect(second).toContain("Needs attention.");
    expect(await home(editor)).not.toContain("12 of 40 requests failed.");
    expect(await home(editor)).not.toContain("backup");
  });
});
