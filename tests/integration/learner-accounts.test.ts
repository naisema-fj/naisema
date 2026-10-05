import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { handleInactiveLearners } from "~/lib/learner-records.server";
import {
  approvedLayer,
  layerRow,
  publishChange,
  publishedLayer,
  publishVideo,
  save,
  videoPath,
} from "./support/layers";
import { ADMIN, Browser, emailsTo, seedStaff, signInWithMagicLink } from "./support/staff";

const PUBLIC = "https://naisema.test";
const DAY = 86_400_000;
const TURNSTILE = { "cf-turnstile-response": "XXXX.DUMMY.TOKEN.XXXX" };

const unique = (name: string) => `${name}-${crypto.randomUUID()}@naisema.test`;
const linkIn = (text: string | undefined) => text?.match(/https?:\/\/\S+/)?.[0];

const askForLink = (browser: Browser, email: string, adult = true) =>
  browser.fetch(`${PUBLIC}/account/sign-in`, { form: { email, ...(adult ? { adult: "yes" } : {}), ...TURNSTILE } });

/** Signs up through the sign-in form and the emailed link, as a person would. */
async function signUp(email = unique("learner")) {
  const browser = new Browser();
  await askForLink(browser, email);
  const link = linkIn((await emailsTo(email)).at(-1)?.text);
  if (!link) throw new Error(`No sign-in link emailed to ${email}`);
  const opened = await browser.fetch(link);
  const userId = (
    (await env.DB.prepare("SELECT id FROM user WHERE email = ?1").bind(email).first<{ id: string }>()) as { id: string }
  ).id;
  return { browser, email, userId, opened };
}

type Learner = Awaited<ReturnType<typeof signUp>>;

const sendEvents = (learner: Pick<Learner, "browser">, events: unknown[], origin = PUBLIC) =>
  learner.browser.fetch(`${PUBLIC}/account/events`, {
    method: "POST",
    body: JSON.stringify(events),
    headers: { Origin: origin, "Content-Type": "application/json" },
  });

const event = (fields: Record<string, unknown>) => ({ id: crypto.randomUUID(), ...fields });

const snapshotOf = async (revisionId: string) =>
  JSON.parse(
    (
      (await env.DB.prepare("SELECT snapshot FROM learning_layer_revision WHERE id = ?1")
        .bind(revisionId)
        .first<{ snapshot: string }>()) as { snapshot: string }
    ).snapshot,
  ) as {
    segments: { id: string; tokens: { id: string }[] }[];
    activities: { id: string; prompt: string }[];
    expressions: Record<string, { headword: string }>;
  };

const publishedRevision = async (layerId: string) => (await layerRow(layerId))?.publishedId as string;

const count = async (table: string, userId: string) =>
  (
    (await env.DB.prepare(`SELECT count(*) AS n FROM ${table} WHERE user_id = ?1`)
      .bind(userId)
      .first<{ n: number }>()) as { n: number }
  ).n;

describe("signing up for a Learner Account", () => {
  it("sends a link only to someone who declares they are 18 or older, and the link makes the account", async () => {
    const email = unique("adult");
    const refused = await askForLink(new Browser(), email, false);
    expect(refused.status).toBe(400);
    expect(await refused.text()).toContain("aged 18 or older");
    expect(await emailsTo(email)).toEqual([]);

    const { browser, userId, opened } = await signUp(email);

    const [sent] = await emailsTo(email);
    expect(sent.subject).toBe("Your Na iSema sign-in link");
    expect(linkIn(sent.text)).toMatch(/^https:\/\/naisema\.test\/account\/auth\/magic-link\/verify\?token=/);
    expect(opened.status).toBe(302);
    expect(opened.headers.get("Location")).toBe(`${PUBLIC}/account?welcome=1`);
    const account = await env.DB.prepare("SELECT adult_declared_at AS declared FROM learner_account WHERE user_id = ?1")
      .bind(userId)
      .first<{ declared: number }>();
    expect(account?.declared).toBeGreaterThan(0);
    // The link's token is stored only as a hash, marked as a learner's.
    const tokens = await env.DB.prepare("SELECT identifier FROM verification WHERE instr(value, ?1) > 0")
      .bind(email)
      .all<{ identifier: string }>();
    for (const { identifier } of tokens.results) expect(identifier).toMatch(/^learner:[0-9a-f]{64}$/);

    const page = await browser.fetch(`${PUBLIC}/account?welcome=1`);
    expect(page.status).toBe(200);
    expect(page.headers.get("Cache-Control")).toBe("private, no-store");
    const html = await page.text();
    expect(html).toContain("Your learning");
    expect(html).toContain(email);
    expect(html).toContain("your account is ready");
  });

  it("signs an existing learner in with the same form, without a second account", async () => {
    const { email, userId } = await signUp();
    const again = await signUp(email);
    expect(again.userId).toBe(userId);
    expect((await again.browser.fetch(`${PUBLIC}/account`)).status).toBe(200);
  });

  it("tells a staff address by email to use another, and never opens a learner session for it", async () => {
    const email = unique("staff");
    await seedStaff(email, [{ role: "editor" }]);

    const reply = await askForLink(new Browser(), email);

    expect(await reply.text()).toContain("Check your email");
    const [sent] = await emailsTo(email);
    expect(sent.subject).toBe("Signing in to Na iSema");
    expect(sent.text).toContain("staff account");
    expect(linkIn(sent.text)).toBeUndefined();

    // A staff member's own link can't open a learner session on the public site.
    const staffBrowser = new Browser();
    await staffBrowser.fetch("/admin/sign-in", { form: { email } });
    const staffLink = new URL(linkIn((await emailsTo(email)).at(-1)?.text) as string);
    const browser = new Browser();
    await browser.fetch(`${PUBLIC}/account/auth/magic-link/verify${staffLink.search}`);
    expect((await browser.fetch(`${PUBLIC}/account`)).headers.get("Location")).toBe("/account/sign-in");
    // And it still works where it belongs.
    expect((await signInWithMagicLink(staffBrowser, email)).status).toBe(302);
  });

  it("never lets a learner's link open a staff session", async () => {
    const email = unique("crossing");
    const browser = new Browser();
    await askForLink(browser, email);
    const learnerLink = new URL(linkIn((await emailsTo(email)).at(-1)?.text) as string);

    const admin = new Browser();
    await admin.fetch(`${ADMIN}/api/auth/magic-link/verify${learnerLink.search}`);

    expect((await admin.fetch("/admin")).headers.get("Location")).toBe("/admin/sign-in");
  });

  it("counts learners' sign-ins apart from staff members', so learners can't use up staff limits", async () => {
    const ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
    // As many learner links opened from one address as Better Auth allows a minute (5); counted
    // together, the staff member's link would be the sixth, and refused.
    for (let i = 0; i < 5; i++) {
      const browser = new Browser();
      browser.ip = ip;
      const email = unique(`busy-${i}`);
      await askForLink(browser, email);
      await browser.fetch(linkIn((await emailsTo(email)).at(-1)?.text) as string);
    }
    const staffEmail = unique("staff-same-address");
    await seedStaff(staffEmail, [{ role: "editor" }]);
    const staffBrowser = new Browser();
    staffBrowser.ip = ip;

    const opened = await signInWithMagicLink(staffBrowser, staffEmail);

    expect(opened.status).toBe(302);
    expect(opened.headers.get("Location")).toBe(`${ADMIN}/admin`);
  });

  it("refuses a learner whose address was later given a staff role", async () => {
    const { browser, userId } = await signUp();
    await env.DB.prepare(
      "INSERT INTO role_assignment (id, user_id, role, granted_by, granted_at) VALUES (?1, ?2, 'editor', 'test', ?3)",
    )
      .bind(crypto.randomUUID(), userId, Date.now())
      .run();
    expect((await browser.fetch(`${PUBLIC}/account`)).headers.get("Location")).toBe("/account/sign-in");
  });

  it("sends no more than three links in 15 minutes to one address", async () => {
    const email = unique("flood");
    for (let i = 0; i < 5; i++) {
      expect(await (await askForLink(new Browser(), email)).text()).toContain("Check your email");
    }
    expect(await emailsTo(email)).toHaveLength(3);
  });

  it("exposes nothing of Better Auth on the public site but the emailed link", async () => {
    const browser = new Browser();
    for (const [method, path] of [
      ["POST", "/account/auth/sign-in/magic-link"],
      ["GET", "/account/auth/get-session"],
      ["POST", "/account/auth/sign-out"],
      ["GET", "/Account/Auth/get-session"],
    ]) {
      const response = await browser.fetch(`${PUBLIC}${path}`, { method, headers: { Origin: PUBLIC } });
      expect(response.status, path).toBe(404);
    }
  });

  it("sends visitors without an account to sign in, and keeps the sign-in page out of caches", async () => {
    const response = await new Browser().fetch(`${PUBLIC}/account`);
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/account/sign-in");
    const signIn = await new Browser().fetch(`${PUBLIC}/account/sign-in`);
    expect(signIn.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await signIn.text()).toContain("I am 18 or older");
  });

  it("signs out only by a form post from this site", async () => {
    const { browser } = await signUp();
    expect((await browser.fetch(`${PUBLIC}/account/sign-out`)).status).toBe(405);
    const crossSite = await browser.fetch(`${PUBLIC}/account/sign-out`, {
      form: {},
      headers: { Origin: "https://attacker.example" },
    });
    expect(crossSite.status).toBe(403);
    expect((await browser.fetch(`${PUBLIC}/account`)).status).toBe(200);

    const out = await browser.fetch(`${PUBLIC}/account/sign-out`, { form: {} });
    expect(out.status).toBe(302);
    expect((await browser.fetch(`${PUBLIC}/account`)).headers.get("Location")).toBe("/account/sign-in");
  });
});

describe("a learner's progress events", () => {
  it("applies a batch in order, acknowledges a retry without applying it again, and refuses what can't apply", async () => {
    const { layerId, videoId } = await publishedLayer();
    const revisionId = await publishedRevision(layerId);
    const { segments, activities } = await snapshotOf(revisionId);
    const learner = await signUp();
    const onLayer = { layerId, revisionId };
    const batch = [
      event({ type: "position", ...onLayer, stage: "words", positionMs: 1_500, segmentId: segments[0].id }),
      event({ type: "attempt", ...onLayer, activityId: activities[0].id, correct: true }),
      event({ type: "save-video", contentItemId: videoId }),
      event({ type: "preferences", speed: 0.75, textRoute: true, alwaysCaptions: false }),
      event({ type: "attempt", ...onLayer, activityId: "not-in-this-revision", correct: true }),
      event({ type: "save-video", contentItemId: crypto.randomUUID() }),
      event({
        type: "position",
        layerId: crypto.randomUUID(),
        revisionId,
        stage: "watch",
        positionMs: 0,
        segmentId: null,
      }),
      event({ type: "position", ...onLayer, stage: "nowhere", positionMs: 0, segmentId: null }),
    ];

    const response = await sendEvents(learner, batch);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = (await response.json()) as { acknowledged: string[]; refused: string[] };
    expect(new Set(body.acknowledged)).toEqual(new Set(batch.map((sent) => sent.id)));
    expect(new Set(body.refused)).toEqual(new Set(batch.slice(4).map((sent) => sent.id)));
    const state = await env.DB.prepare(
      "SELECT stage, position_ms AS positionMs, completed_revision_id AS completedOn FROM learner_video_state WHERE user_id = ?1",
    )
      .bind(learner.userId)
      .first();
    expect(state).toEqual({ stage: "words", positionMs: 1_500, completedOn: revisionId });
    expect(await count("activity_attempt", learner.userId)).toBe(1);
    expect(await count("bookmark", learner.userId)).toBe(1);

    // The same events again, as a retry after a lost answer, change nothing.
    await sendEvents(learner, [
      event({ type: "position", ...onLayer, stage: "respond", positionMs: 0, segmentId: null }),
    ]);
    const retried = (await (await sendEvents(learner, batch)).json()) as { acknowledged: string[] };
    expect(retried.acknowledged).toHaveLength(batch.length);
    expect(await count("activity_attempt", learner.userId)).toBe(1);
    expect(
      await env.DB.prepare("SELECT stage FROM learner_video_state WHERE user_id = ?1").bind(learner.userId).first(),
    ).toEqual({ stage: "respond" });
  }, 20_000);

  it("keeps the latest place received, and merges answers so none is lost", async () => {
    const { layerId } = await publishedLayer();
    const revisionId = await publishedRevision(layerId);
    const { activities } = await snapshotOf(revisionId);
    const onLayer = { layerId, revisionId };
    // Two devices: the second's older events arrive last, as from a phone back online.
    const phone = await signUp();
    const laptop = { browser: new Browser() };
    laptop.browser.cookies = new Map(phone.browser.cookies);

    await sendEvents(laptop, [
      event({ type: "attempt", ...onLayer, activityId: activities[0].id, correct: true }),
      event({ type: "position", ...onLayer, stage: "respond", positionMs: 2_000, segmentId: null }),
    ]);
    await sendEvents(phone, [
      event({ type: "attempt", ...onLayer, activityId: activities[0].id, correct: false }),
      event({ type: "position", ...onLayer, stage: "words", positionMs: 500, segmentId: null }),
    ]);

    const state = await env.DB.prepare(
      "SELECT stage, position_ms AS positionMs, completed_at IS NOT NULL AS completed FROM learner_video_state WHERE user_id = ?1",
    )
      .bind(phone.userId)
      .first();
    expect(state).toEqual({ stage: "words", positionMs: 500, completed: 1 });
    expect(await count("activity_attempt", phone.userId)).toBe(2);
  }, 20_000);

  it("takes events about an earlier published Revision, but never about a draft that wasn't public", async () => {
    const layer = await publishedLayer();
    const first = await publishedRevision(layer.layerId);
    const { activities } = await snapshotOf(first);
    await publishChange(layer, {});
    const published = await publishedRevision(layer.layerId);
    const draft = (await save(layer.educator, layer.layerId, { title: "Greetings, again" })).revisionId;
    expect(new Set([first, published, draft]).size).toBe(3);
    const learner = await signUp();
    const answer = (revisionId: string) =>
      event({ type: "attempt", layerId: layer.layerId, revisionId, activityId: activities[0].id, correct: true });
    const [onFirst, onPublished, onDraft] = [answer(first), answer(published), answer(draft)];

    const body = (await (await sendEvents(learner, [onFirst, onPublished, onDraft])).json()) as { refused: string[] };

    expect(body.refused).toEqual([onDraft.id]);
    expect(await count("activity_attempt", learner.userId)).toBe(2);
  }, 20_000);

  it("keeps caption choices only for the Revision they were made on", async () => {
    const layer = await publishedLayer();
    const first = await publishedRevision(layer.layerId);
    const learner = await signUp();
    const onFirst = { layerId: layer.layerId, revisionId: first };
    const captions = { stage: "watch", taught: true, english: false, underAlways: false };
    await sendEvents(learner, [
      event({ type: "position", ...onFirst, stage: "watch", positionMs: 0, segmentId: null }),
      event({ type: "captions", ...onFirst, ...captions }),
    ]);
    await publishChange(layer, {});
    const second = await publishedRevision(layer.layerId);
    // The device catches up: it opens the new Revision; a late choice for the old one changes nothing.
    await sendEvents(learner, [
      event({
        type: "position",
        layerId: layer.layerId,
        revisionId: second,
        stage: "words",
        positionMs: 0,
        segmentId: null,
      }),
      event({ type: "captions", ...onFirst, ...captions, stage: "words" }),
    ]);
    const state = await env.DB.prepare(
      "SELECT captions, revision_id AS revisionId FROM learner_video_state WHERE user_id = ?1",
    )
      .bind(learner.userId)
      .first();
    expect(state).toEqual({ captions: "{}", revisionId: second });
  }, 20_000);

  it("refuses events from another site, without a session, and anything but a list of events", async () => {
    const learner = await signUp();
    const save = [event({ type: "unsave-video", contentItemId: crypto.randomUUID() })];
    expect((await sendEvents(learner, save, "https://attacker.example")).status).toBe(403);
    expect((await sendEvents({ browser: new Browser() }, save)).status).toBe(401);
    const notAList = await learner.browser.fetch(`${PUBLIC}/account/events`, {
      method: "POST",
      body: "{}",
      headers: { Origin: PUBLIC },
    });
    expect(notAList.status).toBe(400);
    expect((await learner.browser.fetch(`${PUBLIC}/account/events`)).status).toBe(405);
  });
});

describe("the player for a signed-in learner", () => {
  it("starts from their account: their place, saves and progress", async () => {
    const { layerId, videoId, player } = await publishedLayer();
    const revisionId = await publishedRevision(layerId);
    const { segments } = await snapshotOf(revisionId);
    const learner = await signUp();
    await sendEvents(learner, [
      event({ type: "position", layerId, revisionId, stage: "words", positionMs: 2_500, segmentId: segments[0].id }),
      event({ type: "save-video", contentItemId: videoId }),
    ]);

    const page = await learner.browser.fetch(`${PUBLIC}${player}?stage=words`);

    expect(page.headers.get("Cache-Control")).toBe("private, no-store");
    const html = await page.text();
    expect(html).toContain("Carry on from <!-- -->0:02.500");
    // What the account holds is saved: the page says so before it has looked at the device's queue.
    expect(html).toContain("Saved to your learning");
    expect(html).toContain("goes to your account as you learn");

    const visitor = await (await new Browser().fetch(`${PUBLIC}${player}?stage=words`)).text();
    expect(visitor).not.toContain("Carry on from");
    expect(visitor).toContain("Save your learning with an optional account");
  }, 20_000);
});

describe("one learner's records", () => {
  it("can't be read or changed by another learner, whatever IDs they send", async () => {
    const { layerId, videoId } = await publishedLayer();
    const revisionId = await publishedRevision(layerId);
    const { activities } = await snapshotOf(revisionId);
    const ana = await signUp(unique("ana"));
    const ben = await signUp(unique("ben"));
    const anasAttempt = event({ type: "attempt", layerId, revisionId, activityId: activities[0].id, correct: true });
    await sendEvents(ana, [anasAttempt, event({ type: "save-video", contentItemId: videoId })]);

    // Ben sends Ana's own event ID, and removes the same video from his saves.
    const replayed = (await (await sendEvents(ben, [{ ...anasAttempt, correct: false }])).json()) as {
      refused: string[];
    };
    expect(replayed.refused).toEqual([]);
    await sendEvents(ben, [event({ type: "unsave-video", contentItemId: videoId })]);
    await ben.browser.fetch(`${PUBLIC}/account`, { form: { intent: "unsave-video", id: videoId } });

    const anas = await env.DB.prepare("SELECT correct FROM activity_attempt WHERE user_id = ?1")
      .bind(ana.userId)
      .all<{ correct: number }>();
    expect(anas.results).toEqual([{ correct: 1 }]);
    expect(await count("bookmark", ana.userId)).toBe(1);
    const bens = await env.DB.prepare("SELECT correct FROM activity_attempt WHERE user_id = ?1")
      .bind(ben.userId)
      .all<{ correct: number }>();
    expect(bens.results).toEqual([{ correct: 0 }]);

    // Neither page nor export shows him anything of hers.
    const exported = await (await ben.browser.fetch(`${PUBLIC}/account/export`)).text();
    expect(exported).not.toContain(ana.email);
    expect(exported).not.toContain(videoId);
    expect(JSON.parse(exported).answers).toHaveLength(1);
    expect(await (await ben.browser.fetch(`${PUBLIC}/account`)).text()).toContain("No saved videos");
  }, 20_000);
});

describe("the learning page", () => {
  it("lists where to carry on, the videos and words saved, and a word updated since", async () => {
    const layer = await approvedLayer();
    // Annotate the first word with a new Expression, then publish.
    const draft = await snapshotOf((await layerRow(layer.layerId))?.revisionId as string);
    const segment = draft.segments[0];
    const temporary = crypto.randomUUID();
    const annotation = {
      id: crypto.randomUUID(),
      segmentId: segment.id,
      startTokenId: segment.tokens[0].id,
      endTokenId: segment.tokens[0].id,
      expressionId: temporary,
      contextualMeaning: "hello",
      grammarNote: "",
      inVocabulary: true,
    };
    await publishChange(layer, {
      annotations: JSON.stringify([annotation]),
      newExpressions: JSON.stringify([
        {
          id: temporary,
          headword: "bula",
          generalMeaning: "life, health",
          grammarNote: "",
          pronunciation: "mbula",
          idiom: false,
          literalMeaning: "",
        },
      ]),
    });
    await publishVideo(layer.editor, layer.videoId);
    const revisionId = await publishedRevision(layer.layerId);
    const [expressionId] = Object.keys((await snapshotOf(revisionId)).expressions);
    const learner = await signUp();
    await sendEvents(learner, [
      event({ type: "position", layerId: layer.layerId, revisionId, stage: "respond", positionMs: 0, segmentId: null }),
      event({ type: "save-word", layerId: layer.layerId, revisionId, expressionId }),
      event({ type: "save-video", contentItemId: layer.videoId }),
    ]);

    let html = await (await learner.browser.fetch(`${PUBLIC}/account`)).text();
    const player = `${await videoPath(layer.videoId)}/language/${layer.layerId}`;
    expect(html).toContain(`href="${player}?stage=respond"`);
    expect(html).toContain("0 of 1 needed Activities done");
    expect(html).toContain("bula");
    expect(html).toContain("life, health");
    expect(html).not.toContain("Updated since you saved it");

    // The editor changes the Expression, and the Learning Layer is published again with it.
    const changed = await layer.editor.browser.fetch(`/admin/expressions/${expressionId}`, {
      form: { headword: "bula", generalMeaning: "life; health; hello", grammarNote: "", pronunciation: "mbula" },
    });
    expect(changed.status).toBe(302);
    await publishChange(layer, { annotations: JSON.stringify([{ ...annotation, expressionId }]) });

    html = await (await learner.browser.fetch(`${PUBLIC}/account`)).text();
    expect(html).toContain("life; health; hello");
    expect(html).toContain("Updated since you saved it");

    // Withdrawn, the Learning Layer and the word are listed as no longer available, with nothing of them.
    const { number } = (await layerRow(layer.layerId)) as { number: number };
    await layer.editor.browser.fetch(`/admin/learning-layers/${layer.layerId}/revisions/${number}`, {
      form: { intent: "withdraw" },
    });
    html = await (await learner.browser.fetch(`${PUBLIC}/account`)).text();
    expect(html).toContain("A video you were learning from is no longer available");
    expect(html).toContain("A saved word that is no longer available");
    expect(html).not.toContain("life; health; hello");
  }, 20_000);

  it("says a Learning Layer was completed on an earlier version once its Activity changes (ADR-0006)", async () => {
    const layer = await publishedLayer();
    const revisionId = await publishedRevision(layer.layerId);
    const { activities } = await snapshotOf(revisionId);
    const learner = await signUp();
    await sendEvents(learner, [
      event({ type: "attempt", layerId: layer.layerId, revisionId, activityId: activities[0].id, correct: true }),
    ]);
    expect(await (await learner.browser.fetch(`${PUBLIC}/account`)).text()).toContain("Completed.");

    const changed = JSON.parse(
      (
        await env.DB.prepare("SELECT snapshot FROM learning_layer_revision WHERE id = ?1").bind(revisionId).first<{
          snapshot: string;
        }>()
      )?.snapshot as string,
    ).activities;
    changed[0].prompt = "Who does Mere greet first?";
    await publishChange(layer, { activities: JSON.stringify(changed) });

    expect(await (await learner.browser.fetch(`${PUBLIC}/account`)).text()).toContain(
      "You completed an earlier version",
    );
    const player = await (await learner.browser.fetch(`${PUBLIC}${layer.player}?stage=respond`)).text();
    expect(player).toContain("on an earlier version");
  }, 20_000);
});

describe("a learner's data", () => {
  it("downloads as JSON with everything the account holds", async () => {
    const { layerId, videoId } = await publishedLayer();
    const revisionId = await publishedRevision(layerId);
    const learner = await signUp();
    await sendEvents(learner, [
      event({ type: "save-video", contentItemId: videoId }),
      event({ type: "real-world", layerId, revisionId, activityId: "not-real-world", choice: "tried" }),
    ]);

    const response = await learner.browser.fetch(`${PUBLIC}/account/export`);

    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment; filename="na-isema-learning-/);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const exported = (await response.json()) as Record<string, unknown>;
    expect(exported.account).toMatchObject({ email: learner.email });
    expect(exported.savedVideos).toEqual([expect.objectContaining({ contentItemId: videoId })]);
    expect((await new Browser().fetch(`${PUBLIC}/account/export`)).status).toBe(302);
  }, 20_000);

  it("clears history at once, keeping what was saved", async () => {
    const { layerId, videoId } = await publishedLayer();
    const revisionId = await publishedRevision(layerId);
    const { activities } = await snapshotOf(revisionId);
    const learner = await signUp();
    await sendEvents(learner, [
      event({ type: "attempt", layerId, revisionId, activityId: activities[0].id, correct: true }),
      event({ type: "save-video", contentItemId: videoId }),
    ]);

    const cleared = await learner.browser.fetch(`${PUBLIC}/account`, { form: { intent: "clear-history" } });

    expect(await cleared.text()).toContain("Your history is cleared");
    expect(await count("learner_video_state", learner.userId)).toBe(0);
    expect(await count("activity_attempt", learner.userId)).toBe(0);
    expect(await count("bookmark", learner.userId)).toBe(1);
  }, 20_000);

  it("deletes the account and everything in it at once, and records it in the deletion ledger", async () => {
    const { videoId } = await publishedLayer();
    const learner = await signUp();
    await sendEvents(learner, [event({ type: "save-video", contentItemId: videoId })]);

    // A sign-in link not yet used, which names the address.
    await askForLink(new Browser(), learner.email);
    const unconfirmed = await learner.browser.fetch(`${PUBLIC}/account`, { form: { intent: "delete-account" } });
    expect(unconfirmed.status).toBe(400);
    expect(await count("bookmark", learner.userId)).toBe(1);

    const deleted = await learner.browser.fetch(`${PUBLIC}/account`, {
      form: { intent: "delete-account", confirm: "yes" },
    });

    expect(deleted.status).toBe(302);
    expect(deleted.headers.get("Location")).toBe("/account/sign-in?deleted");
    expect(await (await learner.browser.fetch(`${PUBLIC}/account/sign-in?deleted`)).text()).toContain(
      "everything saved in it are deleted",
    );
    for (const table of ["bookmark", "learner_account", "session", "learner_event"]) {
      expect(await count(table, learner.userId), table).toBe(0);
    }
    expect(await env.DB.prepare("SELECT id FROM user WHERE id = ?1").bind(learner.userId).first()).toBeNull();
    expect(
      await env.DB.prepare("SELECT id FROM verification WHERE instr(value, ?1) > 0").bind(learner.email).first(),
    ).toBeNull();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(learner.userId));
    const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const ledger = await env.DB.prepare("SELECT reason FROM deletion_ledger WHERE subject_hash = ?1")
      .bind(hash)
      .first();
    expect(ledger).toEqual({ reason: "learner.deleted" });
    await expect(env.DB.prepare("UPDATE deletion_ledger SET reason = 'x'").run()).rejects.toThrow();
    await expect(env.DB.prepare("DELETE FROM deletion_ledger").run()).rejects.toThrow();
    expect((await learner.browser.fetch(`${PUBLIC}/account`)).headers.get("Location")).toBe("/account/sign-in");
  }, 20_000);
});

describe("inactive Learner Accounts", () => {
  it("are warned 30 days before two years without use, and deleted 30 days later unless used", async () => {
    const idle = await signUp(unique("idle"));
    const returning = await signUp(unique("returning"));
    const now = Date.now();
    for (const { userId } of [idle, returning]) {
      await env.DB.prepare("UPDATE learner_account SET last_active_at = ?1 WHERE user_id = ?2")
        .bind(now - 701 * DAY, userId)
        .run();
    }

    await handleInactiveLearners(env, getDb(env.DB), new Date(now));

    const [warning] = (await emailsTo(idle.email)).filter((sent) => sent.subject.includes("will be deleted"));
    expect(warning.text).toContain("in 30 days");
    expect(warning.text).toContain("/account/sign-in");
    // One of them comes back: any visit clears the warning.
    await returning.browser.fetch(`${PUBLIC}/account`);

    const later = new Date(now + 31 * DAY);
    await handleInactiveLearners(env, getDb(env.DB), later);

    expect(await env.DB.prepare("SELECT id FROM user WHERE id = ?1").bind(idle.userId).first()).toBeNull();
    expect(await count("learner_account", returning.userId)).toBe(1);
    const ledger = await env.DB.prepare("SELECT count(*) AS n FROM deletion_ledger WHERE reason = 'learner.inactive'")
      .bind()
      .first<{ n: number }>();
    expect(ledger?.n).toBeGreaterThan(0);
  });
});
