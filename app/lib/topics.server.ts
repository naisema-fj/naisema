import { eq, inArray, like, or } from "drizzle-orm";
import { contentItem, topic } from "~db/schema";
import { auditInsert } from "./audit.server";
import type { Database } from "./db.server";
import { firstFreeSlug, slugify } from "./slug";
import { TOPIC_DESCRIPTION_LIMIT, TOPIC_NAME_LIMIT } from "./topics";

export type TopicResult = { ok: true } | { ok: false; error: string };

export async function listTopics(db: Database) {
  return db
    .select({
      id: topic.id,
      name: topic.name,
      slug: topic.slug,
      description: topic.description,
      parentTopicId: topic.parentTopicId,
      leadItemId: topic.leadItemId,
    })
    .from(topic)
    .orderBy(topic.name);
}

/**
 * Sets what a Topic's page shows: its description, the broader Topic it sits under (one level of
 * subtopics, so a Topic with subtopics can't become one) and its lead feature.
 */
export async function updateTopic(
  db: Database,
  updatedBy: string,
  id: string,
  changes: { description: string; parentTopicId: string | null; leadItemId: string | null },
): Promise<TopicResult & { paths?: string[] }> {
  const description = changes.description.trim();
  if (description.length > TOPIC_DESCRIPTION_LIMIT) {
    return { ok: false, error: `The description can be at most ${TOPIC_DESCRIPTION_LIMIT} characters.` };
  }
  const all = await listTopics(db);
  const current = all.find((row) => row.id === id);
  if (!current) return { ok: false, error: "That topic doesn't exist." };
  const parent = changes.parentTopicId ? all.find((row) => row.id === changes.parentTopicId) : null;
  if (changes.parentTopicId) {
    if (!parent || parent.id === id) return { ok: false, error: "Choose another topic to sit under." };
    if (parent.parentTopicId)
      return { ok: false, error: `${parent.name} is itself a subtopic; choose a broader topic.` };
    if (all.some((row) => row.parentTopicId === id)) {
      return { ok: false, error: `${current.name} has its own subtopics, so it can't become a subtopic.` };
    }
  }
  if (changes.leadItemId) {
    const lead = await db
      .select({ id: contentItem.id })
      .from(contentItem)
      .where(eq(contentItem.id, changes.leadItemId))
      .get();
    if (!lead) return { ok: false, error: "That lead feature no longer exists." };
  }
  await db.batch([
    db
      .update(topic)
      .set({ description, parentTopicId: parent?.id ?? null, leadItemId: changes.leadItemId })
      .where(eq(topic.id, id)),
    auditInsert(db, { actorId: updatedBy, action: "topic.updated", objectType: "topic", objectId: id }),
  ]);
  // The public pages that show this topic: its own and its subtopics' filtered views (which carry its
  // description), and its old and new parents' pages, whole and filtered to it.
  const subtopics = all.filter((row) => row.parentTopicId === id);
  const parents = [all.find((row) => row.id === current.parentTopicId), parent].filter((row) => !!row);
  return {
    ok: true,
    paths: [
      `/topics/${current.slug}`,
      ...subtopics.map((sub) => `/topics/${current.slug}/${sub.slug}`),
      ...parents.flatMap((row) => [`/topics/${row.slug}`, `/topics/${row.slug}/${current.slug}`]),
    ],
  };
}

/** A Topic by its address, with its broader Topic and its subtopics, for its public page. */
export async function topicBySlug(db: Database, slug: string) {
  const all = await listTopics(db);
  const found = all.find((row) => row.slug === slug);
  if (!found) return null;
  return {
    ...found,
    parent: all.find((row) => row.id === found.parentTopicId) ?? null,
    subtopics: all.filter((row) => row.parentTopicId === found.id),
  };
}

/** Turns Topic IDs into names, for showing what a Revision was tagged with. */
export async function topicNamer(db: Database) {
  const names = new Map((await listTopics(db)).map((row) => [row.id, row.name]));
  return (ids: string[]) => ids.map((id) => names.get(id) ?? "A removed topic");
}

/** Adds a Topic for tagging Content Items. Names are unique, ignoring case. */
export async function createTopic(db: Database, createdBy: string, rawName: string): Promise<TopicResult> {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Enter a name for the topic." };
  if (name.length > TOPIC_NAME_LIMIT) {
    return { ok: false, error: `Topic names can be at most ${TOPIC_NAME_LIMIT} characters.` };
  }

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
  try {
    await db.batch([
      db.insert(topic).values({ id, name, slug, createdBy, createdAt: new Date() }),
      auditInsert(db, { actorId: createdBy, action: "topic.created", objectType: "topic", objectId: id }),
    ]);
  } catch (error) {
    if (!String(error).includes("topic.slug")) throw error;
    return { ok: false, error: "Someone added a similar topic at the same moment. Check the list and try again." };
  }
  return { ok: true };
}

/** Which of these Topic IDs exist. */
export async function existingTopicIds(db: Database, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await db.select({ id: topic.id }).from(topic).where(inArray(topic.id, ids));
  return new Set(rows.map((row) => row.id));
}
