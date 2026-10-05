import { describe, expect, it, vi } from "vitest";
import { type EventFields, MAX_EVENTS_PER_BATCH, type ProgressEvent } from "~/lib/learner-progress";
import { type Later, memoryStorage, ProgressQueue, type QueueStatus, type SendOutcome } from "~/lib/progress-queue";

/** The progress queue with its events in memory, a server that answers as told, and retries held for the test. */
function queueWith(answers: SendOutcome[] = [], storage = memoryStorage()) {
  const sent: ProgressEvent[][] = [];
  const retries: number[] = [];
  let retry = () => {};
  const later: Later = (run, ms) => {
    retries.push(ms);
    retry = run;
    return () => {};
  };
  const queue = new ProgressQueue(
    storage,
    async (batch) => {
      sent.push(batch);
      return answers.shift() ?? { kind: "applied", acknowledged: batch.map((event) => event.id), refused: [] };
    },
    later,
  );
  let status: QueueStatus | undefined;
  queue.subscribe((next) => {
    status = next;
  });
  // Settled: read, not sending, and with nothing left to send until something changes.
  const settled = () =>
    vi.waitFor(() => {
      expect(status).toMatchObject({ ready: true, sending: false });
      const { waiting, retrying, signedOut } = status as QueueStatus;
      expect(waiting === 0 || retrying || signedOut).toBe(true);
    });
  return { queue, sent, retries, retryNow: () => retry(), status: () => status as QueueStatus, settled, storage };
}

const preferences: EventFields = { type: "preferences", speed: 1, textRoute: false, alwaysCaptions: true };
const saveVideo: EventFields = { type: "save-video", contentItemId: "video-1" };

describe("the progress queue", () => {
  it("sends each change and forgets it only once the server acknowledges it", async () => {
    const { queue, sent, status, settled } = queueWith();
    const id = await queue.add(preferences);
    await settled();
    expect(sent).toEqual([[{ ...preferences, id }]]);
    expect(await queue.pending()).toEqual([]);
    expect(status()).toMatchObject({ ready: true, waiting: 0, retrying: false, signedOut: false });
  });

  it("keeps a change the server didn't acknowledge, and sends it again", async () => {
    const storage = memoryStorage();
    const first = { ...preferences, id: crypto.randomUUID() } as ProgressEvent;
    const second = { ...saveVideo, id: crypto.randomUUID() } as ProgressEvent;
    await storage.add(first);
    await storage.add(second);
    const { queue, sent, settled } = queueWith([{ kind: "applied", acknowledged: [first.id], refused: [] }], storage);
    await settled();
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[0]).toEqual([first, second]);
    expect(sent[1]).toEqual([second]);
    expect(await queue.pending()).toEqual([]);
  });

  it("waits longer after each failed send, keeping every change, and carries on once one gets through", async () => {
    const { queue, sent, retries, retryNow, status, settled } = queueWith([{ kind: "failed" }, { kind: "failed" }]);
    await queue.add(preferences);
    await settled();
    expect(status()).toMatchObject({ waiting: 1, retrying: true });
    retryNow();
    await vi.waitFor(() => expect(retries).toEqual([2_000, 4_000]));
    retryNow();
    await vi.waitFor(() => expect(sent).toHaveLength(3));
    await settled();
    expect(status()).toMatchObject({ waiting: 0, retrying: false });
  });

  it("says which changes the server acknowledged but couldn't apply", async () => {
    const storage = memoryStorage();
    const event = { ...saveVideo, id: crypto.randomUUID() } as ProgressEvent;
    await storage.add(event);
    const { status, settled } = queueWith(
      [{ kind: "applied", acknowledged: [event.id], refused: [event.id] }],
      storage,
    );
    await settled();
    expect(status()).toMatchObject({ waiting: 0, refused: [event.id] });
  });

  it("stops sending once the learner is signed out, keeping their changes waiting", async () => {
    const { queue, sent, status, settled } = queueWith([{ kind: "signed-out" }]);
    await queue.add(preferences);
    await settled();
    await queue.add(saveVideo);
    await queue.flush();
    expect(sent).toHaveLength(1);
    expect(status()).toMatchObject({ signedOut: true, waiting: 2 });
  });

  it("drops a batch the server can never read, so it doesn't block what comes after", async () => {
    const { queue, status, settled } = queueWith([{ kind: "unreadable" }]);
    await queue.add(preferences);
    await settled();
    expect(await queue.pending()).toEqual([]);
    expect(status().waiting).toBe(0);
  });

  it("sends a long queue in batches", async () => {
    const storage = memoryStorage();
    for (let index = 0; index < MAX_EVENTS_PER_BATCH + 3; index += 1) {
      await storage.add({ ...preferences, id: crypto.randomUUID() } as ProgressEvent);
    }
    const { sent, settled } = queueWith([], storage);
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    await settled();
    expect(sent.map((batch) => batch.length)).toEqual([MAX_EVENTS_PER_BATCH, 3]);
  });

  it("forgets everything queued when cleared", async () => {
    const { queue, status, settled } = queueWith([{ kind: "signed-out" }]);
    await queue.add(preferences);
    await settled();
    await queue.clear();
    expect(await queue.pending()).toEqual([]);
    expect(status().waiting).toBe(0);
  });
});
