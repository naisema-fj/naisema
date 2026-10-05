import { describe, expect, it } from "vitest";
import type { Activity } from "~/lib/activities";
import {
  activityFingerprint,
  inactivityStep,
  MAX_EVENTS_PER_BATCH,
  progressForRevision,
  readProgressBatch,
  resumeAt,
  retryDelay,
  withQueued,
} from "~/lib/learner-progress";

const id = () => crypto.randomUUID();

const activity = (activityId: string, change: Partial<Activity> = {}): Activity => ({
  id: activityId,
  kind: "comprehension",
  segmentId: null,
  prompt: "Who is speaking?",
  options: [
    { id: "a", text: "A grandmother", correct: true },
    { id: "b", text: "A child", correct: false },
  ],
  modelResponse: "",
  feedback: "She greets the visitors.",
  pronunciation: "",
  required: true,
  textAlternative: "",
  ...change,
});

describe("reading a batch of progress events", () => {
  it("reads each kind of event the player queues", () => {
    const events = [
      { id: id(), type: "position", layerId: "l", revisionId: "r", stage: "words", positionMs: 1500, segmentId: "s1" },
      {
        id: id(),
        type: "captions",
        layerId: "l",
        revisionId: "r",
        stage: "watch",
        taught: true,
        english: false,
        underAlways: false,
      },
      { id: id(), type: "preferences", speed: 0.75, textRoute: true, alwaysCaptions: false },
      { id: id(), type: "attempt", layerId: "l", revisionId: "r", activityId: "a1", correct: false },
      { id: id(), type: "attempt", layerId: "l", revisionId: "r", activityId: "a2", correct: null },
      { id: id(), type: "real-world", layerId: "l", revisionId: "r", activityId: "a3", choice: "tried" },
      { id: id(), type: "save-video", contentItemId: "c" },
      { id: id(), type: "unsave-video", contentItemId: "c" },
      { id: id(), type: "save-word", layerId: "l", revisionId: "r", expressionId: "e" },
      { id: id(), type: "unsave-word", revisionId: "r", expressionId: "e" },
    ];

    const read = readProgressBatch(events);

    expect(read?.malformed).toEqual([]);
    expect(read?.events).toEqual(events);
  });

  it("refuses something that isn't a list of events, or too many at once", () => {
    expect(readProgressBatch({ id: id() })).toBeNull();
    expect(readProgressBatch("[]")).toBeNull();
    const many = Array.from({ length: MAX_EVENTS_PER_BATCH + 1 }, () => ({
      id: id(),
      type: "save-video",
      contentItemId: "c",
    }));
    expect(readProgressBatch(many)).toBeNull();
  });

  it("names malformed events by their ID, so they can be dropped, and skips any without an ID", () => {
    const good = { id: id(), type: "save-video", contentItemId: "c" };
    const unknown = { id: id(), type: "share-with-friends", contentItemId: "c" };
    const badStage = { id: id(), type: "position", layerId: "l", revisionId: "r", stage: "x", positionMs: 0 };
    const badSpeed = { id: id(), type: "preferences", speed: 2, textRoute: false, alwaysCaptions: false };
    const badChoice = {
      id: id(),
      type: "real-world",
      layerId: "l",
      revisionId: "r",
      activityId: "a",
      choice: "posted",
    };
    const negative = {
      id: id(),
      type: "position",
      layerId: "l",
      revisionId: "r",
      stage: "watch",
      positionMs: -1,
      segmentId: null,
    };

    const read = readProgressBatch([good, unknown, badStage, badSpeed, badChoice, negative, { type: "save-video" }]);

    expect(read?.events).toEqual([good]);
    expect(read?.malformed).toEqual([unknown.id, badStage.id, badSpeed.id, badChoice.id, negative.id]);
  });

  it("takes only UUIDs as event IDs, and nothing beyond each kind's own fields", () => {
    const read = readProgressBatch([
      { id: "not-a-uuid", type: "save-video", contentItemId: "c" },
      { id: id(), type: "save-video", contentItemId: "c", note: "my private thoughts" },
    ]);
    expect(read?.events).toHaveLength(1);
    expect(read?.events[0]).not.toHaveProperty("note");
  });

  it("refuses overlong IDs", () => {
    const event = { id: id(), type: "save-video", contentItemId: "c".repeat(65) };
    expect(readProgressBatch([event])?.malformed).toEqual([event.id]);
  });
});

describe("an Activity's fingerprint", () => {
  it("changes when what the learner answered changes, but not when only whether it is required does", async () => {
    const base = await activityFingerprint(activity("a1"));

    expect(await activityFingerprint(activity("a1", { required: false }))).toBe(base);
    expect(await activityFingerprint(activity("a1", { prompt: "Who is greeting?" }))).not.toBe(base);
    expect(
      await activityFingerprint(
        activity("a1", {
          options: [
            { id: "a", text: "A grandmother", correct: false },
            { id: "b", text: "A child", correct: true },
          ],
        }),
      ),
    ).not.toBe(base);
  });
});

describe("progress on the published Revision (ADR-0006)", () => {
  const at = (minutes: number) => new Date(Date.UTC(2026, 9, 5, 9, minutes));

  it("counts attempts at Activities unchanged since they were made, and the latest answer's correctness", async () => {
    const a1 = activity("a1");
    const a2 = activity("a2", { kind: "real-world", required: false });
    const fingerprints = { a1: await activityFingerprint(a1), a2: await activityFingerprint(a2) };

    const result = progressForRevision({
      activities: [a1, a2],
      fingerprints,
      attempts: [
        { activityId: "a1", activityFingerprint: fingerprints.a1, correct: false, attemptedAt: at(1) },
        { activityId: "a1", activityFingerprint: fingerprints.a1, correct: true, attemptedAt: at(2) },
      ],
      visited: ["watch", "respond"],
      realWorld: { a2: "later" },
    });

    expect(result.progress).toEqual({
      visited: ["watch", "respond"],
      activities: { a1: { attempted: true, feedbackViewed: true, correct: true } },
      realWorld: { a2: "later" },
    });
    expect(result.earlier).toEqual([]);
  });

  it("keeps an attempt at a changed or removed Activity as done on an earlier version", async () => {
    const changed = activity("a1", { prompt: "A new question" });
    const old = await activityFingerprint(activity("a1"));
    const kept = activity("a2");
    const keptPrint = await activityFingerprint(kept);

    const result = progressForRevision({
      activities: [changed, kept],
      fingerprints: { a1: await activityFingerprint(changed), a2: keptPrint },
      attempts: [
        { activityId: "a1", activityFingerprint: old, correct: true, attemptedAt: at(1) },
        { activityId: "a2", activityFingerprint: keptPrint, correct: null, attemptedAt: at(1) },
        { activityId: "gone", activityFingerprint: "x", correct: true, attemptedAt: at(1) },
      ],
      visited: [],
      realWorld: { gone: "tried" },
    });

    expect(Object.keys(result.progress.activities)).toEqual(["a2"]);
    expect(result.earlier).toEqual(["a1", "gone"]);
    // A real-world choice for an Activity that is no longer there isn't shown.
    expect(result.progress.realWorld).toEqual({});
  });

  it("doesn't call an Activity done on an earlier version once it is done on this one", async () => {
    const changed = activity("a1", { prompt: "A new question" });
    const now = await activityFingerprint(changed);
    const result = progressForRevision({
      activities: [changed],
      fingerprints: { a1: now },
      attempts: [
        { activityId: "a1", activityFingerprint: "old", correct: true, attemptedAt: at(1) },
        { activityId: "a1", activityFingerprint: now, correct: false, attemptedAt: at(2) },
      ],
      visited: [],
      realWorld: {},
    });
    expect(result.earlier).toEqual([]);
    expect(result.progress.activities.a1?.correct).toBe(false);
  });
});

describe("where a learner carries on from", () => {
  const segments = [
    { id: "s1", startMs: 0, endMs: 2_000 },
    { id: "s2", startMs: 2_000, endMs: 5_000 },
  ];

  it("is the exact position on the same Revision", () => {
    expect(resumeAt({ revisionId: "r1", positionMs: 3_200, segmentId: "s2" }, "r1", segments)).toBe(3_200);
  });

  it("is the start of the same Segment on a new Revision, while it is still there", () => {
    const moved = [{ id: "s2", startMs: 1_000, endMs: 4_000 }];
    expect(resumeAt({ revisionId: "r1", positionMs: 3_200, segmentId: "s2" }, "r2", moved)).toBe(1_000);
    expect(resumeAt({ revisionId: "r1", positionMs: 3_200, segmentId: "s9" }, "r2", segments)).toBeNull();
    expect(resumeAt({ revisionId: "r1", positionMs: 3_200, segmentId: null }, "r2", segments)).toBeNull();
  });

  it("is nowhere when they hadn't started", () => {
    expect(resumeAt({ revisionId: "r1", positionMs: 0, segmentId: "s1" }, "r1", segments)).toBeNull();
  });
});

describe("inactive Learner Accounts", () => {
  const DAY = 86_400_000;
  const now = new Date(Date.UTC(2028, 9, 5));
  const daysAgo = (days: number) => new Date(now.getTime() - days * DAY);

  it("are warned 30 days before 24 months without activity", () => {
    expect(inactivityStep({ lastActiveAt: daysAgo(699), inactivityWarnedAt: null }, now)).toBe("none");
    expect(inactivityStep({ lastActiveAt: daysAgo(700), inactivityWarnedAt: null }, now)).toBe("warn");
  });

  it("are deleted 30 days after the warning, unless they came back", () => {
    expect(inactivityStep({ lastActiveAt: daysAgo(729), inactivityWarnedAt: daysAgo(29) }, now)).toBe("none");
    expect(inactivityStep({ lastActiveAt: daysAgo(730), inactivityWarnedAt: daysAgo(30) }, now)).toBe("delete");
    // They signed in after the warning: the warning no longer stands.
    expect(inactivityStep({ lastActiveAt: daysAgo(10), inactivityWarnedAt: daysAgo(30) }, now)).toBe("none");
  });
});

describe("the progress queue", () => {
  it("waits longer after each failed send, up to a minute", () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(retryDelay)).toEqual([2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000]);
  });

  it("shows what is queued but not yet sent on top of what the server last said", () => {
    const shown = withQueued(
      {
        progress: { visited: ["watch"], activities: {}, realWorld: {} },
        captions: {},
        preferences: { speed: 1, textRoute: false, alwaysCaptions: false },
        savedWords: ["e1", "e2"],
        videoSaved: false,
      },
      [
        { id: id(), type: "attempt", layerId: "l", revisionId: "r", activityId: "a1", correct: true },
        { id: id(), type: "attempt", layerId: "other", revisionId: "x", activityId: "a9", correct: true },
        { id: id(), type: "attempt", layerId: "l", revisionId: "old", activityId: "a2", correct: true },
        { id: id(), type: "real-world", layerId: "l", revisionId: "r", activityId: "a3", choice: "tried" },
        { id: id(), type: "position", layerId: "l", revisionId: "r", stage: "respond", positionMs: 0, segmentId: null },
        {
          id: id(),
          type: "captions",
          layerId: "l",
          revisionId: "r",
          stage: "watch",
          taught: true,
          english: false,
          underAlways: false,
        },
        { id: id(), type: "preferences", speed: 0.5, textRoute: true, alwaysCaptions: false },
        { id: id(), type: "save-video", contentItemId: "c" },
        { id: id(), type: "unsave-word", revisionId: null, expressionId: "e1" },
        { id: id(), type: "save-word", layerId: "l", revisionId: "r", expressionId: "e3" },
      ],
      { layerId: "l", revisionId: "r", contentItemId: "c" },
    );

    expect(shown.progress).toEqual({
      visited: ["watch", "respond"],
      activities: { a1: { attempted: true, feedbackViewed: true, correct: true } },
      realWorld: { a3: "tried" },
    });
    expect(shown.captions).toEqual({ watch: { taught: true, english: false, underAlways: false } });
    expect(shown.preferences).toEqual({ speed: 0.5, textRoute: true, alwaysCaptions: false });
    expect(shown.videoSaved).toBe(true);
    expect(shown.savedWords).toEqual(["e2", "e3"]);
  });
});
