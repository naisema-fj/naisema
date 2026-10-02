import { and, eq, isNull } from "drizzle-orm";
import { contentHold } from "~db/schema";
import type { Database } from "./db.server";

/**
 * Whether a Content Item is hidden pending a Case's review (SAFE-03). The eligibility decision asks
 * this, so a held item leaves the public site at once and can't be republished until the hold is lifted.
 */
export async function activeHold(db: Database, contentItemId: string) {
  return (
    (await db
      .select()
      .from(contentHold)
      .where(and(eq(contentHold.contentItemId, contentItemId), isNull(contentHold.liftedAt)))
      .get()) ?? null
  );
}
