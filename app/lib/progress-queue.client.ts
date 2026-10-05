import {
  type EventFields,
  LEARNER_PATHS,
  MAX_EVENTS_PER_BATCH,
  type ProgressEvent,
  retryDelay,
} from "./learner-progress";

/**
 * The signed-in learner's progress queue (docs/phase-1a-defaults.md §8, VTECH-05). Every change is
 * given a UUID and kept in IndexedDB first, then sent to /account/events in batches, retrying with
 * longer waits while sends fail and at once when the browser is back online. An event leaves the
 * queue only when the server acknowledges it, so nothing is called saved before it is. Each
 * learner has their own queue on a shared device, and signing out clears it.
 */

/** Where the queue is up to, for the "Not yet saved" indicator. */
export type QueueStatus = {
  /** Changes not yet acknowledged. */
  waiting: number;
  sending: boolean;
  /** The last send failed; the queue is waiting to try again. */
  retrying: boolean;
  /** The server said the learner isn't signed in, so nothing more is sent from this page. */
  signedOut: boolean;
};

type Entry = { seq?: number; user: string; event: ProgressEvent };

const DB_NAME = "naisema-progress";
const STORE = "events";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE, { keyPath: "seq", autoIncrement: true }).createIndex("user", "user");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

const done = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/**
 * One learner's queue. IndexedDB can be unavailable (some private windows); the queue then lives in
 * the page alone, and still never reports anything saved before the server acknowledges it.
 */
class ProgressQueue {
  private db: Promise<IDBDatabase | null>;
  private memory: Entry[] = [];
  private status: QueueStatus = { waiting: 0, sending: false, retrying: false, signedOut: false };
  private listeners = new Set<(status: QueueStatus) => void>();
  private failures = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private user: string) {
    this.db = openDb();
    window.addEventListener("online", () => this.flush());
    window.addEventListener("pagehide", () => this.flush());
    this.refresh().then(() => this.flush());
  }

  private async entries(): Promise<Entry[]> {
    const db = await this.db;
    if (!db) return this.memory;
    const store = db.transaction(STORE).objectStore(STORE);
    return done(store.index("user").getAll(this.user) as IDBRequest<Entry[]>).then((rows) =>
      rows.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0)),
    );
  }

  private async remove(ids: Set<string>) {
    const db = await this.db;
    if (!db) {
      this.memory = this.memory.filter((entry) => !ids.has(entry.event.id));
      return;
    }
    const entries = await this.entries();
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    await Promise.all(
      entries.filter((entry) => ids.has(entry.event.id)).map((entry) => done(store.delete(entry.seq as number))),
    );
  }

  private set(change: Partial<QueueStatus>) {
    this.status = { ...this.status, ...change };
    for (const listener of this.listeners) listener(this.status);
  }

  private async refresh() {
    this.set({ waiting: (await this.entries()).length });
  }

  /** The events still waiting, oldest first. */
  async pending(): Promise<ProgressEvent[]> {
    return (await this.entries()).map((entry) => entry.event);
  }

  subscribe(listener: (status: QueueStatus) => void) {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Queues a change, then sends what is waiting. */
  async add(fields: EventFields) {
    const entry: Entry = { user: this.user, event: { ...fields, id: crypto.randomUUID() } as ProgressEvent };
    const db = await this.db;
    if (db) await done(db.transaction(STORE, "readwrite").objectStore(STORE).add(entry));
    else this.memory.push(entry);
    await this.refresh();
    this.flush();
  }

  /** Sends the oldest waiting events, and goes on until none are left or a send fails. */
  async flush(): Promise<void> {
    if (this.status.sending || this.status.signedOut) return;
    clearTimeout(this.timer);
    const batch = (await this.pending()).slice(0, MAX_EVENTS_PER_BATCH);
    if (!batch.length) {
      this.set({ retrying: false });
      return;
    }
    this.set({ sending: true });
    let sent = false;
    try {
      const response = await fetch(LEARNER_PATHS.events, {
        method: "POST",
        body: JSON.stringify(batch),
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      });
      if (response.status === 401) {
        this.set({ sending: false, signedOut: true });
        return;
      }
      if (response.ok) {
        const { acknowledged } = (await response.json()) as { acknowledged: string[] };
        await this.remove(new Set(acknowledged));
        sent = true;
      } else if (response.status === 400 || response.status === 413) {
        // A batch the server can never read; keeping it would block everything after it.
        await this.remove(new Set(batch.map((event) => event.id)));
        sent = true;
      }
    } catch {
      // Offline, or the request didn't finish: try again later.
    }
    await this.refresh();
    this.set({ sending: false });
    if (sent) {
      this.failures = 0;
      this.set({ retrying: false });
      if (this.status.waiting) this.flush();
    } else {
      this.failures += 1;
      this.set({ retrying: true });
      this.timer = setTimeout(() => this.flush(), retryDelay(this.failures));
    }
  }

  /** Forgets everything queued, on signing out. */
  async clear() {
    const db = await this.db;
    const entries = await this.entries();
    if (db) {
      const store = db.transaction(STORE, "readwrite").objectStore(STORE);
      await Promise.all(entries.map((entry) => done(store.delete(entry.seq as number))));
    }
    this.memory = [];
    await this.refresh();
  }
}

const queues = new Map<string, ProgressQueue>();

/** The signed-in learner's queue on this page, made once. */
export function progressQueue(user: string) {
  let queue = queues.get(user);
  if (!queue) {
    queue = new ProgressQueue(user);
    queues.set(user, queue);
  }
  return queue;
}
