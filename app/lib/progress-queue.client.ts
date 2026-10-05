import { LEARNER_PATHS, type ProgressEvent } from "./learner-progress";
import { memoryStorage, ProgressQueue, type QueueStorage, type SendBatch } from "./progress-queue";

/**
 * The progress queue in the browser (app/lib/progress-queue.ts): events kept in IndexedDB and sent
 * to /account/events, at once when the browser is back online and as the page is left. Each learner
 * has their own queue on a shared device, and signing out clears it.
 */

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
 * One learner's events in IndexedDB. It can be unavailable (some private windows); the queue then
 * lives in the page alone, and still never reports anything saved before the server acknowledges it.
 */
function indexedDbStorage(user: string): QueueStorage {
  const opened = openDb();
  const memory = memoryStorage();
  const entries = async (db: IDBDatabase) => {
    const rows = await done(db.transaction(STORE).objectStore(STORE).index("user").getAll(user) as IDBRequest<Entry[]>);
    return rows.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  };
  const removeWhere = async (db: IDBDatabase, keep: (entry: Entry) => boolean) => {
    const doomed = (await entries(db)).filter((entry) => !keep(entry));
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    await Promise.all(doomed.map((entry) => done(store.delete(entry.seq as number))));
  };
  return {
    async all() {
      const db = await opened;
      return db ? (await entries(db)).map((entry) => entry.event) : memory.all();
    },
    async add(event) {
      const db = await opened;
      if (db)
        await done(
          db
            .transaction(STORE, "readwrite")
            .objectStore(STORE)
            .add({ user, event } satisfies Entry),
        );
      else await memory.add(event);
    },
    async remove(ids) {
      const db = await opened;
      if (db) await removeWhere(db, (entry) => !ids.has(entry.event.id));
      else await memory.remove(ids);
    },
    async clear() {
      const db = await opened;
      if (db) await removeWhere(db, () => false);
      await memory.clear();
    },
  };
}

/** Sends a batch to /account/events, surviving the page being left. */
const sendToAccount: SendBatch = async (batch) => {
  try {
    const response = await fetch(LEARNER_PATHS.events, {
      method: "POST",
      body: JSON.stringify(batch),
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    });
    if (response.status === 401) return { kind: "signed-out" };
    if (response.ok) {
      const { acknowledged, refused } = (await response.json()) as { acknowledged: string[]; refused: string[] };
      return { kind: "applied", acknowledged, refused };
    }
    return response.status === 400 || response.status === 413 ? { kind: "unreadable" } : { kind: "failed" };
  } catch {
    // Offline, or the request didn't finish: try again later.
    return { kind: "failed" };
  }
};

const queues = new Map<string, ProgressQueue>();

/** The signed-in learner's queue on this page, made once. */
export function progressQueue(user: string) {
  let queue = queues.get(user);
  if (!queue) {
    const made = new ProgressQueue(indexedDbStorage(user), sendToAccount);
    window.addEventListener("online", () => made.flush());
    window.addEventListener("pagehide", () => made.flush());
    queues.set(user, made);
    queue = made;
  }
  return queue;
}
