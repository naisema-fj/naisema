import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Site-wide settings the founder controls, such as the site name and welcome statement (PRD §08). */
export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
