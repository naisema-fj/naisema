import type { Database } from "./db.server";
import { pagesShowing, purgePublicPages } from "./public-cache.server";
import { indexItem } from "./search.server";

/**
 * Call after anything that may change what the public sees of an item: publishing, withdrawing,
 * archiving, a review decision, a rights change or a new address. Its search entry is rebuilt and
 * the pages showing it are purged from the edge cache (ADR-0007), together, in one place.
 */
export async function publicItemChanged(
  env: Env,
  db: Database,
  item: { id: string; primaryArea: string; slug: string },
  alsoPurge: string[] = [],
) {
  await indexItem(db, item.id);
  await purgePublicPages(env, [...pagesShowing({ area: item.primaryArea, slug: item.slug }), ...alsoPurge]);
}
