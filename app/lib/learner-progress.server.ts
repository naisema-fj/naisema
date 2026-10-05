import { and, desc, eq } from "drizzle-orm";
import {
  activityAttempt,
  bookmark,
  contentItem,
  expression,
  learnerAccount,
  learnerEvent,
  learnerVideoState,
  learningLayer,
  learningLayerRevision,
  savedVocabulary,
  user as userTable,
} from "~db/schema";
import { completionProgress } from "./activities";
import type { ExpressionDetails } from "./annotations";
import type { Database } from "./db.server";
import { isRecord } from "./editor-lists";
import { isStageId, type RealWorldChoice, type StageId, stageOfActivity } from "./immersion";
import {
  activityFingerprint,
  type LearnerLayerState,
  type ProgressEvent,
  progressForRevision,
  resumeAt,
} from "./learner-progress";
import { DEFAULT_PREFERENCES, type StageCaptions, type SupportPreferences } from "./learner-session";
import { type LearningLayerSnapshot, withDefaults } from "./learning-layer-fields";
import { logError } from "./log.server";
import { PLAYBACK_SPEEDS } from "./player-rules";
import { eligiblePublished, itemPath, layerPath } from "./public.server";
import { publicLayerById } from "./public-video.server";

/**
 * A Learner Account's records (#33): applying the events the player queues
 * (docs/phase-1a-defaults.md §8), and reading them back for the player, the private learning page
 * and the learner's own export. Every read and write is by the signed-in learner's own user ID, so
 * no learner can reach another's records, whatever IDs they send. What is shown of a saved item is
 * decided by eligibility, as for any public read (ADR-0007): a saved video or word whose Learning
 * Layer is no longer public is listed as no longer available, without its content.
 */

type PublicLayer = NonNullable<Awaited<ReturnType<typeof publicLayerById>>>;

const parse = (json: string | null): unknown => {
  try {
    return JSON.parse(json ?? "null");
  } catch {
    return null;
  }
};

const readVisited = (json: string): StageId[] => {
  const value = parse(json);
  return Array.isArray(value) ? value.filter(isStageId) : [];
};

const readRecord = (json: string): Record<string, unknown> => {
  const value = parse(json);
  return isRecord(value) ? value : {};
};

export function readPreferences(json: string | null): SupportPreferences {
  const stored = parse(json);
  if (!isRecord(stored)) return DEFAULT_PREFERENCES;
  return {
    speed: PLAYBACK_SPEEDS.find((speed) => speed === stored.speed) ?? 1,
    textRoute: stored.textRoute === true,
    alwaysCaptions: stored.alwaysCaptions === true,
  };
}

/** The Learning Layers events name, each looked up once per batch: public now, and the Revisions asked about. */
class LayerLookup {
  private layers = new Map<string, Promise<PublicLayer | null>>();
  private revisions = new Map<string, Promise<LearningLayerSnapshot | null>>();
  constructor(
    private db: Database,
    private now: Date,
  ) {}

  layer(layerId: string) {
    let found = this.layers.get(layerId);
    if (!found) {
      found = publicLayerById(this.db, layerId, this.now);
      this.layers.set(layerId, found);
    }
    return found;
  }

  /**
   * A Revision of a Learning Layer that is public now: its published one, or an earlier one a
   * learner was on before another was published. Null for anything else.
   */
  async revision(layerId: string, revisionId: string) {
    const layer = await this.layer(layerId);
    if (!layer) return null;
    if (layer.revisionId === revisionId) return layer.snapshot;
    let found = this.revisions.get(revisionId);
    if (!found) {
      found = this.db
        .select({ snapshot: learningLayerRevision.snapshot })
        .from(learningLayerRevision)
        .where(and(eq(learningLayerRevision.id, revisionId), eq(learningLayerRevision.learningLayerId, layerId)))
        .get()
        .then((row) => (row ? withDefaults(row.snapshot as LearningLayerSnapshot) : null));
      this.revisions.set(revisionId, found);
    }
    return found;
  }
}

type StateRow = typeof learnerVideoState.$inferSelect;

/** Changes a learner's state in one Learning Layer, starting it if there is none yet. */
async function changeState(
  db: Database,
  userId: string,
  start: { layerId: string; revisionId: string; stage: StageId },
  change: (state: StateRow | undefined) => Partial<StateRow>,
  now: Date,
) {
  const state = await db
    .select()
    .from(learnerVideoState)
    .where(and(eq(learnerVideoState.userId, userId), eq(learnerVideoState.learningLayerId, start.layerId)))
    .get();
  const values = { ...change(state), updatedAt: now };
  if (state) {
    await db
      .update(learnerVideoState)
      .set(values)
      .where(and(eq(learnerVideoState.userId, userId), eq(learnerVideoState.learningLayerId, start.layerId)));
  } else {
    await db.insert(learnerVideoState).values({
      userId,
      learningLayerId: start.layerId,
      revisionId: start.revisionId,
      stage: start.stage,
      ...values,
    });
  }
}

const addVisit = (state: StateRow | undefined, stage: StageId) => {
  const visited = readVisited(state?.visited ?? "[]");
  return JSON.stringify(visited.includes(stage) ? visited : [...visited, stage]);
};

/** Fingerprints of a Revision's Activities, by ID. */
const fingerprintsOf = async (snapshot: LearningLayerSnapshot) =>
  Object.fromEntries(
    await Promise.all(snapshot.activities.map(async (item) => [item.id, await activityFingerprint(item)] as const)),
  );

async function attemptsOn(db: Database, userId: string, layerId: string) {
  return db
    .select()
    .from(activityAttempt)
    .where(and(eq(activityAttempt.userId, userId), eq(activityAttempt.learningLayerId, layerId)));
}

/**
 * After an answer on the published Revision: records the Learning Layer as completed on it, once,
 * when its Completion Rule is met.
 */
async function recordCompletion(db: Database, userId: string, layer: PublicLayer, now: Date) {
  const state = await db
    .select()
    .from(learnerVideoState)
    .where(and(eq(learnerVideoState.userId, userId), eq(learnerVideoState.learningLayerId, layer.id)))
    .get();
  if (!state || state.completedRevisionId === layer.revisionId) return;
  const { progress } = progressForRevision({
    activities: layer.snapshot.activities,
    fingerprints: await fingerprintsOf(layer.snapshot),
    attempts: await attemptsOn(db, userId, layer.id),
    visited: [],
    realWorld: {},
  });
  if (!completionProgress(layer.snapshot.activities, progress.activities).complete) return;
  await db
    .update(learnerVideoState)
    .set({ completedAt: now, completedRevisionId: layer.revisionId })
    .where(and(eq(learnerVideoState.userId, userId), eq(learnerVideoState.learningLayerId, layer.id)));
}

/** Applies one event, or returns false when it names something the learner can't act on. */
async function applyEvent(db: Database, userId: string, event: ProgressEvent, lookup: LayerLookup, now: Date) {
  switch (event.type) {
    case "preferences": {
      const { speed, textRoute, alwaysCaptions } = event;
      await db
        .update(learnerAccount)
        .set({ preferences: JSON.stringify({ speed, textRoute, alwaysCaptions }) })
        .where(eq(learnerAccount.userId, userId));
      return true;
    }
    case "save-video": {
      const item = await db.select().from(contentItem).where(eq(contentItem.id, event.contentItemId)).get();
      if (!item || !(await eligiblePublished(db, item, now))) return false;
      await db.insert(bookmark).values({ userId, contentItemId: item.id, savedAt: now }).onConflictDoNothing();
      return true;
    }
    case "unsave-video":
      await db
        .delete(bookmark)
        .where(and(eq(bookmark.userId, userId), eq(bookmark.contentItemId, event.contentItemId)));
      return true;
    case "unsave-word":
      await db
        .delete(savedVocabulary)
        .where(
          and(
            eq(savedVocabulary.userId, userId),
            eq(savedVocabulary.expressionId, event.expressionId),
            event.revisionId ? eq(savedVocabulary.sourceRevisionId, event.revisionId) : undefined,
          ),
        );
      return true;
  }

  const snapshot = await lookup.revision(event.layerId, event.revisionId);
  if (!snapshot) return false;
  const start = { layerId: event.layerId, revisionId: event.revisionId };
  switch (event.type) {
    case "position": {
      if (event.segmentId && !snapshot.segments.some((segment) => segment.id === event.segmentId)) return false;
      await changeState(
        db,
        userId,
        { ...start, stage: event.stage },
        (state) => ({
          revisionId: event.revisionId,
          stage: event.stage,
          positionMs: event.positionMs,
          segmentId: event.segmentId,
          visited: addVisit(state, event.stage),
        }),
        now,
      );
      return true;
    }
    case "captions": {
      const { taught, english, underAlways } = event;
      await changeState(
        db,
        userId,
        { ...start, stage: event.stage },
        (state) => ({
          captions: JSON.stringify({
            ...readRecord(state?.captions ?? "{}"),
            [event.stage]: { taught, english, underAlways },
          }),
        }),
        now,
      );
      return true;
    }
    case "attempt": {
      const activity = snapshot.activities.find((item) => item.id === event.activityId);
      if (!activity || activity.kind === "real-world") return false;
      await db
        .insert(activityAttempt)
        .values({
          userId,
          id: event.id,
          learningLayerId: event.layerId,
          revisionId: event.revisionId,
          activityId: activity.id,
          activityFingerprint: await activityFingerprint(activity),
          correct: event.correct,
          attemptedAt: now,
        })
        .onConflictDoNothing();
      const stage = stageOfActivity(activity);
      await changeState(db, userId, { ...start, stage }, (state) => ({ visited: addVisit(state, stage) }), now);
      const layer = await lookup.layer(event.layerId);
      if (layer?.revisionId === event.revisionId) await recordCompletion(db, userId, layer, now);
      return true;
    }
    case "real-world": {
      const activity = snapshot.activities.find((item) => item.id === event.activityId);
      if (activity?.kind !== "real-world") return false;
      await changeState(
        db,
        userId,
        { ...start, stage: "use-it" },
        (state) => ({
          realWorld: JSON.stringify({ ...readRecord(state?.realWorld ?? "{}"), [activity.id]: event.choice }),
        }),
        now,
      );
      return true;
    }
    case "save-word": {
      if (!snapshot.expressions[event.expressionId]) return false;
      const known = await db
        .select({ id: expression.id })
        .from(expression)
        .where(eq(expression.id, event.expressionId))
        .get();
      if (!known) return false;
      await db
        .insert(savedVocabulary)
        .values({
          userId,
          expressionId: event.expressionId,
          sourceRevisionId: event.revisionId,
          learningLayerId: event.layerId,
          savedAt: now,
        })
        .onConflictDoNothing();
      return true;
    }
  }
}

/**
 * Applies a batch of a learner's events in the order sent (§8). An event already applied is only
 * acknowledged again. Position, stage and choices take the latest received; answers and saves
 * merge, and an answer never un-completes anything. Events that name something the learner can't
 * act on (a Learning Layer no longer public, an Activity not in the Revision), or that fail to
 * apply, are refused, and acknowledged too, since sending them again can't help.
 */
export async function applyProgressEvents(db: Database, userId: string, events: ProgressEvent[], now = new Date()) {
  const lookup = new LayerLookup(db, now);
  const refused: string[] = [];
  for (const event of events) {
    const seen = await db
      .select({ eventId: learnerEvent.eventId })
      .from(learnerEvent)
      .where(and(eq(learnerEvent.userId, userId), eq(learnerEvent.eventId, event.id)))
      .get();
    if (seen) continue;
    try {
      if (!(await applyEvent(db, userId, event, lookup, now))) refused.push(event.id);
    } catch (error) {
      // One event that can't be applied mustn't hold up the learner's queue for good.
      logError("Progress event not applied", { type: event.type, error });
      refused.push(event.id);
    }
    await db.insert(learnerEvent).values({ userId, eventId: event.id, receivedAt: now }).onConflictDoNothing();
  }
  return { refused };
}

const readCaptions = (json: string) =>
  Object.fromEntries(
    Object.entries(readRecord(json)).flatMap(([stage, value]) =>
      isStageId(stage) && isRecord(value)
        ? [
            [
              stage,
              {
                taught: value.taught === true,
                english: value.english === true,
                underAlways: value.underAlways === true,
              },
            ],
          ]
        : [],
    ),
  ) as Partial<Record<StageId, StageCaptions>>;

async function layerProgress(db: Database, userId: string, layer: PublicLayer, state: StateRow | undefined) {
  const result = progressForRevision({
    activities: layer.snapshot.activities,
    fingerprints: await fingerprintsOf(layer.snapshot),
    attempts: await attemptsOn(db, userId, layer.id),
    visited: readVisited(state?.visited ?? "[]"),
    realWorld: readRecord(state?.realWorld ?? "{}") as Record<string, RealWorldChoice>,
  });
  const completion = completionProgress(layer.snapshot.activities, result.progress.activities);
  const completedEarlier = Boolean(state?.completedRevisionId) && !completion.complete;
  return { ...result, completion, completedEarlier };
}

export async function learnerLayerState(
  db: Database,
  userId: string,
  layer: PublicLayer & { contentItemId: string },
): Promise<LearnerLayerState> {
  const [state, account, words, saved] = await Promise.all([
    db
      .select()
      .from(learnerVideoState)
      .where(and(eq(learnerVideoState.userId, userId), eq(learnerVideoState.learningLayerId, layer.id)))
      .get(),
    db.select().from(learnerAccount).where(eq(learnerAccount.userId, userId)).get(),
    db
      .select({ expressionId: savedVocabulary.expressionId })
      .from(savedVocabulary)
      .where(eq(savedVocabulary.userId, userId)),
    db
      .select({ contentItemId: bookmark.contentItemId })
      .from(bookmark)
      .where(and(eq(bookmark.userId, userId), eq(bookmark.contentItemId, layer.contentItemId)))
      .get(),
  ]);
  const { progress, earlier, completedEarlier } = await layerProgress(db, userId, layer, state);
  return {
    progress,
    earlier,
    completedEarlier,
    captions: state && state.revisionId === layer.revisionId ? readCaptions(state.captions) : {},
    resumeMs: state ? resumeAt(state, layer.revisionId, layer.snapshot.segments) : null,
    preferences: readPreferences(account?.preferences ?? null),
    savedWords: [...new Set(words.map((word) => word.expressionId))],
    videoSaved: Boolean(saved),
  };
}

/** A public Learning Layer's player address, with the Video it is on. */
async function layerAddress(db: Database, layerId: string) {
  const row = await db
    .select({ item: contentItem })
    .from(learningLayer)
    .innerJoin(contentItem, eq(contentItem.id, learningLayer.contentItemId))
    .where(eq(learningLayer.id, layerId))
    .get();
  return row ? { path: layerPath(row.item, layerId), contentItemId: row.item.id } : null;
}

const sameWords = (a: ExpressionDetails, b: ExpressionDetails) =>
  a.headword === b.headword &&
  a.generalMeaning === b.generalMeaning &&
  a.grammarNote === b.grammarNote &&
  a.pronunciation === b.pronunciation &&
  (a.literalMeaning ?? null) === (b.literalMeaning ?? null);

/**
 * The private learning page: Learning Layers to carry on with, most recent first, saved videos and
 * saved words. Only what is public right now is shown; anything else is listed as no longer
 * available, by nothing but that.
 */
export async function learningPage(db: Database, userId: string, now = new Date()) {
  const lookup = new LayerLookup(db, now);
  const [states, bookmarks, words] = await Promise.all([
    db
      .select()
      .from(learnerVideoState)
      .where(eq(learnerVideoState.userId, userId))
      .orderBy(desc(learnerVideoState.updatedAt)),
    db.select().from(bookmark).where(eq(bookmark.userId, userId)).orderBy(desc(bookmark.savedAt)),
    db.select().from(savedVocabulary).where(eq(savedVocabulary.userId, userId)).orderBy(desc(savedVocabulary.savedAt)),
  ]);

  const learning = await Promise.all(
    states.map(async (state) => {
      const layer = await lookup.layer(state.learningLayerId);
      const address = layer ? await layerAddress(db, layer.id) : null;
      if (!layer || !address) return { layerId: state.learningLayerId, available: false as const };
      const { completion, completedEarlier } = await layerProgress(db, userId, layer, state);
      return {
        layerId: layer.id,
        available: true as const,
        title: layer.snapshot.title,
        path: `${address.path}?stage=${state.stage}`,
        stage: state.stage as StageId,
        completion,
        completedEarlier,
      };
    }),
  );

  const videos = await Promise.all(
    bookmarks.map(async ({ contentItemId, savedAt }) => {
      const item = await db.select().from(contentItem).where(eq(contentItem.id, contentItemId)).get();
      const published = item ? await eligiblePublished(db, item, now) : null;
      if (!item || !published) return { contentItemId, available: false as const, savedAt };
      return {
        contentItemId,
        available: true as const,
        savedAt,
        title: published.snapshot.title,
        path: itemPath(item),
      };
    }),
  );

  const vocabulary = await Promise.all(
    words.map(async (word) => {
      const key = { expressionId: word.expressionId, revisionId: word.sourceRevisionId };
      const layer = await lookup.layer(word.learningLayerId);
      const source = await lookup.revision(word.learningLayerId, word.sourceRevisionId);
      const current = layer?.snapshot.expressions[word.expressionId];
      const saved = source?.expressions[word.expressionId];
      const address = layer ? await layerAddress(db, layer.id) : null;
      if (!layer || !current || !address) return { ...key, available: false as const };
      return {
        ...key,
        available: true as const,
        expression: current,
        updated: Boolean(saved && !sameWords(saved, current)),
        layerTitle: layer.snapshot.title,
        layerPath: address.path,
      };
    }),
  );

  return { learning, videos, vocabulary };
}

/**
 * Everything a Learner Account holds, for the learner's own download (DATA-01): the account,
 * saves, where they are in each Learning Layer and every answer. IDs are the site's own; the
 * words saved are as the learner saw them.
 */
export async function exportLearnerData(db: Database, userId: string) {
  const [account, bookmarks, words, states, attempts] = await Promise.all([
    db
      .select({
        email: userTable.email,
        createdAt: userTable.createdAt,
        adultDeclaredAt: learnerAccount.adultDeclaredAt,
        lastActiveAt: learnerAccount.lastActiveAt,
        preferences: learnerAccount.preferences,
      })
      .from(learnerAccount)
      .innerJoin(userTable, eq(userTable.id, learnerAccount.userId))
      .where(eq(learnerAccount.userId, userId))
      .get(),
    db
      .select({ contentItemId: bookmark.contentItemId, savedAt: bookmark.savedAt, title: contentItem.slug })
      .from(bookmark)
      .innerJoin(contentItem, eq(contentItem.id, bookmark.contentItemId))
      .where(eq(bookmark.userId, userId)),
    db
      .select({
        expressionId: savedVocabulary.expressionId,
        sourceRevisionId: savedVocabulary.sourceRevisionId,
        learningLayerId: savedVocabulary.learningLayerId,
        savedAt: savedVocabulary.savedAt,
        headword: expression.headword,
      })
      .from(savedVocabulary)
      .innerJoin(expression, eq(expression.id, savedVocabulary.expressionId))
      .where(eq(savedVocabulary.userId, userId)),
    db.select().from(learnerVideoState).where(eq(learnerVideoState.userId, userId)),
    db.select().from(activityAttempt).where(eq(activityAttempt.userId, userId)),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    account: account && {
      email: account.email,
      createdAt: account.createdAt.toISOString(),
      declaredAdultAt: account.adultDeclaredAt.toISOString(),
      lastActiveAt: account.lastActiveAt.toISOString(),
      preferences: readPreferences(account.preferences),
    },
    savedVideos: bookmarks.map((saved) => ({
      contentItemId: saved.contentItemId,
      slug: saved.title,
      savedAt: saved.savedAt.toISOString(),
    })),
    savedWords: words.map((word) => ({
      expressionId: word.expressionId,
      headword: word.headword,
      learningLayerId: word.learningLayerId,
      revisionId: word.sourceRevisionId,
      savedAt: word.savedAt.toISOString(),
    })),
    learning: states.map((state) => ({
      learningLayerId: state.learningLayerId,
      revisionId: state.revisionId,
      stage: state.stage,
      positionMs: state.positionMs,
      stagesVisited: readVisited(state.visited),
      captions: readCaptions(state.captions),
      realWorldChoices: readRecord(state.realWorld),
      completedAt: state.completedAt?.toISOString() ?? null,
      completedRevisionId: state.completedRevisionId,
      updatedAt: state.updatedAt.toISOString(),
    })),
    answers: attempts.map((attempt) => ({
      id: attempt.id,
      learningLayerId: attempt.learningLayerId,
      revisionId: attempt.revisionId,
      activityId: attempt.activityId,
      correct: attempt.correct,
      answeredAt: attempt.attemptedAt.toISOString(),
    })),
  };
}
