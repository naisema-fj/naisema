import { data, redirect } from "react-router";
import { ArticleForm } from "~/components/article-form";
import { EMPTY_ARTICLE_BODY } from "~/lib/article-body";
import type { ArticleSnapshot } from "~/lib/article-fields";
import {
  articleFingerprints,
  availablePages,
  embeddableArticles,
  readArticleForm,
  readPrimaryArea,
} from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import { CONTENT_TYPE_NAMES, type ContentType, EPISODE_AREA, isContentType, PAGE_AREA } from "~/lib/content-types";
import type { Database } from "~/lib/db.server";
import { downloadChoices, episodeAudioChoices } from "~/lib/media-delivery.server";
import { createContentItem } from "~/lib/revisions.server";
import { listTopics } from "~/lib/topics.server";
import type { Route } from "./+types/new";

/** The type being created, from `?type=` (an Article unless it says otherwise). */
const typeOf = (request: Request): ContentType => {
  const type = new URL(request.url).searchParams.get("type") ?? "";
  return isContentType(type) ? type : "article";
};

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `New ${CONTENT_TYPE_NAMES[loaderData?.type ?? "article"].toLowerCase()} · Na iSema staff` }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db } = await requireEditor(context.get(cloudflareContext).env, request);
  const type = typeOf(request);
  const [topics, embeddable, files, audio, pages] = await Promise.all([
    listTopics(db),
    embeddableArticles(db),
    type === "resource" ? downloadChoices(db) : [],
    type === "episode" ? episodeAudioChoices(db) : [],
    type === "page" ? availablePages(db) : [],
  ]);
  return { type, topics, embeddable, pages, files, audio };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { db, actor } = await requireEditor(context.get(cloudflareContext).env, request);
  const type = typeOf(request);
  const form = await request.formData();
  const result = await readArticleForm(db, form, { type });
  const placement = await readPlacement(db, type, form);
  if (!result.ok || !placement.ok) {
    return data(
      {
        errors: { ...(result.ok ? {} : result.errors), ...(placement.ok ? {} : placement.errors) },
        values: result.ok ? result.snapshot : result.values,
      },
      { status: 400 },
    );
  }
  const id = await createContentItem(db, {
    type,
    ...placement.value,
    title: result.snapshot.title,
    snapshot: result.snapshot,
    fingerprints: await articleFingerprints(result.snapshot),
    createdBy: actor.userId,
  });
  throw redirect(`/admin/articles/${id}`);
}

/**
 * Where a new item goes: its primary area; Voices for an Episode; or for a Page, which site page it
 * is (its fixed address).
 */
async function readPlacement(db: Database, type: ContentType, form: FormData) {
  if (type === "episode") return { ok: true as const, value: { primaryArea: EPISODE_AREA as typeof EPISODE_AREA } };
  if (type === "page") {
    const path = String(form.get("page") ?? "");
    const page = (await availablePages(db)).find((candidate) => candidate.path === path);
    if (!page) return { ok: false as const, errors: { page: "Choose a site page that doesn't have a Page yet." } };
    return { ok: true as const, value: { primaryArea: PAGE_AREA as typeof PAGE_AREA, slug: page.path as string } };
  }
  const primaryArea = readPrimaryArea(form);
  if (!primaryArea) return { ok: false as const, errors: { primaryArea: "Choose the primary area." } };
  return { ok: true as const, value: { primaryArea } };
}

const EMPTY: ArticleSnapshot = {
  title: "",
  summary: "",
  credit: "",
  topicIds: [],
  body: EMPTY_ARTICLE_BODY,
  sources: "",
  flags: [],
  languageVariety: null,
};

export default function NewContent({ loaderData, actionData }: Route.ComponentProps) {
  const { type } = loaderData;
  const name = CONTENT_TYPE_NAMES[type].toLowerCase();
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin/articles">Back to content</a>
      </p>
      <h1>New {name}</h1>
      {type === "page" && !loaderData.pages.length ? (
        <p>Every site page already has a Page. Edit it from the content list.</p>
      ) : (
        <ArticleForm
          type={type}
          values={actionData?.values ?? EMPTY}
          errors={actionData?.errors}
          topics={loaderData.topics}
          embeddable={loaderData.embeddable}
          files={loaderData.files}
          audio={loaderData.audio}
          area={
            type === "page"
              ? { choose: "page", pages: loaderData.pages }
              : type === "episode"
                ? { choose: false, current: EPISODE_AREA }
                : { choose: true }
          }
          submitLabel="Save first revision"
        />
      )}
    </main>
  );
}
