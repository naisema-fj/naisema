import { useEffect, useState } from "react";
import { data, Form, Link, redirect } from "react-router";
import { SaveStatus, useProgressQueue } from "~/components/learner-account";
import { cloudflareContext } from "~/lib/cloudflare";
import { stageText } from "~/lib/immersion";
import { languageName, languageTag } from "~/lib/language-variety";
import { LEARNER_PATHS } from "~/lib/learner-progress";
import { applyProgressEvents, learningPage } from "~/lib/learner-progress.server";
import { clearHistory, deleteLearnerAccount } from "~/lib/learner-records.server";
import { fromThisSite, requireLearner, requireOwnRecords, signOutLearner } from "~/lib/learners.server";
import { LAYER_LANGUAGE_VARIETY } from "~/lib/learning-layer-fields";
import { progressQueue } from "~/lib/progress-queue.client";
import { PRIVATE_NO_STORE } from "~/lib/public-cache.server";
import type { RouteHandle } from "~/lib/route-handle";
import type { Route } from "./+types/index";

/**
 * GET /account — a learner's private learning page (#33): what to carry on with, the videos and
 * words they saved, and their data: download it, clear their history or delete the account. Never
 * cached or indexed; it hydrates only to tell them about changes still queued on this device.
 */
export const handle: RouteHandle = { noindex: true };
export const headers = () => ({ "Cache-Control": PRIVATE_NO_STORE });

export function meta() {
  return [{ title: "Your learning · Na iSema" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const learner = await requireLearner(env, request);
  requireOwnRecords(learner, "learnerRecord.read");
  return {
    userId: learner.userId,
    email: learner.email,
    welcome: new URL(request.url).searchParams.has("welcome"),
    ...(await learningPage(learner.db, learner.userId)),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  if (!fromThisSite(request)) throw new Response("Cross-site request refused", { status: 403 });
  const learner = await requireLearner(env, request);
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  switch (form.get("intent")) {
    case "unsave-video":
      requireOwnRecords(learner, "learnerRecord.write");
      await applyProgressEvents(learner.db, learner.userId, [
        { id: crypto.randomUUID(), type: "unsave-video", contentItemId: id },
      ]);
      return { done: "The video is no longer saved." };
    case "unsave-word":
      requireOwnRecords(learner, "learnerRecord.write");
      await applyProgressEvents(learner.db, learner.userId, [
        {
          id: crypto.randomUUID(),
          type: "unsave-word",
          expressionId: id,
          revisionId: form.get("revision") ? String(form.get("revision")) : null,
        },
      ]);
      return { done: "The word is no longer saved." };
    case "clear-history":
      requireOwnRecords(learner, "learnerRecord.delete");
      await clearHistory(learner.db, learner.userId);
      return { done: "Your history is cleared. Your saved videos and words are still here." };
    case "delete-account": {
      if (form.get("confirm") !== "yes") {
        return data({ deleteError: "Tick the box to confirm you want your account deleted." }, { status: 400 });
      }
      requireOwnRecords(learner, "learnerRecord.delete");
      const headers = await signOutLearner(env, request);
      await deleteLearnerAccount(learner.db, learner.userId, "learner.deleted");
      throw redirect(`${LEARNER_PATHS.signIn}?deleted`, { headers });
    }
  }
  return data({ error: "That couldn't be done. Reload the page and try again." }, { status: 400 });
}

/**
 * A form that forgets this device's progress queue before it is sent, so changes still queued
 * can't bring back what it removes, or stay on a shared device. It is sent as a whole page, so it
 * works the same without JavaScript (when there is no queue to forget). `clearsIf` names a box
 * that must be ticked for the queue to be forgotten; `warn` asks first if anything is unsaved.
 */
function ForgetsQueue({
  userId,
  intent,
  action,
  clearsIf,
  warn,
  className,
  children,
}: {
  userId: string;
  intent?: string;
  action?: string;
  clearsIf?: string;
  warn?: (waiting: number) => string;
  className?: string;
  children: React.ReactNode;
}) {
  const { status } = useProgressQueue(userId);
  return (
    <Form
      method="post"
      action={action}
      reloadDocument
      noValidate
      className={className}
      onSubmit={async (event) => {
        const form = event.currentTarget;
        event.preventDefault();
        if (warn && status.waiting && !window.confirm(warn(status.waiting))) return;
        const box = clearsIf ? form.elements.namedItem(clearsIf) : null;
        if (!(box instanceof HTMLInputElement) || box.checked) await progressQueue(userId).clear();
        form.submit();
      }}
    >
      {intent && <input type="hidden" name="intent" value={intent} />}
      {children}
    </Form>
  );
}

export default function YourLearning({ loaderData, actionData }: Route.ComponentProps) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const { status } = useProgressQueue(hydrated ? loaderData.userId : null);
  const result = actionData && "done" in actionData ? actionData.done : null;
  const deleteError = actionData && "deleteError" in actionData ? actionData.deleteError : null;
  const error = actionData && "error" in actionData ? actionData.error : null;
  const language = { tag: languageTag(LAYER_LANGUAGE_VARIETY), name: languageName(LAYER_LANGUAGE_VARIETY) };

  return (
    <main id="main">
      <article className="letter account-page">
        <h1>Your learning</h1>
        <p className="standfirst">
          Signed in as {loaderData.email}. Only you can see this page.
          {loaderData.welcome && " Welcome: your account is ready, and everything you save from now on is kept here."}
        </p>
        {result && <p role="status">{result}</p>}
        {error && (
          <p role="alert" className="form-alert">
            {error}
          </p>
        )}
        {hydrated && status.waiting > 0 && <SaveStatus status={status} />}

        <section aria-labelledby="continue-heading">
          <h2 id="continue-heading">Carry on learning</h2>
          {loaderData.learning.length ? (
            <ul className="account-list">
              {loaderData.learning.map((entry) =>
                entry.available ? (
                  <li key={entry.layerId}>
                    <Link reloadDocument to={entry.path}>
                      {entry.title}
                    </Link>
                    <p className="meta">
                      {entry.completion.complete
                        ? "Completed."
                        : entry.completedEarlier
                          ? "You completed an earlier version; it has changed since."
                          : entry.completion.required
                            ? `${entry.completion.done} of ${entry.completion.required} needed Activities done.`
                            : "Nothing to complete here yet."}{" "}
                      Last at: {stageText(entry.stage, language.name).name}.
                    </p>
                  </li>
                ) : (
                  <li key={entry.layerId}>A video you were learning from is no longer available.</li>
                ),
              )}
            </ul>
          ) : (
            <p>
              Nothing yet. Open "Explore the language" on any video story, and where you are is kept here.{" "}
              <Link reloadDocument to="/search">
                Find something to learn
              </Link>
            </p>
          )}
        </section>

        <section aria-labelledby="videos-heading">
          <h2 id="videos-heading">Saved videos</h2>
          {loaderData.videos.length ? (
            <ul className="account-list">
              {loaderData.videos.map((video) => (
                <li key={video.contentItemId}>
                  {video.available ? (
                    <Link reloadDocument to={video.path}>
                      {video.title}
                    </Link>
                  ) : (
                    "A saved video that is no longer available."
                  )}{" "}
                  <Form method="post" className="inline-form">
                    <input type="hidden" name="id" value={video.contentItemId} />
                    <button type="submit" name="intent" value="unsave-video">
                      Remove<span className="visually-hidden"> {video.available ? video.title : "this video"}</span>
                    </button>
                  </Form>
                </li>
              ))}
            </ul>
          ) : (
            <p>No saved videos. "Save this video" is above each video's language player.</p>
          )}
        </section>

        <section aria-labelledby="words-heading">
          <h2 id="words-heading">Saved words</h2>
          {loaderData.vocabulary.length ? (
            <dl className="vocabulary-list">
              {loaderData.vocabulary.map((word) =>
                word.available ? (
                  <div key={`${word.expressionId}-${word.revisionId}`}>
                    <dt>
                      <span lang={language.tag}>{word.expression.headword}</span>
                    </dt>
                    <dd>
                      <p>Generally: {word.expression.generalMeaning}</p>
                      {word.expression.literalMeaning && <p>Literally: {word.expression.literalMeaning}</p>}
                      {word.expression.grammarNote && <p>Grammar: {word.expression.grammarNote}</p>}
                      {word.expression.pronunciation && <p>Said: {word.expression.pronunciation}</p>}
                      {word.updated && <p className="meta">Updated since you saved it.</p>}
                      <p className="meta">
                        From{" "}
                        <Link reloadDocument to={`${word.layerPath}?stage=words`}>
                          {word.layerTitle}
                        </Link>
                      </p>
                      <Form method="post" className="inline-form">
                        <input type="hidden" name="id" value={word.expressionId} />
                        <input type="hidden" name="revision" value={word.revisionId} />
                        <button type="submit" name="intent" value="unsave-word">
                          Remove<span className="visually-hidden"> {word.expression.headword}</span>
                        </button>
                      </Form>
                    </dd>
                  </div>
                ) : (
                  <div key={`${word.expressionId}-${word.revisionId}`}>
                    <dt>A saved word that is no longer available</dt>
                    <dd>
                      <Form method="post" className="inline-form">
                        <input type="hidden" name="id" value={word.expressionId} />
                        <input type="hidden" name="revision" value={word.revisionId} />
                        <button type="submit" name="intent" value="unsave-word">
                          Remove<span className="visually-hidden"> this word</span>
                        </button>
                      </Form>
                    </dd>
                  </div>
                ),
              )}
            </dl>
          ) : (
            <p>No saved words. "Save" is beside each word in a video's "Words and meanings".</p>
          )}
        </section>

        <section aria-labelledby="data-heading">
          <h2 id="data-heading">Your data</h2>
          <p>
            <a href={LEARNER_PATHS.export} download>
              Download everything in your account
            </a>{" "}
            (a JSON file).
          </p>
          <ForgetsQueue userId={loaderData.userId} intent="clear-history">
            <p>Clearing your history forgets where you are in each video and your answers, at once.</p>
            <button type="submit">Clear my history</button>
          </ForgetsQueue>
          <ForgetsQueue userId={loaderData.userId} intent="delete-account" clearsIf="confirm" className="danger-zone">
            <h3>Delete your account</h3>
            <p>
              This deletes your account and everything saved in it, at once. It can't be undone. Copies in our backups
              are deleted within 35 days.
            </p>
            {deleteError && (
              <p role="alert" className="field-error" id="confirm-error">
                {deleteError}
              </p>
            )}
            <div className="form-choice">
              <input
                type="checkbox"
                id="confirm"
                name="confirm"
                value="yes"
                aria-describedby={deleteError ? "confirm-error" : undefined}
              />
              <label htmlFor="confirm">I understand my account and everything in it will be deleted</label>
            </div>
            <button type="submit">Delete my account</button>
          </ForgetsQueue>
        </section>

        <section aria-labelledby="sign-out-heading">
          <h2 id="sign-out-heading">Signing out</h2>
          <p>Signing out forgets your account on this device. Your learning stays saved in your account.</p>
          <ForgetsQueue
            userId={loaderData.userId}
            action={LEARNER_PATHS.signOut}
            warn={(waiting) => `${waiting} changes on this device aren't saved yet. Sign out and lose them?`}
          >
            <button type="submit">Sign out</button>
          </ForgetsQueue>
        </section>
      </article>
    </main>
  );
}
