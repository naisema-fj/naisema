import { type EventFields, MAX_EVENTS_PER_BATCH, type ProgressEvent, retryDelay } from "./learner-progress";

/**
 * The signed-in learner's progress queue (docs/phase-1a-defaults.md §8, VTECH-05). Every change is
 * given a UUID and kept on the device first, then sent to the server in batches, retrying with
 * longer waits while sends fail. An event leaves the queue only when the server acknowledges it,
 * so nothing is called saved before it is. Where events are kept and how a batch is sent are ports:
 * IndexedDB and fetch in the browser (progress-queue.client.ts), memory in tests.
 */

/** Where the queue is up to, for the "Not yet saved" indicator. */
export type QueueStatus = {
  /** Whether the queue on this device has been read yet; until then nothing is known. */
  ready: boolean;
  /** Changes not yet acknowledged. */
  waiting: number;
  /** Changes the server acknowledged but couldn't apply, on this page, such as saving something no longer public. */
  refused: string[];
  sending: boolean;
  /** The last send failed; the queue is waiting to try again. */
  retrying: boolean;
  /** The server said the learner isn't signed in, so nothing more is sent from this page. */
  signedOut: boolean;
};

export const IDLE_STATUS: QueueStatus = {
  ready: false,
  waiting: 0,
  refused: [],
  sending: false,
  retrying: false,
  signedOut: false,
};

/** One learner's events on this device, oldest first. */
export type QueueStorage = {
  all(): Promise<ProgressEvent[]>;
  add(event: ProgressEvent): Promise<void>;
  remove(ids: Set<string>): Promise<void>;
  clear(): Promise<void>;
};

/**
 * What came of sending a batch: the server applied it, acknowledging every event it read and
 * refusing those it couldn't apply; it can never read it; the learner isn't signed in; or it
 * didn't arrive.
 */
export type SendOutcome =
  | { kind: "applied"; acknowledged: string[]; refused: string[] }
  | { kind: "unreadable" }
  | { kind: "signed-out" }
  | { kind: "failed" };

export type SendBatch = (batch: ProgressEvent[]) => Promise<SendOutcome>;

/** Runs `retry` after `ms`; returns a way to cancel it. */
export type Later = (retry: () => void, ms: number) => () => void;

const later: Later = (retry, ms) => {
  const timer = setTimeout(retry, ms);
  return () => clearTimeout(timer);
};

/** Events kept in the page alone: where IndexedDB is unavailable, and in tests. */
export function memoryStorage(): QueueStorage {
  let events: ProgressEvent[] = [];
  return {
    all: async () => [...events],
    add: async (event) => {
      events.push(event);
    },
    remove: async (ids) => {
      events = events.filter((event) => !ids.has(event.id));
    },
    clear: async () => {
      events = [];
    },
  };
}

export class ProgressQueue {
  private status: QueueStatus = IDLE_STATUS;
  private listeners = new Set<(status: QueueStatus) => void>();
  private failures = 0;
  private cancelRetry = () => {};

  constructor(
    private storage: QueueStorage,
    private send: SendBatch,
    private wait: Later = later,
  ) {
    this.refresh().then(() => this.flush());
  }

  private set(change: Partial<QueueStatus>) {
    this.status = { ...this.status, ...change };
    for (const listener of this.listeners) listener(this.status);
  }

  private async refresh() {
    this.set({ ready: true, waiting: (await this.storage.all()).length });
  }

  /** The events still waiting, oldest first. */
  pending(): Promise<ProgressEvent[]> {
    return this.storage.all();
  }

  subscribe(listener: (status: QueueStatus) => void) {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Queues a change, then sends what is waiting. Returns the change's ID. */
  async add(fields: EventFields): Promise<string> {
    const event = { ...fields, id: crypto.randomUUID() } as ProgressEvent;
    await this.storage.add(event);
    await this.refresh();
    this.flush();
    return event.id;
  }

  /** Sends the oldest waiting events, and goes on until none are left or a send fails. */
  async flush(): Promise<void> {
    if (this.status.sending || this.status.signedOut) return;
    this.cancelRetry();
    const batch = (await this.pending()).slice(0, MAX_EVENTS_PER_BATCH);
    if (!batch.length) {
      this.set({ retrying: false });
      return;
    }
    this.set({ sending: true });
    let outcome: SendOutcome;
    try {
      outcome = await this.send(batch);
    } catch {
      outcome = { kind: "failed" };
    }
    if (outcome.kind === "signed-out") {
      this.set({ sending: false, signedOut: true });
      return;
    }
    if (outcome.kind === "applied") {
      await this.storage.remove(new Set(outcome.acknowledged));
      if (outcome.refused.length) this.set({ refused: [...this.status.refused, ...outcome.refused] });
    } else if (outcome.kind === "unreadable") {
      // A batch the server can never read; keeping it would block everything after it.
      await this.storage.remove(new Set(batch.map((event) => event.id)));
    }
    await this.refresh();
    this.set({ sending: false });
    if (outcome.kind !== "failed") {
      this.failures = 0;
      this.set({ retrying: false });
      if (this.status.waiting) await this.flush();
    } else {
      this.failures += 1;
      this.set({ retrying: true });
      this.cancelRetry = this.wait(() => this.flush(), retryDelay(this.failures));
    }
  }

  /** Forgets everything queued, on signing out. */
  async clear() {
    await this.storage.clear();
    await this.refresh();
  }
}
