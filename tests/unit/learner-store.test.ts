import { describe, expect, it } from "vitest";
import { EMPTY_PROGRESS } from "~/lib/immersion";
import type { EventFields, LearnerLayerState, ProgressEvent } from "~/lib/learner-progress";
import { DEFAULT_PREFERENCES } from "~/lib/learner-session";
import { accountStore, type TabStorage, tabStore } from "~/lib/learner-store";
import type { Segment } from "~/lib/segment-rules";

/** The player's two learner stores, the tab's and the account's, with their storage in memory. */

const scope = { layerId: "layer-1", revisionId: "revision-2", contentItemId: "video-1" };
const onLayer = { layerId: scope.layerId, revisionId: scope.revisionId };

function memoryTab(): TabStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => void values.set(key, value) };
}

describe("the tab store, for a visitor", () => {
  it("starts empty, with no place kept, and keeps each change for the next page in the tab", async () => {
    const tab = memoryTab();
    const first = tabStore(tab, scope);
    expect(await first.load()).toEqual({
      progress: EMPTY_PROGRESS,
      captions: {},
      preferences: DEFAULT_PREFERENCES,
      savedWords: [],
      videoSaved: false,
      place: null,
    });
    // Kept at once: there is nothing to wait for.
    expect(await first.record({ type: "position", ...onLayer, stage: "watch", positionMs: 0, segmentId: null })).toBe(
      null,
    );
    await first.record({ type: "attempt", ...onLayer, activityId: "activity-1", correct: true });
    await first.record({
      type: "captions",
      ...onLayer,
      stage: "watch",
      taught: true,
      english: false,
      underAlways: false,
    });
    await first.record({ type: "preferences", speed: 0.75, textRoute: true, alwaysCaptions: false });

    const next = await tabStore(tab, scope).load();
    expect(next.progress.visited).toEqual(["watch"]);
    expect(next.progress.activities["activity-1"]).toEqual({ attempted: true, feedbackViewed: true, correct: true });
    expect(next.captions.watch).toEqual({ taught: true, english: false, underAlways: false });
    expect(next.preferences).toEqual({ speed: 0.75, textRoute: true, alwaysCaptions: false });
  });

  it("starts progress again on another Revision, keeping caption choices and preferences", async () => {
    const tab = memoryTab();
    const store = tabStore(tab, scope);
    await store.record({ type: "attempt", ...onLayer, activityId: "activity-1", correct: true });
    await store.record({
      type: "captions",
      ...onLayer,
      stage: "watch",
      taught: true,
      english: true,
      underAlways: false,
    });
    await store.record({ type: "preferences", speed: 0.5, textRoute: false, alwaysCaptions: true });

    const republished = await tabStore(tab, { ...scope, revisionId: "revision-3" }).load();
    expect(republished.progress).toEqual(EMPTY_PROGRESS);
    expect(republished.captions.watch).toEqual({ taught: true, english: true, underAlways: false });
    expect(republished.preferences.speed).toBe(0.5);
  });

  it("keeps working when the tab won't store anything", async () => {
    const broken: TabStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const store = tabStore(broken, scope);
    await store.record({ type: "attempt", ...onLayer, activityId: "activity-1", correct: false });
    expect((await store.load()).progress.activities["activity-1"]?.correct).toBe(false);
  });
});

const segments: Segment[] = [
  {
    id: "segment-1",
    startMs: 0,
    endMs: 4_000,
    speaker: "",
    fijian: "Bula",
    english: "Hello",
    overlapIntended: false,
    draft: false,
    retimed: false,
    tokens: [],
  },
  {
    id: "segment-2",
    startMs: 4_000,
    endMs: 9_000,
    speaker: "",
    fijian: "Vinaka",
    english: "Thanks",
    overlapIntended: false,
    draft: false,
    retimed: false,
    tokens: [],
  },
];

const account: LearnerLayerState = {
  progress: { visited: ["watch"], activities: {}, realWorld: {} },
  earlier: [],
  completedEarlier: false,
  captions: {},
  resumeMs: 5_000,
  preferences: DEFAULT_PREFERENCES,
  savedWords: ["expression-1"],
  videoSaved: false,
};

/** A queue holding what is still waiting on this device. */
function memoryQueue(waiting: EventFields[] = []) {
  const events = waiting.map((fields) => ({ ...fields, id: crypto.randomUUID() }) as ProgressEvent);
  return {
    events,
    pending: async () => [...events],
    add: async (fields: EventFields) => {
      const event = { ...fields, id: crypto.randomUUID() } as ProgressEvent;
      events.push(event);
      return event.id;
    },
  };
}

describe("the account store, for a signed-in learner", () => {
  it("starts from what the account holds, carrying on from the Segment it was in", async () => {
    const start = await accountStore(memoryQueue(), account, scope, segments).load();
    expect(start.progress.visited).toEqual(["watch"]);
    expect(start.savedWords).toEqual(["expression-1"]);
    expect(start.place).toEqual({ positionMs: 5_000, segmentId: "segment-2" });
  });

  it("shows changes still queued on this device on top, and the latest place queued for this Revision", async () => {
    const queue = memoryQueue([
      { type: "position", ...onLayer, stage: "support", positionMs: 1_000, segmentId: "segment-1" },
      { type: "save-video", contentItemId: scope.contentItemId },
      { type: "unsave-word", revisionId: null, expressionId: "expression-1" },
      // Another Revision's place isn't this one's.
      {
        type: "position",
        layerId: scope.layerId,
        revisionId: "revision-1",
        stage: "watch",
        positionMs: 8_000,
        segmentId: null,
      },
    ]);
    const start = await accountStore(queue, account, scope, segments).load();
    expect(start.progress.visited).toEqual(["watch", "support"]);
    expect(start.videoSaved).toBe(true);
    expect(start.savedWords).toEqual([]);
    expect(start.place).toEqual({ positionMs: 1_000, segmentId: "segment-1" });
  });

  it("puts each change through the queue, resolving to its ID for the save indicator", async () => {
    const queue = memoryQueue();
    const id = await accountStore(queue, account, scope, segments).record({
      type: "save-word",
      ...onLayer,
      expressionId: "expression-2",
    });
    expect(queue.events.map((event) => event.id)).toEqual([id]);
  });
});
