import { inArray } from "drizzle-orm";
import { siteSettings } from "~db/schema";
import type { Database } from "./db.server";

export type SiteSettings = {
  siteName: string;
  welcomeStatement: string | null;
};

const SITE_NAME = "site_name";
const WELCOME_STATEMENT = "welcome_statement";

export async function getSiteSettings(db: Database): Promise<SiteSettings> {
  const rows = await db
    .select({ key: siteSettings.key, value: siteSettings.value })
    .from(siteSettings)
    .where(inArray(siteSettings.key, [SITE_NAME, WELCOME_STATEMENT]));
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  return {
    siteName: byKey.get(SITE_NAME) ?? "NAISEMA",
    welcomeStatement: byKey.get(WELCOME_STATEMENT) ?? null,
  };
}
