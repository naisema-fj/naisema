import { type EventFields, type LearnerLayerState, type ShownState, withQueued } from "./learner-progress";
import { readLayer, readPreferences } from "./learner-session";
import { currentSegment } from "./player-rules";
import type { ProgressQueue } from "./progress-queue";
import type { Segment } from "./segment-rules";

/**
 * Where the immersion player keeps what a learner does and chooses on a Learning Layer. The player
 * talks to one store: it asks what to start from, and records each change as a progress event
 * (app/lib/learner-progress.ts). For a visitor, the tab store keeps it in the tab's session storage
 * alone (§05A); for a signed-in learner, the account store starts from what their account holds
 * with anything still queued on this device on top, and puts each change through the progress
 * queue (app/lib/progress-queue.ts), which says when it is saved.
 */

/** Where the learner's place in the clip was kept, in the Learning Layer's own time. */
export type Place = { positionMs: number; segmentId: string | null };

/** What the player starts from on one Learning Layer's published Revision. */
export type StoreStart = ShownState & {
  /** Where to keep the learner's place from, or null where it isn't kept. */
  place: Place | null;
};

export type LearnerStore = {
  load(): Promise<StoreStart>;
  /** Keeps one change. Resolves to its ID while it waits for the server to acknowledge it; null when kept at once. */
  record(event: EventFields): Promise<string | null>;
};

/** The Learning Layer's published Revision the player shows, and the Video it is on. */
export type StoreScope = { layerId: string; revisionId: string; contentItemId: string };

/** As much of the browser's session storage as the tab store needs. */
export type TabStorage = Pick<Storage, "getItem" | "setItem">;

/** The tab's session storage, reached only when used, so a store can be made while rendering on the server. */
export const sessionTab: TabStorage = {
  getItem: (key) => window.sessionStorage.getItem(key),
  setItem: (key, value) => window.sessionStorage.setItem(key, value),
};

const PREFERENCES_KEY = "naisema:learner-support";
const layerKey = (layerId: string) => `naisema:learning-layer:${layerId}`;

function read(storage: TabStorage, key: string): unknown {
  try {
    return JSON.parse(storage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function write(storage: TabStorage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or turned off; the page keeps working, it just won't remember.
  }
}

/**
 * A visitor's store: progress and captions for this Learning Layer's Revision, and support
 * preferences for every Learning Layer, kept for the tab only. A visitor saves nothing and has no
 * place kept, so those events change nothing here.
 */
export function tabStore(storage: TabStorage, scope: StoreScope): LearnerStore {
  let shown: ShownState | null = null;
  const current = (): ShownState => {
    if (!shown) {
      const { progress, captions } = readLayer(read(storage, layerKey(scope.layerId)), scope.revisionId);
      const preferences = readPreferences(read(storage, PREFERENCES_KEY));
      shown = { progress, captions, preferences, savedWords: [], videoSaved: false };
    }
    return shown;
  };
  return {
    load: async () => ({ ...current(), place: null }),
    async record(event) {
      const next = withQueued(current(), [event], scope);
      shown = next;
      write(storage, layerKey(scope.layerId), {
        revisionId: scope.revisionId,
        progress: next.progress,
        captions: next.captions,
      });
      write(storage, PREFERENCES_KEY, next.preferences);
      return null;
    },
  };
}

/**
 * A signed-in learner's store: what their account holds, with their queued, not yet acknowledged
 * changes on top, so a page opened while offline still shows what they did; their place is the
 * latest one still queued, else the account's. Each change goes through the queue.
 */
export function accountStore(
  queue: Pick<ProgressQueue, "pending" | "add">,
  account: LearnerLayerState,
  scope: StoreScope,
  segments: Segment[],
): LearnerStore {
  return {
    async load() {
      const queued = await queue.pending();
      const { progress, captions, preferences, savedWords, videoSaved } = account;
      const shown = withQueued({ progress, captions, preferences, savedWords, videoSaved }, queued, scope);
      const queuedPlace = [...queued]
        .reverse()
        .find(
          (event) =>
            event.type === "position" && event.layerId === scope.layerId && event.revisionId === scope.revisionId,
        );
      const resumeMs = account.resumeMs ?? 0;
      return {
        ...shown,
        place:
          queuedPlace?.type === "position"
            ? { positionMs: queuedPlace.positionMs, segmentId: queuedPlace.segmentId }
            : { positionMs: resumeMs, segmentId: currentSegment(segments, resumeMs)?.id ?? null },
      };
    },
    record: (event) => queue.add(event),
  };
}
