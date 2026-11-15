import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * The sound guide (docs/change-notes/0003-pronunciation-sound-guide.md), against the built Worker:
 * the imported letters, the public pronunciation page built from them, a Language Reviewer's
 * approval and what clears it, and a library recording playing only while its own rights allow.
 */

const ADMIN = "http://admin.localhost";
const PUBLIC = "http://localhost";
const PAGE = "/apps/dictionary/pronunciation/";

const EDITOR = "sound-editor@naisema.test";
const REVIEWER = "sound-reviewer@naisema.test";
const OTHER_REVIEWER = "other-variety-reviewer@naisema.test";
const EDUCATOR = "sound-educator@naisema.test";

async function addStaff(email: string, roles: string[], variety: string | null = null) {
  await env.DB.prepare("INSERT OR REPLACE INTO staff (email, name, roles, language_variety) VALUES (?, ?, ?, ?)")
    .bind(email, email.split("@")[0], JSON.stringify(roles), variety)
    .run();
}

function as(email: string, path: string, form?: Record<string, string | string[]>, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("X-Dev-Staff-Email", email);
  let body: URLSearchParams | undefined;
  if (form) {
    body = new URLSearchParams();
    for (const [key, value] of Object.entries(form)) for (const one of [value].flat()) body.append(key, one);
    headers.set("Content-Type", "application/x-www-form-urlencoded");
    headers.set("Origin", ADMIN);
  }
  return SELF.fetch(`${ADMIN}${path}`, {
    ...init,
    method: form ? "POST" : init.method,
    body,
    headers,
    redirect: "manual",
  });
}

const visit = (path: string, init: RequestInit = {}) => SELF.fetch(`${PUBLIC}${path}`, { redirect: "manual", ...init });
const publicPage = async () => (await visit(PAGE)).text();
const count = async (query: string) => ((await env.DB.prepare(query).first()) as { n: number }).n;

/** The fingerprint the reviewer's form names, which is what the page showed when they read it. */
async function fingerprintOn(email: string, id: string) {
  const html = await (await as(email, `/admin/sounds/${id}`)).text();
  const match = /name="fingerprint" value="([0-9a-f]{64})"/.exec(html);
  expect(match, "the approve form").toBeTruthy();
  return match?.[1] as string;
}

/** The tile for one letter, so one letter's state can be read without the rest of the page. */
const tileFor = (html: string, letter: string) =>
  new RegExp(`<li[^>]*id="${letter}"[\\s\\S]*?</li>`).exec(html)?.[0] ?? "";

beforeAll(async () => {
  await addStaff(EDITOR, ["editor"]);
  await addStaff(REVIEWER, ["reviewer"], "standard-fijian");
  await addStaff(OTHER_REVIEWER, ["reviewer"], "samoan");
  await addStaff(EDUCATOR, ["educator"]);
});

describe("the imported sound guide", () => {
  it("holds every entry of the pronunciation preview, none of them reviewed", async () => {
    expect(await count("SELECT count(*) AS n FROM sound")).toBe(24);
    expect(await count("SELECT count(*) AS n FROM sound WHERE sound_group = 'vowel'")).toBe(5);
    expect(await count("SELECT count(*) AS n FROM sound WHERE sound_group = 'consonant'")).toBe(18);
    expect(await count("SELECT count(*) AS n FROM sound WHERE sound_group = 'label'")).toBe(1);
    expect(await count("SELECT count(*) AS n FROM sound_approval")).toBe(0);
    const q = (await env.DB.prepare("SELECT ipa, english_comparison FROM sound WHERE letter = 'Q'").first()) as {
      ipa: string;
      english_comparison: string;
    };
    expect(q).toEqual({ ipa: "ᵑɡ", english_comparison: "ng-g in finger" });
  });
});

describe("the public pronunciation page", () => {
  it("lists every letter with its own audio control, so it works without JavaScript", async () => {
    const html = await publicPage();
    for (const letter of "ABCDEFGIJKLMNOPQRSTUVWY".split("")) {
      const tile = tileFor(html, letter);
      expect(tile, letter).toContain(`data-letter="${letter}"`);
      expect(tile, letter).toContain(
        `<audio class="native-audio" controls="" preload="none" src="/apps/dictionary/pronunciation/audio/${letter}.mp3"`,
      );
      expect(tile, letter).toContain("Not reviewed yet");
    }
    expect(tileFor(html, "Dz")).toContain("Dz");
    expect(html).toContain("Recording under review");
    expect(html).toContain("23 letters · 23 recordings");
    expect(html).toContain("0 of 24 sounds have been reviewed");
    expect(html).toContain("/ᵑɡ/");
  });

  it("keeps its address, and the letter links that pointed into it", async () => {
    const response = await visit(PAGE);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('href="#Q"');
    expect((await visit("/apps/dictionary/pronunciation")).status).toBe(301);
  });
});

describe("staff and the sound guide", () => {
  it("is for editors and Language Reviewers only", async () => {
    expect((await as(EDUCATOR, "/admin/sounds")).status).toBe(403);
    expect((await as(EDUCATOR, "/admin/sounds/standard-fijian-a")).status).toBe(403);
    expect((await as(EDITOR, "/admin/sounds")).status).toBe(200);
    expect((await as(REVIEWER, "/admin/sounds/standard-fijian-a")).status).toBe(200);
    expect((await as(EDITOR, "/admin/sounds/not-a-sound")).status).toBe(404);
  });

  it("changes a sound's wording, which an editor alone may do", async () => {
    const edit = (email: string, note: string) =>
      as(email, "/admin/sounds/standard-fijian-a", {
        intent: "save",
        ipa: "a",
        englishComparison: "a in father",
        note,
        mediaId: "",
      });
    expect((await edit(REVIEWER, "A reviewer cannot edit.")).status).toBe(403);
    expect((await edit(EDITOR, "")).status).toBe(400);
    const saved = await edit(EDITOR, "An open vowel. Keep the jaw open, the tongue low.");
    expect(saved.status).toBe(302);
    expect(await publicPage()).toContain("Keep the jaw open, the tongue low.");
    const logged = await count(
      "SELECT count(*) AS n FROM audit_event WHERE action = 'sound.edited' AND subject_id = 'standard-fijian-a'",
    );
    expect(logged).toBe(1);
  });

  it("is reviewed by someone who listened, only for their own Language Variety, and never by whoever last changed it", async () => {
    const id = "standard-fijian-a";
    const fingerprint = await fingerprintOn(REVIEWER, id);
    const approve = (email: string, form: Record<string, string>) =>
      as(email, `/admin/sounds/${id}`, { intent: "approve", notes: "", ...form });

    expect((await approve(REVIEWER, { fingerprint })).status).toBe(400); // did not say they listened
    expect((await approve(OTHER_REVIEWER, { fingerprint, listened: "on" })).status).toBe(403);
    expect((await approve(EDITOR, { fingerprint, listened: "on" })).status).toBe(403); // not a reviewer
    expect((await approve(REVIEWER, { fingerprint: "0".repeat(64), listened: "on" })).status).toBe(409);
    expect(await count("SELECT count(*) AS n FROM sound_approval")).toBe(0);

    expect((await approve(REVIEWER, { fingerprint, listened: "on", notes: "Listened to it twice." })).status).toBe(302);
    const html = await publicPage();
    expect(tileFor(html, "A")).toMatch(/Language reviewed · Fijian · \d{1,2} \w+ 2026/);
    expect(tileFor(html, "B")).toContain("Not reviewed yet");
    expect(html).toContain("1 of 24 sounds have been reviewed");

    // The approval named this wording. Changing it makes the sound a draft again.
    await as(EDITOR, `/admin/sounds/${id}`, {
      intent: "save",
      ipa: "a",
      englishComparison: "a in father",
      note: "A reworded note.",
      mediaId: "",
    });
    expect(tileFor(await publicPage(), "A")).toContain("Not reviewed yet");
    // The reviewer sees the old approval no longer counts, and can approve what is there now.
    const page = await (await as(REVIEWER, `/admin/sounds/${id}`)).text();
    expect(page).toContain("approved earlier wording, no longer counts");
    const next = await fingerprintOn(REVIEWER, id);
    expect(next).not.toBe(fingerprint);
  });

  it("will not let the person who last changed a sound approve it", async () => {
    await addStaff("editor-reviewer@naisema.test", ["editor", "reviewer"], "standard-fijian");
    const who = "editor-reviewer@naisema.test";
    await as(who, "/admin/sounds/standard-fijian-b", {
      intent: "save",
      ipa: "ᵐb",
      englishComparison: "mb in amber",
      note: "Changed by someone who is also a reviewer.",
      mediaId: "",
    });
    const html = await (await as(who, "/admin/sounds/standard-fijian-b")).text();
    expect(html).not.toContain('name="fingerprint"');
    const response = await as(who, "/admin/sounds/standard-fijian-b", {
      intent: "approve",
      fingerprint: "0".repeat(64),
      listened: "on",
      notes: "",
    });
    expect(response.status).toBe(403);
  });
});

describe("a recording from the media library", () => {
  const MEDIA = "sound-test-recording-0001";
  const BYTES = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6]);

  beforeAll(async () => {
    await env.MEDIA.put(`media/${MEDIA}`, BYTES, { httpMetadata: { contentType: "audio/mpeg" } });
    await env.DB.prepare(
      "INSERT INTO media (id, kind, key, content_type, bytes, filename, duration_ms, uploaded_by) VALUES (?, 'audio', ?, 'audio/mpeg', ?, 'C.mp3', 4600, ?)",
    )
      .bind(MEDIA, `media/${MEDIA}`, BYTES.length, EDITOR)
      .run();
  });

  const attach = (mediaId: string) =>
    as(EDITOR, "/admin/sounds/standard-fijian-c", {
      intent: "save",
      ipa: "ð",
      englishComparison: "th in this",
      note: "A voiced th sound, not the th of thin.",
      mediaId,
    });

  it("only attaches audio that is in the library", async () => {
    expect((await attach("no-such-file")).status).toBe(400);
    expect((await attach(MEDIA)).status).toBe(302);
  });

  it("does not play on the public page until its own Rights Record grants Publish", async () => {
    const before = await publicPage();
    expect(tileFor(before, "C")).toContain("This recording isn&#x27;t available right now.");
    expect(tileFor(before, "C")).not.toContain("<audio");
    expect((await visit(`/media/files/${MEDIA}`)).status).toBe(404);

    const rights = await as(EDITOR, `/admin/rights/media/${MEDIA}`, {
      intent: "add",
      holder: "A NAISEMA team member",
      uses: ["publish"],
    });
    expect(rights.status).toBe(302);
    const after = await publicPage();
    expect(tileFor(after, "C")).toContain(`src="/media/files/${MEDIA}"`);
    const audio = await visit(`/media/files/${MEDIA}`);
    expect(audio.status).toBe(200);
    expect(audio.headers.get("Content-Type")).toBe("audio/mpeg");
  });

  it("stops playing the moment its Rights Record is withdrawn", async () => {
    const record = (await env.DB.prepare("SELECT id FROM rights_record WHERE subject_id = ?").bind(MEDIA).first()) as {
      id: string;
    };
    const withdrawn = await as(EDITOR, `/admin/rights/media/${MEDIA}`, {
      intent: "withdraw",
      recordId: record.id,
      reason: "The speaker asked for it to come down.",
    });
    expect(withdrawn.status).toBe(302);
    expect(tileFor(await publicPage(), "C")).toContain("This recording isn&#x27;t available right now.");
    expect((await visit(`/media/files/${MEDIA}`)).status).toBe(404);
  });

  it("makes a reviewed sound a draft again when its recording changes", async () => {
    const id = "standard-fijian-c";
    const fingerprint = await fingerprintOn(REVIEWER, id);
    await as(REVIEWER, `/admin/sounds/${id}`, { intent: "approve", fingerprint, listened: "on", notes: "" });
    expect(tileFor(await publicPage(), "C")).toContain("Language reviewed");
    await attach(""); // back to the preview's own file
    expect(tileFor(await publicPage(), "C")).toContain("Not reviewed yet");
  });
});
