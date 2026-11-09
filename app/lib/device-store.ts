import { type LayerSession, readLayer, readPreferences, type SupportPreferences } from "./learner-session";

/**
 * Where the immersion player keeps what a learner does and chooses: this device's own storage,
 * and nowhere else (ADR-0015, no Learner Accounts in v1). Progress and caption choices are kept
 * per Learning Layer and belong to the published Revision they were made on; support preferences
 * hold for every Learning Layer. Nothing here is ever sent to NAISEMA.
 */

/** As much of the browser's storage as the store needs. */
export type DeviceStorage = Pick<Storage, "getItem" | "setItem">;

/** The browser's local storage, reached only when used, so pages can render on the server. */
export const localDevice: DeviceStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};

const PREFERENCES_KEY = "naisema:learner-support";
const layerKey = (layerId: string) => `naisema:learning-layer:${layerId}`;

function read(storage: DeviceStorage, key: string): unknown {
  try {
    return JSON.parse(storage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function write(storage: DeviceStorage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or turned off; the page keeps working, it just won't remember.
  }
}

export function loadLayer(storage: DeviceStorage, layerId: string, revisionId: string) {
  const { progress, captions } = readLayer(read(storage, layerKey(layerId)), revisionId);
  return { progress, captions, preferences: readPreferences(read(storage, PREFERENCES_KEY)) };
}

export function saveLayer(storage: DeviceStorage, layerId: string, session: LayerSession) {
  write(storage, layerKey(layerId), {
    revisionId: session.revisionId,
    progress: session.progress,
    captions: session.captions,
  });
}

export function savePreferences(storage: DeviceStorage, preferences: SupportPreferences) {
  write(storage, PREFERENCES_KEY, preferences);
}
