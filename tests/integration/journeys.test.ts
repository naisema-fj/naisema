import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * The v1 journeys end to end, against the built Worker: the staff gate, an Article through review
 * to the public site and back off it, the public forms, and a Video with its Learning Layer.
 * In development the X-Dev-Staff-Email header stands in for a signed-in session (app/lib/staff.server.ts);
 * the sign-in link itself has its own journey below.
 */

const ADMIN = "http://admin.localhost";
const PUBLIC = "http://localhost";

const EDITOR = "editor@naisema.test";
const SECOND_EDITOR = "second-editor@naisema.test";
const REVIEWER = "reviewer@naisema.test";
const EDUCATOR = "educator@naisema.test";
const SAFEGUARDING = "safeguarding@naisema.test";

async function addStaff(email: string, roles: string[], variety: string | null = null) {
  await env.DB.prepare("INSERT OR REPLACE INTO staff (email, name, roles, language_variety) VALUES (?, ?, ?, ?)")
    .bind(email, email.split("@")[0], JSON.stringify(roles), variety)
    .run();
}

/** A request as one signed-in staff member. */
function as(email: string | null, path: string, init: RequestInit & { form?: Record<string, string | string[]> } = {}) {
  const headers = new Headers(init.headers);
  if (email) headers.set("X-Dev-Staff-Email", email);
  let body = init.body;
  if (init.form) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(init.form)) for (const one of [value].flat()) params.append(key, one);
    body = params;
    headers.set("Content-Type", "application/x-www-form-urlencoded");
  }
  if (init.form || init.method === "PUT") headers.set("Origin", ADMIN);
  return SELF.fetch(`${ADMIN}${path}`, {
    ...init,
    method: init.form ? "POST" : init.method,
    body,
    headers,
    redirect: "manual",
  });
}

async function hash(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const visit = (path: string, init: RequestInit = {}) => SELF.fetch(`${PUBLIC}${path}`, { redirect: "manual", ...init });

const one = async <T>(query: string, ...values: unknown[]) =>
  (await env.DB.prepare(query)
    .bind(...values)
    .first()) as T;

const BODY = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Talanoa about the reef." }] }],
});

async function createItem(email: string, kindPlace: string, title: string) {
  const response = await as(email, "/admin/items", { form: { kindPlace, title } });
  expect(response.status).toBe(302);
  return (response.headers.get("Location") as string).split("/").at(-1) as string;
}

const latestRevision = (itemId: string) =>
  one<{ id: string; number: number }>(
    "SELECT id, number FROM revision WHERE item_id = ? ORDER BY number DESC LIMIT 1",
    itemId,
  );

async function save(email: string, itemId: string, fields: Record<string, string | string[]> = {}) {
  const base = await latestRevision(itemId);
  return as(email, `/admin/items/${itemId}`, {
    form: { intent: "save", baseRevisionId: base.id, summary: "A summary.", credit: "NAISEMA", body: BODY, ...fields },
  });
}

async function review(email: string, itemId: string, type: string, extra: Record<string, string> = {}) {
  const revision = await latestRevision(itemId);
  return as(email, `/admin/items/${itemId}`, {
    form: { intent: "review", revisionId: revision.id, type, decision: "approved", notes: "", ...extra },
  });
}

const addRights = (email: string, type: "item" | "media", id: string, uses: string[]) =>
  as(email, `/admin/rights/${type}/${id}`, { form: { intent: "add", holder: "Mere Tuilagi", uses } });

async function publish(email: string, itemId: string) {
  const revision = await latestRevision(itemId);
  return as(email, `/admin/items/${itemId}`, { form: { intent: "publish", revisionId: revision.id } });
}

beforeAll(async () => {
  await addStaff(EDITOR, ["editor", "admin"]);
  await addStaff(SECOND_EDITOR, ["editor"]);
  await addStaff(REVIEWER, ["reviewer"], "standard-fijian");
  await addStaff(EDUCATOR, ["educator"]);
  await addStaff(SAFEGUARDING, ["safeguarding"]);
});

describe("the staff site", () => {
  it("is only for people on the staff list, and only on the admin host", async () => {
    for (const who of [null, "stranger@example.org"]) {
      const response = await as(who, "/admin/items");
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/admin/sign-in");
    }
    expect((await as(EDITOR, "/admin")).status).toBe(200);
    expect((await visit("/admin")).status).toBe(404);
    expect((await visit("/Admin/items")).status).toBe(404);
  });

  it("signs staff in with an emailed link that works once, and signs them out", async () => {
    const ask = (email: string) =>
      SELF.fetch(`${ADMIN}/admin/sign-in`, {
        method: "POST",
        headers: {
          Origin: ADMIN,
          "Content-Type": "application/x-www-form-urlencoded",
          "CF-Connecting-IP": `10.1.0.${Math.floor(Math.random() * 250)}`,
        },
        body: new URLSearchParams({ email }),
      });
    // Someone not on the staff list is told the same thing, and no link is made for them.
    const stranger = await (await ask("stranger@example.org")).text();
    expect(stranger).toContain("Check your email");
    expect(stranger).not.toContain("open the sign-in link");

    // In development nothing is sent, so the page shows the link instead.
    const page = await (await ask("Second-Editor@naisema.test")).text();
    const link = /href="(http:\/\/admin\.localhost\/admin\/sign-in\/link\?token=[\w-]+)"/.exec(page)?.[1];
    expect(link).toBeTruthy();
    const token = new URL(link as string).searchParams.get("token") as string;
    const stored = await one<{ token_hash: string }>(
      "SELECT token_hash FROM sign_in_link WHERE email = ?",
      SECOND_EDITOR,
    );
    expect(stored.token_hash).not.toContain(token);

    // Opening the link only shows a button, so a mail scanner opening it doesn't use it up.
    expect(await (await SELF.fetch(link as string)).text()).toContain("Sign in");
    const use = () =>
      SELF.fetch(`${ADMIN}/admin/sign-in/link`, {
        method: "POST",
        headers: { Origin: ADMIN, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
        redirect: "manual",
      });
    const signedIn = await use();
    expect(signedIn.status).toBe(302);
    const cookie = (signedIn.headers.get("Set-Cookie") as string).split(";")[0];
    expect(signedIn.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect((await use()).status).toBe(400);

    const withCookie = (path: string, init: RequestInit = {}) =>
      SELF.fetch(`${ADMIN}${path}`, {
        ...init,
        headers: { ...init.headers, Cookie: cookie, Origin: ADMIN },
        redirect: "manual",
      });
    expect((await withCookie("/admin/items")).status).toBe(200);
    const out = await withCookie("/admin/sign-out", { method: "POST" });
    expect(out.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect((await withCookie("/admin/items")).status).toBe(302);
  });

  it("signs someone out everywhere when they leave the staff list", async () => {
    await addStaff("leaving@naisema.test", ["editor"]);
    await env.DB.prepare("INSERT INTO sign_in_link (token_hash, email, expires_at) VALUES (?, ?, ?)")
      .bind(await hash("leaving-token"), "leaving@naisema.test", Date.now() + 60_000)
      .run();
    const signedIn = await SELF.fetch(`${ADMIN}/admin/sign-in/link`, {
      method: "POST",
      headers: { Origin: ADMIN, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: "leaving-token" }),
      redirect: "manual",
    });
    const cookie = (signedIn.headers.get("Set-Cookie") as string).split(";")[0];
    const items = () => SELF.fetch(`${ADMIN}/admin/items`, { headers: { Cookie: cookie }, redirect: "manual" });
    expect((await items()).status).toBe(200);
    await as(EDITOR, "/admin/staff", {
      form: { email: "leaving@naisema.test", name: "Leaving", roles: ["editor"], active: "off" },
    });
    expect((await items()).status).toBe(302);
  });

  it("refuses a change sent from another site", async () => {
    const response = await SELF.fetch(`${ADMIN}/admin/items`, {
      method: "POST",
      headers: {
        "X-Dev-Staff-Email": EDITOR,
        Origin: "https://evil.example",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "kindPlace=article%7Cezine&title=Nope",
    });
    expect(response.status).toBe(403);
  });

  it("keeps each role to its own pages", async () => {
    expect((await as(REVIEWER, "/admin/items")).status).toBe(403);
    expect((await as(EDUCATOR, "/admin/staff")).status).toBe(403);
    expect((await as(EDITOR, "/admin/staff")).status).toBe(200);
  });
});

describe("an Article", () => {
  it("is public only once reviewed by someone else and its rights are recorded, and leaves when they lapse", async () => {
    const id = await createItem(EDITOR, "article|ezine", "The reef at Beqa");
    expect((await save(EDITOR, id, { title: "The reef at Beqa" })).status).toBe(302);
    const slug = (await one<{ slug: string }>("SELECT slug FROM content_item WHERE id = ?", id)).slug;

    const early = await publish(EDITOR, id);
    expect(early.status).toBe(400);
    expect(await early.text()).toContain("It needs editorial review.");

    // The author can't approve their own version.
    expect((await review(EDITOR, id, "editorial")).status).toBe(403);
    expect((await review(SECOND_EDITOR, id, "editorial")).status).toBe(302);
    expect((await publish(EDITOR, id)).status).toBe(400);

    expect((await addRights(EDITOR, "item", id, ["publish"])).status).toBe(302);
    expect((await publish(EDITOR, id)).status).toBe(302);

    const page = await visit(`/ezine/${slug}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("The reef at Beqa");
    expect(html).toContain("Talanoa about the reef.");
    expect(html).not.toContain("<script");
    expect(await (await visit("/search?q=reef")).text()).toContain(`/ezine/${slug}`);
    expect(await (await visit("/sitemap.xml")).text()).toContain(`/ezine/${slug}`);

    // An edit after publishing leaves the published version up until the new one is reviewed.
    expect((await save(EDITOR, id, { title: "The reef at Beqa, again" })).status).toBe(302);
    expect(await (await visit(`/ezine/${slug}`)).text()).toContain("The reef at Beqa");

    // Withdrawing the right takes it down on the next request.
    const record = await one<{ id: string }>("SELECT id FROM rights_record WHERE subject_id = ?", id);
    await as(EDITOR, `/admin/rights/item/${id}`, {
      form: { intent: "withdraw", recordId: record.id, reason: "Asked to" },
    });
    expect((await visit(`/ezine/${slug}`)).status).toBe(410);
    expect(await (await visit("/search?q=reef")).text()).not.toContain(`/ezine/${slug}`);

    const events = await env.DB.prepare("SELECT action FROM audit_event WHERE subject_id = ? ORDER BY created_at")
      .bind(id)
      .all();
    expect(events.results.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        "item.created",
        "revision.saved",
        "review.approved",
        "item.published",
        "rights.withdrawn",
      ]),
    );
  });

  it("can't be changed once its Revisions are written", async () => {
    const id = await createItem(EDITOR, "article|discover", "Write-once");
    const revision = await latestRevision(id);
    await expect(
      env.DB.prepare("UPDATE revision SET title = 'Changed' WHERE id = ?").bind(revision.id).run(),
    ).rejects.toThrow();
    await expect(env.DB.prepare("DELETE FROM audit_event").run()).rejects.toThrow();
  });
});

describe("public forms", () => {
  it("store what was sent, then only the people handling that form can read it", async () => {
    const send = (form: string, fields: Record<string, string>) =>
      visit(`/forms/${form}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "CF-Connecting-IP": `10.0.0.${Math.floor(Math.random() * 250)}`,
        },
        body: new URLSearchParams({ "cf-turnstile-response": "test-token", notice: "2026-11-v1", ...fields }),
      });
    const refused = await send("enquiry", { message: "Bula" });
    expect(refused.status).toBe(400);
    const sent = await send("enquiry", { name: "Mere", email: "mere@example.org", message: "Bula, a question." });
    expect(sent.status).toBe(200);
    expect(await sent.text()).toContain("Thank you");
    expect((await send("report", { address: "/ezine/x", message: "This uses my photo." })).status).toBe(200);

    const enquiry = await one<{ id: string; notice_version: string }>(
      "SELECT id, notice_version FROM submission WHERE form = 'enquiry'",
    );
    const report = await one<{ id: string }>("SELECT id FROM submission WHERE form = 'report'");
    expect(enquiry.notice_version).toBe("2026-11-v1");
    expect((await as(EDITOR, `/admin/submissions/${enquiry.id}`)).status).toBe(200);
    expect((await as(SECOND_EDITOR, `/admin/submissions/${report.id}`)).status).toBe(404);
    expect((await as(SAFEGUARDING, `/admin/submissions/${report.id}`)).status).toBe(200);
  });
});

describe("a Video and its Learning Layer", () => {
  const SEGMENT = "6f1c2a7e-1111-4a5b-8c9d-000000000001";
  const ACTIVITY = "0b7c8d9e-2222-4a5b-8c9d-000000000001";
  // An MP4's first bytes ("ftyp", brand "isom"), enough for the content check and byte ranges.
  const clip = new Uint8Array(4096);
  clip.set([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypisom")]);

  it("plays its Learning Layer once language-reviewed, with English only in the stages that show it", async () => {
    const upload = await as(EDUCATOR, "/admin/media/upload?name=market.mp4&durationMs=10000&width=720&height=1280", {
      method: "PUT",
      body: clip,
      headers: { "Content-Type": "video/mp4", "Content-Length": String(clip.length) },
    });
    expect(upload.status).toBe(200);
    const { id: mediaId } = (await upload.json()) as { id: string };

    const renamed = new Uint8Array(clip.length).fill(0x4d);
    const refused = await as(EDUCATOR, "/admin/media/upload?name=fake.mp4", {
      method: "PUT",
      body: renamed,
      headers: { "Content-Type": "video/mp4", "Content-Length": String(renamed.length) },
    });
    expect(refused.status).toBe(415);

    const id = await createItem(EDUCATOR, "video|learn", "At the market");
    expect((await save(EDUCATOR, id, { title: "At the market", "field-videoMediaId": mediaId })).status).toBe(302);
    const base = await latestRevision(id);
    const layer = await as(EDUCATOR, `/admin/items/${id}/layer`, {
      form: {
        intent: "save",
        baseRevisionId: base.id,
        title: "Greetings at the market",
        level: "beginner",
        clip: "whole",
        sourceStart: "",
        sourceEnd: "",
        segments: JSON.stringify([
          {
            id: SEGMENT,
            startMs: 0,
            endMs: 2000,
            speaker: "Mere",
            fijian: "Bula vinaka",
            english: "Hello there",
            tokens: [],
          },
        ]),
        annotations: "[]",
        notes: "[]",
        newExpressions: "[]",
        activities: JSON.stringify([
          {
            id: ACTIVITY,
            kind: "comprehension",
            segmentId: SEGMENT,
            prompt: "What does Mere say?",
            options: [
              { id: "0b7c8d9e-2222-4a5b-8c9d-000000000011", text: "Hello", correct: true },
              { id: "0b7c8d9e-2222-4a5b-8c9d-000000000012", text: "Goodbye", correct: false },
            ],
            modelResponse: "",
            feedback: "Bula vinaka is a greeting.",
            pronunciation: "",
            required: true,
            textAlternative: "Read line 1, then choose what it means.",
          },
        ]),
      },
    });
    expect(layer.status).toBe(302);

    // Educators author; they can't publish.
    expect((await publish(EDUCATOR, id)).status).toBe(403);
    expect((await review(EDITOR, id, "editorial")).status).toBe(302);
    expect((await review(REVIEWER, id, "language")).status).toBe(302);
    await addRights(EDITOR, "item", id, ["publish"]);
    const missing = await publish(EDITOR, id);
    expect(await missing.text()).toContain("No Rights Record for the item grants Translate.");
    await addRights(EDITOR, "item", id, ["publish", "translate", "transcribe", "educationalAdaptation"]);
    await addRights(EDITOR, "media", mediaId, ["publish"]);
    expect((await publish(EDITOR, id)).status).toBe(302);

    const slug = (await one<{ slug: string }>("SELECT slug FROM content_item WHERE id = ?", id)).slug;
    const story = await (await visit(`/learn/${slug}`)).text();
    expect(story).toContain(`/learn/${slug}/language`);
    expect(story).toContain("Language reviewed · Standard Fijian");

    const watch = await (await visit(`/learn/${slug}/language?stage=watch`)).text();
    expect(watch).toContain("Bula vinaka");
    expect(watch).not.toContain("Hello there");
    expect(watch).not.toContain("captions/english");
    const support = await (await visit(`/learn/${slug}/language?stage=support`)).text();
    expect(support).toContain("Hello there");

    const captions = await visit(`/videos/${id}/captions/english`);
    expect(captions.headers.get("Content-Type")).toContain("text/vtt");
    expect(await captions.text()).toContain("Hello there");
    expect(await (await visit(`/videos/${id}/english/${SEGMENT}`)).json()).toEqual({ english: "Hello there" });

    const ranged = await visit(`/media/files/${mediaId}`, { headers: { Range: "bytes=0-99" } });
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get("Content-Range")).toBe(`bytes 0-99/${clip.length}`);
    expect((await ranged.arrayBuffer()).byteLength).toBe(100);

    // Its footage's right withdrawn, the Video and its player go at once.
    const footageRight = await one<{ id: string }>("SELECT id FROM rights_record WHERE subject_id = ?", mediaId);
    await as(EDITOR, `/admin/rights/media/${mediaId}`, {
      form: { intent: "withdraw", recordId: footageRight.id, reason: "Ended" },
    });
    expect((await visit(`/learn/${slug}/language`)).status).toBe(410);
    expect((await visit(`/media/files/${mediaId}`)).status).toBe(404);
  });
});

describe("the health check", () => {
  it("answers from the database, never from a cache", async () => {
    const response = await visit("/health");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("ok");
  });
});

describe("the guide to using NAISEMA", () => {
  it("tells a first-time visitor the areas and all eight steps, in the player's own words, without needing JavaScript", async () => {
    const response = await visit("/how-it-works");
    expect(response.status).toBe(200);
    const page = await response.text();
    expect(page).toContain("How NAISEMA works");
    for (const area of ["Learn", "Voices", "Discover", "Connect", "E-zine", "Resources"]) expect(page).toContain(area);
    // The steps are the player's own text, so the two can't disagree.
    for (const step of ["Watch naturally", "Fijian captions", "Explore the words", "Use it with someone"])
      expect(page).toContain(step);
    expect(page).toContain("Your progress stays on your device");
    // Plain server-rendered words: no script of its own.
    expect(page).not.toMatch(/<script[^>]*src=["'][^"']*how-it-works/);

    // It is found from the home page, the footer and the sitemap.
    expect(await (await visit("/")).text()).toContain('href="/how-it-works"');
    expect(await (await visit("/sitemap.xml")).text()).toContain("/how-it-works");
  });
});

describe("help on the staff site", () => {
  const page = async (email: string, path: string) => {
    const response = await as(email, path);
    expect(response.status, path).toBe(200);
    return response.text();
  };

  it("explains each page where the work is done", async () => {
    const article = await createItem(EDITOR, "article|ezine", "Help article");
    const video = await createItem(EDITOR, "video|learn", "Help video");
    const expected: [string, string][] = [
      ["/admin", "How this page works"],
      ["/admin/items", "How adding and editing works"],
      [`/admin/items/${article}`, "What do the flags do?"],
      [`/admin/items/${article}`, "What does this mean?"],
      [`/admin/items/${video}/layer`, "How this editor works"],
      [`/admin/rights/item/${article}`, "What are Rights Records?"],
      ["/admin/media", "Preparing and using files"],
      ["/admin/topics", "What are Topics?"],
      ["/admin/submissions", "Who sees what"],
      ["/admin/staff", "What do the roles allow?"],
      ["/admin/audit", "What is this?"],
    ];
    for (const [path, summary] of expected) expect(await page(EDITOR, path), path).toContain(summary);
  });

  it("tells each person what their own roles allow, and no one else's", async () => {
    const educator = await page(EDUCATOR, "/admin");
    expect(educator).toContain("Writes Videos and their Learning Layers");
    expect(educator).toContain("Never publishes");
    expect(educator).not.toContain("only person who reads reports");
    expect(await page(SAFEGUARDING, "/admin")).toContain("only person who reads reports");
  });

  it("explains every permitted use beside the rights form", async () => {
    const article = await createItem(EDITOR, "article|ezine", "Rights help article");
    const rights = await page(EDITOR, `/admin/rights/item/${article}`);
    for (const meaning of [
      "Show it on NAISEMA",
      "Use just a part of it",
      "Turn it into teaching material",
      "train AI systems",
    ])
      expect(rights).toContain(meaning);
  });
});
