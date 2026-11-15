import { BookOpen, Languages } from "lucide-react";
import { Icon } from "~/components/icons";
import { BackLink, PageHead } from "~/components/public/parts";
import {
  AppsSiteLine,
  Citations,
  CorrectionLink,
  Example,
  ExploreSection,
  GrammarSection,
  LiteralLine,
  MoreSection,
  Quiz,
  ReviewMark,
  TuvavosaText,
} from "~/components/public/vosa";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { publicHeaders } from "~/lib/http";
import type { RouteHandle } from "~/lib/route-handle";
import { EXPRESSION_KIND_NAMES, vosaSlug } from "~/lib/vosa";
import { grammarTermSlugs, vosaEntry } from "~/lib/vosa.server";
import type { Route } from "./+types/vosa-entry";

/** Server-rendered; its one script file answers a quiz choice at once (public/vosa/quiz.js). */
export const handle: RouteHandle = { hydrate: false, selfScripts: true };
export const headers = publicHeaders;

/**
 * GET /vosa/:slug: every Expression with this headword (change note 0002), each saying whether a
 * Language Reviewer has approved its current wording (ADR-0017).
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const db = getDb(context.get(cloudflareContext).env.DB);
  const slug = vosaSlug(params.slug);
  const entry = await vosaEntry(db, slug);
  if (!entry) throw new Response("Not found", { status: 404 });
  return { ...entry, terms: await grammarTermSlugs(db) };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Vosa · NAISEMA" }];
  const first = loaderData.expressions[0];
  return [
    { title: `${loaderData.headword} · Vosa, the Fijian dictionary · NAISEMA` },
    { name: "description", content: `${loaderData.headword}: ${first.generalMeaning || "a Fijian word in Vosa"}` },
  ];
}

export default function VosaEntry({ loaderData }: Route.ComponentProps) {
  const { headword, expressions, quiz, linked, sayings, terms } = loaderData;
  const count = expressions.length;
  const reviewed = expressions.filter((item) => item.approval).length;
  let quizShown = false;
  return (
    <main id="main" className="area-page">
      <article className="pane vosa vosa-entry" aria-labelledby="entry-heading">
        <BackLink to="/vosa">Vosa</BackLink>
        <PageHead
          tone="learn"
          icon={BookOpen}
          headingId="entry-heading"
          title={<span lang="fj">{headword}</span>}
          plate={
            <p className="lede">
              {count === 1 ? "One meaning" : `${count} meanings`}.{" "}
              {reviewed === 0
                ? "Not reviewed yet: this entry may change after review."
                : reviewed === count
                  ? "Language reviewed."
                  : `${reviewed} of ${count} reviewed.`}
            </p>
          }
        />
        {expressions.map((item, index) => {
          const showQuiz = !quizShown && item.details.quiz === true && quiz.length > 0;
          if (showQuiz) quizShown = true;
          return (
            <section key={item.id} className="vosa-sense" aria-labelledby={`sense-${item.id}`}>
              <header className="vosa-sense-head">
                <h2 id={`sense-${item.id}`}>
                  {count > 1 ? `Meaning ${index + 1}` : "Meaning"}
                  <span className="vosa-sense-kind">
                    {item.kind === "word" ? item.partOfSpeech || "Word" : EXPRESSION_KIND_NAMES[item.kind]}
                    {item.details.sayingLabel && ` · ${item.details.sayingLabel}`}
                  </span>
                </h2>
                <ReviewMark approval={item.approval} />
              </header>

              <LiteralLine literal={item.literalMeaning} />
              <p className="vosa-meaning">
                {item.generalMeaning ? (
                  <TuvavosaText text={item.generalMeaning} terms={terms} />
                ) : (
                  "The English meaning is still to be written."
                )}
              </p>

              {item.details.usageExamples?.length ? (
                <section className="vosa-part">
                  <h3>
                    <Icon icon={Languages} size={20} />
                    In a Fijian phrase
                  </h3>
                  <Example example={item.details.usageExamples[0]} headword={headword} />
                </section>
              ) : null}

              {showQuiz && <Quiz activities={quiz} headword={headword} linked={linked} sayings={sayings} />}

              <GrammarSection
                kind={item.kind}
                headword={headword}
                grammarNote={item.grammarNote}
                details={item.details}
                terms={terms}
              />
              <ExploreSection headword={headword} details={item.details} linked={linked} terms={terms} />
              <MoreSection details={item.details} />

              <details className="vosa-sources">
                <summary>Sources and review</summary>
                <Citations citations={item.citations} />
                {item.notes && (
                  <p>
                    <TuvavosaText text={item.notes} terms={terms} />
                  </p>
                )}
                <AppsSiteLine details={item.details} />
                <p>
                  <ReviewMark approval={item.approval} />
                </p>
              </details>
              <CorrectionLink headword={headword} />
            </section>
          );
        })}
      </article>
      {quiz.length > 0 && <script src="/vosa/quiz.js" defer />}
    </main>
  );
}
