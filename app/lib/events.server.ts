import type { LearningEventName } from "./learning-events";

/**
 * Product events (docs/decision-log.md, analytics): written to Workers Analytics Engine with item
 * and area IDs only, never a learner, a visitor or anything they typed.
 */
export type ProductEvent = "content_opened" | "resource_downloaded" | LearningEventName;

export function recordEvent(env: Env, name: ProductEvent, ids: string[]) {
  env.EVENTS.writeDataPoint({ indexes: [name], blobs: [name, ...ids] });
}
