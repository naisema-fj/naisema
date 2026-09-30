import { eq, inArray, like, or } from "drizzle-orm";
import { topic } from "~db/schema";
import { recordAudit } from "./audit.server";
import type { Database } from "./db.server";
import { firstFreeSlug, slugify } from "./slug";

export type TopicResult = { ok: true } | { ok: false; error: string };

export async function listTopics(db: Database) {
  return db.select({ id: topic.id, name: topic.name, slug: topic.slug }).from(topic).orderBy(topic.name);
}

/** Adds a Topic for tagging Content Items. Names are unique, ignoring case. */
export async function createTopic(db: Database, createdBy: string, rawName: string): Promise<TopicResult> {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Enter a name for the topic." };
  if (name.length > 80) return { ok: false, error: "Topic names can be at most 80 characters." };

  const base = slugify(name);
  const similar = await db
    .select({ name: topic.name, slug: topic.slug })
    .from(topic)
    .where(or(eq(topic.slug, base), like(topic.slug, `${base}-%`)));
  if (similar.some((existing) => existing.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `There is already a topic called ${name}.` };
  }

  const id = crypto.randomUUID();
  const slug = firstFreeSlug(base, new Set(similar.map((existing) => existing.slug)));
  await db.insert(topic).values({ id, name, slug, createdBy, createdAt: new Date() });
  await recordAudit(db, { actorId: createdBy, action: "topic.created", objectType: "topic", objectId: id });
  return { ok: true };
}

/** Which of these Topic IDs exist. */
export async function existingTopicIds(db: Database, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await db.select({ id: topic.id }).from(topic).where(inArray(topic.id, ids));
  return new Set(rows.map((row) => row.id));
}
