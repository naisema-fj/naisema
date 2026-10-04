import { and, asc, desc, eq, inArray, isNull, type SQL } from "drizzle-orm";
import {
  contentItem,
  learningLayer,
  learningLayerEducator,
  learningLayerRevision,
  revision,
  roleAssignment,
  user,
  videoAsset,
  videoEducator,
} from "~db/schema";
import { activityProblems, readActivities } from "./activities";
import {
  annotationProblems,
  annotationsToCheck,
  noteProblems,
  readAnnotations,
  readNewExpressions,
  readNotes,
} from "./annotations";
import type { ArticleSnapshot } from "./article-fields";
import { auditInsert, recordAudit } from "./audit.server";
import type { Database } from "./db.server";
import { expressionCopies, placeNewExpressions } from "./expressions.server";
import {
  LAYER_LANGUAGE_VARIETY,
  type LayerDetailField,
  type LayerRefusal,
  type LearningLayerSnapshot,
  learningLayerReviewFields,
  readLayerDetails,
  withDefaults,
} from "./learning-layer-fields";
import { type Actor, can } from "./permissions";
import { fingerprintsOf } from "./review-rules";
import { clipDuration, readSegments, segmentProblems } from "./segment-rules";
import { requireStaff } from "./staff.server";

/**
 * Learning Layers (ADR-0001, ADR-0006). Editors assign Educators to a Video; an assigned Educator
 * (or an editor) adds Learning Layers to it, each on the whole video or an Excerpt, and becomes
 * assigned to the ones they add. Only editors and a layer's assigned Educators can open it (VAC-05).
 * Every save appends a write-once Revision holding the full snapshot, its Segments included, with
 * one fingerprint per Review Type; a save made from an outdated Revision is refused.
 */

export type LayerRevision = typeof learningLayerRevision.$inferSelect & { snapshot: LearningLayerSnapshot };

const STALE_SAVE =
  "Someone else saved this Learning Layer while you were editing. Open it again to see their changes, then make yours.";

/** A Video Content Item with its current draft's title and the Video Asset it shows. */
export async function videoItem(db: Database, contentItemId: string) {
  const row = await db
    .select({ item: contentItem, snapshot: revision.snapshot })
    .from(contentItem)
    .innerJoin(revision, eq(revision.id, contentItem.currentDraftRevisionId))
    .where(and(eq(contentItem.id, contentItemId), eq(contentItem.type, "video")))
    .get();
  if (!row) return null;
  const snapshot = row.snapshot as ArticleSnapshot;
  const asset = snapshot.video
    ? await db.select().from(videoAsset).where(eq(videoAsset.id, snapshot.video.videoAssetId)).get()
    : undefined;
  if (!asset) return null;
  return { id: row.item.id, title: snapshot.title, video: asset };
}

const idsOf = (rows: { userId: string }[]) => rows.map((row) => row.userId);

export const videoEducatorIds = async (db: Database, contentItemId: string) =>
  idsOf(
    await db
      .select({ userId: videoEducator.userId })
      .from(videoEducator)
      .where(eq(videoEducator.contentItemId, contentItemId)),
  );

export const layerEducatorIds = async (db: Database, learningLayerId: string) =>
  idsOf(
    await db
      .select({ userId: learningLayerEducator.userId })
      .from(learningLayerEducator)
      .where(eq(learningLayerEducator.learningLayerId, learningLayerId)),
  );

/** Staff who hold the Educator role now, for assigning. */
export function educatorChoices(db: Database) {
  return db
    .selectDistinct({ id: user.id, name: user.name, email: user.email })
    .from(roleAssignment)
    .innerJoin(user, eq(user.id, roleAssignment.userId))
    .where(and(eq(roleAssignment.role, "educator"), isNull(roleAssignment.revokedAt)))
    .orderBy(asc(user.name));
}

/** Names of the staff with these IDs, in the order given. */
async function namesOf(db: Database, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(inArray(user.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

async function isEducator(db: Database, userId: string) {
  const row = await db
    .select({ id: roleAssignment.id })
    .from(roleAssignment)
    .where(
      and(eq(roleAssignment.userId, userId), eq(roleAssignment.role, "educator"), isNull(roleAssignment.revokedAt)),
    )
    .get();
  return Boolean(row);
}

export type AssignResult = { ok: true } | { ok: false; error: string };

type Assignment = { kind: "video"; contentItemId: string } | { kind: "layer"; learningLayerId: string };

const targetId = (target: Assignment) => (target.kind === "video" ? target.contentItemId : target.learningLayerId);

/** Records a refused attempt to open or change a Video's or Learning Layer's authoring (VAC-05). */
export const refusal = (db: Database, actor: Actor, objectType: "content_item" | "learning_layer", objectId: string) =>
  recordAudit(db, { actorId: actor.userId, action: `${objectType}.authoring_refused`, objectType, objectId });

/** Assigns an Educator to a Video or a Learning Layer, or takes them off it. Editors only. */
export async function setAssignment(
  db: Database,
  actor: Actor,
  target: Assignment,
  educatorId: string,
  assigned: boolean,
): Promise<AssignResult> {
  if (!can(actor, { action: "content.edit" })) {
    await refusal(db, actor, target.kind === "video" ? "content_item" : "learning_layer", targetId(target));
    return { ok: false, error: "Only editors can assign Educators." };
  }
  if (assigned && !(await isEducator(db, educatorId)))
    return { ok: false, error: "Choose someone who is an Educator." };
  const objectType = target.kind === "video" ? "content_item" : "learning_layer";
  const objectId = targetId(target);
  const audit = auditInsert(db, {
    actorId: actor.userId,
    action: `${objectType}.educator_${assigned ? "assigned" : "unassigned"}`,
    objectType,
    objectId,
    details: { educatorId },
  });
  const now = new Date();
  if (target.kind === "video") {
    await db.batch([
      assigned
        ? db
            .insert(videoEducator)
            .values({
              contentItemId: target.contentItemId,
              userId: educatorId,
              assignedBy: actor.userId,
              assignedAt: now,
            })
            .onConflictDoNothing()
        : db
            .delete(videoEducator)
            .where(and(eq(videoEducator.contentItemId, target.contentItemId), eq(videoEducator.userId, educatorId))),
      audit,
    ]);
  } else {
    await db.batch([
      assigned
        ? db
            .insert(learningLayerEducator)
            .values({
              learningLayerId: target.learningLayerId,
              userId: educatorId,
              assignedBy: actor.userId,
              assignedAt: now,
            })
            .onConflictDoNothing()
        : db
            .delete(learningLayerEducator)
            .where(
              and(
                eq(learningLayerEducator.learningLayerId, target.learningLayerId),
                eq(learningLayerEducator.userId, educatorId),
              ),
            ),
      audit,
    ]);
  }
  return { ok: true };
}

type DetailsInput = { title: string; level: string; clip: string; sourceStart: string; sourceEnd: string };

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error?: string; errors?: Partial<Record<LayerDetailField, string>> };

/**
 * Adds a Learning Layer to a Video, with a first Revision that has no Segments yet. The Educator
 * who adds it is assigned to it.
 */
export async function createLearningLayer(
  db: Database,
  actor: Actor,
  contentItemId: string,
  input: DetailsInput,
): Promise<CreateResult> {
  const video = await videoItem(db, contentItemId);
  if (!video) return { ok: false, status: 404, error: "That Video doesn't exist." };
  if (
    !can(actor, {
      action: "learningLayer.create",
      video: { assignedEducatorIds: await videoEducatorIds(db, video.id) },
    })
  ) {
    await refusal(db, actor, "content_item", video.id);
    return {
      ok: false,
      status: 403,
      error: "Only editors and the Educators assigned to this Video can add Learning Layers.",
    };
  }
  const read = readLayerDetails(input, video.video.durationMs);
  if (!read.ok) return { ok: false, status: 400, errors: read.errors };
  const snapshot: LearningLayerSnapshot = {
    ...read.details,
    segments: [],
    annotations: [],
    notes: [],
    expressions: {},
    activities: [],
  };
  const id = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const now = new Date();
  const assignSelf = !can(actor, { action: "content.edit" });
  await db.batch([
    db.insert(learningLayer).values({
      id,
      contentItemId: video.id,
      languageVariety: LAYER_LANGUAGE_VARIETY,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(learningLayerRevision).values({
      id: revisionId,
      learningLayerId: id,
      number: 1,
      snapshot,
      fingerprints: await fingerprintsOf(learningLayerReviewFields(snapshot, LAYER_LANGUAGE_VARIETY)),
      createdBy: actor.userId,
      createdAt: now,
    }),
    db.update(learningLayer).set({ currentDraftRevisionId: revisionId }).where(eq(learningLayer.id, id)),
    ...(assignSelf
      ? [
          db
            .insert(learningLayerEducator)
            .values({ learningLayerId: id, userId: actor.userId, assignedBy: actor.userId, assignedAt: now }),
        ]
      : []),
    auditInsert(db, {
      actorId: actor.userId,
      action: "learning_layer.created",
      objectType: "learning_layer",
      objectId: id,
      details: { contentItemId: video.id },
    }),
  ]);
  return { ok: true, id };
}

/** A Learning Layer with its current draft, its Video and who is assigned, or null. */
export async function getLearningLayer(db: Database, learningLayerId: string) {
  const row = await db
    .select({ layer: learningLayer, revision: learningLayerRevision })
    .from(learningLayer)
    .innerJoin(learningLayerRevision, eq(learningLayerRevision.id, learningLayer.currentDraftRevisionId))
    .where(eq(learningLayer.id, learningLayerId))
    .get();
  if (!row) return null;
  const video = await videoItem(db, row.layer.contentItemId);
  if (!video) return null;
  const assignedEducatorIds = await layerEducatorIds(db, row.layer.id);
  return {
    ...row.layer,
    currentRevision: {
      ...row.revision,
      snapshot: withDefaults(row.revision.snapshot as LearningLayerSnapshot),
    } as LayerRevision,
    video,
    assignedEducatorIds,
    assignedEducators: await namesOf(db, assignedEducatorIds),
  };
}

export type LearningLayer = NonNullable<Awaited<ReturnType<typeof getLearningLayer>>>;

/** A Learning Layer the actor may open and author, or why not: 404 if missing, 403 if not theirs. */
export async function openLearningLayer(db: Database, actor: Actor, learningLayerId: string) {
  const layer = await getLearningLayer(db, learningLayerId);
  if (!layer) return { ok: false as const, status: 404 };
  if (
    !can(actor, { action: "learningLayer.author", learningLayer: { assignedEducatorIds: layer.assignedEducatorIds } })
  ) {
    await refusal(db, actor, "learning_layer", layer.id);
    return { ok: false as const, status: 403 };
  }
  return { ok: true as const, layer };
}

export type SaveLayerResult = { ok: true; number: number } | ({ ok: false } & LayerRefusal);

/**
 * Saves a Learning Layer as a new Revision on top of `baseRevisionId`: its details, Segments,
 * Annotations, notes and Activities, which must pass validation against its clip. Refused if a
 * newer Revision exists.
 */
export async function saveLearningLayer(
  db: Database,
  actor: Actor,
  layer: LearningLayer,
  input: DetailsInput & {
    baseRevisionId: string;
    segments: string;
    annotations: string;
    notes: string;
    newExpressions: string;
    activities: string;
  },
): Promise<SaveLayerResult> {
  if (
    !can(actor, { action: "learningLayer.author", learningLayer: { assignedEducatorIds: layer.assignedEducatorIds } })
  ) {
    return { ok: false, error: "Only editors and the Educators assigned to this Learning Layer can edit it." };
  }
  if (input.baseRevisionId !== layer.currentDraftRevisionId) return { ok: false, error: STALE_SAVE };
  const details = readLayerDetails(input, layer.video.video.durationMs);
  if (!details.ok) return { ok: false, error: "Check the Learning Layer's details.", errors: details.errors };
  const base = layer.currentRevision.snapshot;
  const segments = readSegments(input.segments, new Map(base.segments.map((segment) => [segment.id, segment.tokens])));
  if (!segments.ok) return { ok: false, error: segments.error };
  const problems = segmentProblems(
    segments.segments,
    clipDuration(details.details.excerpt, layer.video.video.durationMs),
  );
  if (problems.length) {
    return {
      ok: false,
      error: `${problems.length === 1 ? "One Segment needs" : `${problems.length} Segments need`} fixing before this can be saved.`,
      problems,
    };
  }
  const annotations = readAnnotations(input.annotations);
  if (!annotations.ok) return { ok: false, error: annotations.error };
  const notes = readNotes(input.notes);
  if (!notes.ok) return { ok: false, error: notes.error };
  const defined = readNewExpressions(input.newExpressions);
  if (!defined.ok) return { ok: false, error: defined.error };
  const activities = readActivities(input.activities);
  if (!activities.ok) return { ok: false, error: activities.error };

  // New Expressions an Annotation uses join the library (or match one there saying exactly the
  // same); every Annotation then links to a library Expression, of which the Revision keeps a copy.
  const used = new Set(annotations.items.map((annotation) => annotation.expressionId));
  const library = await placeNewExpressions(
    db,
    actor.userId,
    layer.languageVariety,
    defined.items.filter((item) => used.has(item.id)),
  );
  if (!library.ok) return { ok: false, error: library.error };
  // Where the server had to work out a Segment's tokens itself, it flags Annotations whose words now
  // appear a different number of times, as the editor does.
  const toCheck = new Set(
    [...segments.retokenised].flatMap((segmentId) =>
      annotationsToCheck(
        annotations.items,
        segmentId,
        base.segments.find((segment) => segment.id === segmentId)?.tokens ?? [],
        segments.segments.find((segment) => segment.id === segmentId)?.tokens ?? [],
      ),
    ),
  );
  const linked = annotations.items.map((annotation) => ({
    ...annotation,
    expressionId: library.ids.get(annotation.expressionId) ?? annotation.expressionId,
    needsCheck: annotation.needsCheck || toCheck.has(annotation.id),
  }));
  const expressions = await expressionCopies(
    db,
    layer.languageVariety,
    [...new Set(linked.map((annotation) => annotation.expressionId))],
    library.added,
  );
  // Annotations, notes and Activities whose words or Segment are gone are kept, flagged; anything
  // else wrong is refused.
  const annotationIssues = annotationProblems(linked, segments.segments, new Set(Object.keys(expressions))).filter(
    (problem) => !problem.revalidate,
  );
  const noteIssues = noteProblems(notes.items, segments.segments).filter((problem) => !problem.revalidate);
  if (annotationIssues.length || noteIssues.length) {
    return {
      ok: false,
      error: "Some Annotations or notes need fixing before this can be saved.",
      annotationProblems: annotationIssues,
      noteProblems: noteIssues,
    };
  }
  const activityIssues = activityProblems(activities.items, segments.segments).filter((problem) => !problem.revalidate);
  if (activityIssues.length) {
    return {
      ok: false,
      error: "Some Activities need fixing before this can be saved.",
      activityProblems: activityIssues,
    };
  }

  const snapshot: LearningLayerSnapshot = {
    ...details.details,
    segments: segments.segments,
    annotations: linked,
    notes: notes.items,
    expressions,
    activities: activities.items,
  };
  const number = layer.currentRevision.number + 1;
  const id = crypto.randomUUID();
  const now = new Date();
  try {
    await db.batch([
      // A concurrent save of the same base takes this number first; the unique index refuses this one.
      db.insert(learningLayerRevision).values({
        id,
        learningLayerId: layer.id,
        number,
        snapshot,
        fingerprints: await fingerprintsOf(learningLayerReviewFields(snapshot, layer.languageVariety)),
        createdBy: actor.userId,
        createdAt: now,
      }),
      ...library.inserts,
      db
        .update(learningLayer)
        .set({ currentDraftRevisionId: id, updatedAt: now })
        .where(eq(learningLayer.id, layer.id)),
      auditInsert(db, {
        actorId: actor.userId,
        action: "learning_layer_revision.saved",
        objectType: "learning_layer_revision",
        objectId: id,
        details: {
          learningLayerId: layer.id,
          number,
          segments: snapshot.segments.length,
          annotations: snapshot.annotations.length,
          activities: snapshot.activities.length,
        },
      }),
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE")) return { ok: false, error: STALE_SAVE };
    throw error;
  }
  return { ok: true, number };
}

/** A summary of each Learning Layer, for the lists. */
async function summaries(db: Database, where: SQL | undefined) {
  const rows = await db
    .select({ layer: learningLayer, snapshot: learningLayerRevision.snapshot, number: learningLayerRevision.number })
    .from(learningLayer)
    .innerJoin(learningLayerRevision, eq(learningLayerRevision.id, learningLayer.currentDraftRevisionId))
    .where(where)
    .orderBy(desc(learningLayer.updatedAt));
  return rows.map(({ layer, snapshot, number }) => {
    const { title, level, excerpt, segments } = snapshot as LearningLayerSnapshot;
    return {
      id: layer.id,
      contentItemId: layer.contentItemId,
      title,
      level,
      excerpt,
      segmentCount: segments.length,
      draftCount: segments.filter((segment) => segment.draft).length,
      revisionNumber: number,
    };
  });
}

/** A Video's Learning Layers, newest change first. */
export const layersOfVideo = (db: Database, contentItemId: string) =>
  summaries(db, eq(learningLayer.contentItemId, contentItemId));

/** The Learning Layers someone may open: every one for an editor, an Educator's assigned ones. */
export async function layersFor(db: Database, actor: Actor) {
  if (can(actor, { action: "content.edit" })) return summaries(db, undefined);
  const assigned = await db
    .select({ id: learningLayerEducator.learningLayerId })
    .from(learningLayerEducator)
    .where(eq(learningLayerEducator.userId, actor.userId));
  return assigned.length
    ? summaries(
        db,
        inArray(
          learningLayer.id,
          assigned.map((row) => row.id),
        ),
      )
    : [];
}

/** The Videos someone may add Learning Layers to: every Video for an editor, an Educator's assigned ones. */
export async function videosFor(db: Database, actor: Actor) {
  const rows = await db
    .select({ id: contentItem.id, snapshot: revision.snapshot })
    .from(contentItem)
    .innerJoin(revision, eq(revision.id, contentItem.currentDraftRevisionId))
    .where(
      can(actor, { action: "content.edit" })
        ? eq(contentItem.type, "video")
        : and(
            eq(contentItem.type, "video"),
            inArray(
              contentItem.id,
              db
                .select({ id: videoEducator.contentItemId })
                .from(videoEducator)
                .where(eq(videoEducator.userId, actor.userId)),
            ),
          ),
    )
    .orderBy(desc(contentItem.updatedAt));
  return rows.map((row) => ({ id: row.id, title: (row.snapshot as ArticleSnapshot).title }));
}

/** A Video's assigned Educators by name, for its Learning Layers page. */
export async function videoEducators(db: Database, contentItemId: string) {
  return namesOf(db, await videoEducatorIds(db, contentItemId));
}

/** The staff gate for Learning Layers: editors, and Educators (who see only what they're assigned). */
export async function requireLayerStaff(env: Env, request: Request) {
  const staff = await requireStaff(env, request);
  const isEditor = can(staff.actor, { action: "content.edit" });
  if (!isEditor && !staff.actor.roles.some((role) => role.role === "educator")) {
    throw new Response("Only editors and Educators work on Learning Layers.", { status: 403 });
  }
  return { ...staff, isEditor };
}
