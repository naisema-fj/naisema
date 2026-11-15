import { sql } from "drizzle-orm";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CircleDashed,
  Info,
  Plus,
  Search as SearchIcon,
} from "lucide-react";
import { Icon } from "~/components/icons";
import { NotOpen, PageHead } from "~/components/public/parts";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { publicHeaders } from "~/lib/http";
import { EXPRESSION_KIND_NAMES, type ExpressionKind, VOSA_THEMES } from "~/lib/vosa";
import { VOSA_VARIETY, vosaListing } from "~/lib/vosa.server";
import { expression } from "~db/schema";
import type { Route } from "./+types/vosa";

export const handle = { hydrate: false };
export const headers = publicHeaders;

const THEMES = VOSA_THEMES;

/** Vosa's views, as the apps site had them: words, themes, Tuvavosa and sayings. */
const VIEWS = {
  words: { label: "Words", kind: "word" as ExpressionKind | undefined },
  themes: { label: "Themes", kind: undefined },
  tuvavosa: { label: "Tuvavosa", kind: "grammar-term" as ExpressionKind },
  sayings: { label: "Vosavosavakaviti", kind: "saying" as ExpressionKind },
} as const;
type View = keyof typeof VIEWS;
const isView = (value: string): value is View => Object.hasOwn(VIEWS, value);

const GRAMMAR_GROUPS = ["Building blocks", "Noun phrase", "Predicate phrase", "Word building and roles", "Other"];

/** The parts of Vosa still on the apps preview (#118), until they move onto NAISEMA's model. */
const PREVIEW_PARTS = [
  { href: "/apps/dictionary/pronunciation/", label: "Pronunciation" },
  { href: "/apps/dictionary/?view=culture", label: "Vakavanua" },
  { href: "/apps/dictionary/?view=icavuti", label: "Icavuti" },
];

/**
 * GET /vosa?view=&q=&theme=&group=&page=: Vosa, the Fijian dictionary, from the Standard Fijian
 * Expression library (change note 0002). Drafts are shown and say so; reviewed words come first.
 * Search words never reach logs (the request log drops query strings).
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const viewParam = url.searchParams.get("view") ?? "words";
  const view: View = isView(viewParam) ? viewParam : "words";
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
  const themeParam = url.searchParams.get("theme") ?? "";
  const theme = THEMES.find((item) => item.id === themeParam) ?? null;
  const groupParam = url.searchParams.get("group") ?? "";
  const group = GRAMMAR_GROUPS.includes(groupParam) ? groupParam : null;
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1;
  const db = getDb(context.get(cloudflareContext).env.DB);

  if (view === "themes" && !theme) {
    const counts = await db.all<{ theme: string; words: number }>(
      sql`select json_each.value as theme, count(distinct ${expression.slug}) as words from ${expression}, json_each(${expression.themes}) where ${expression.variety} = ${VOSA_VARIETY} group by json_each.value`,
    );
    const byTheme = new Map(counts.map((row) => [row.theme, row.words]));
    return {
      view,
      q,
      theme: null,
      group,
      themes: THEMES.map((item) => ({ ...item, words: byTheme.get(item.id) ?? 0 })).filter((item) => item.words),
      listing: null,
    };
  }
  // A search from the words view looks through every kind, as Vosa's search box did.
  const kind = q && view === "words" ? undefined : VIEWS[view].kind;
  const listing = await vosaListing(db, {
    q,
    kind,
    theme: theme?.id,
    grammarGroup: view === "tuvavosa" ? (group ?? undefined) : undefined,
    page,
  });
  return { view, q, theme, group, themes: null, listing };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const part =
    loaderData?.theme?.title ?? (loaderData && loaderData.view !== "words" ? VIEWS[loaderData.view].label : "");
  return [
    { title: `${part ? `${part} · ` : ""}Vosa, the Fijian dictionary · NAISEMA` },
    {
      name: "description",
      content: "Fijian words in context, with meanings, Tuvavosa, examples and sayings from Fiji.",
    },
  ];
}

const pageHref = (params: Record<string, string | number | null | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value && !(key === "view" && value === "words")) search.set(key, String(value));
  const text = search.toString();
  return `/vosa${text ? `?${text}` : ""}`;
};

export default function Vosa({ loaderData }: Route.ComponentProps) {
  const { view, q, theme, group, themes, listing } = loaderData;
  return (
    <main id="main" className="area-page">
      <article className="pane pane-wide area-pane vosa" aria-labelledby="vosa-heading">
        <PageHead
          tone="learn"
          icon={BookOpen}
          headingId="vosa-heading"
          title="Vosa"
          plate={
            <p className="lede">
              Fijian words, in context. Find meanings, examples, related words, grammar and sayings from Fiji.
            </p>
          }
        />
        <NotOpen label="A learning guide, not an official dictionary.">
          Most entries are drafts that our Language Reviewer hasn't checked yet, and each one says so. Meanings may
          change after review.
        </NotOpen>

        <search>
          <form method="get" action="/vosa" className="search-form vosa-search">
            {view !== "words" && <input type="hidden" name="view" value={view} />}
            {theme && <input type="hidden" name="theme" value={theme.id} />}
            <p className="search-words">
              <label htmlFor="vosa-q" className="visually-hidden">
                Search Fijian and English words
              </label>
              <span className="search-box">
                <Icon icon={SearchIcon} size={24} />
                <input
                  id="vosa-q"
                  name="q"
                  type="search"
                  defaultValue={q}
                  autoComplete="off"
                  placeholder="Search Fijian or English…"
                />
              </span>
              <button type="submit" className="button">
                Search
              </button>
            </p>
          </form>
        </search>

        <nav aria-label="Vosa" className="vosa-views">
          <ul>
            {(Object.keys(VIEWS) as View[]).map((key) => (
              <li key={key}>
                <a href={pageHref({ view: key })} aria-current={key === view ? "page" : undefined}>
                  {VIEWS[key].label}
                </a>
              </li>
            ))}
            {PREVIEW_PARTS.map((part) => (
              <li key={part.href}>
                <a href={part.href}>
                  {part.label} <span className="vosa-preview-tag">(preview)</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {themes && (
          <section aria-labelledby="themes-heading">
            <h2 id="themes-heading">Words by theme</h2>
            <p>Choose a subject to see its words. Theme groupings came with Vosa and still need review.</p>
            <ul className="vosa-themes">
              {themes.map((item) => (
                <li key={item.id}>
                  <a href={pageHref({ view: "themes", theme: item.id })}>
                    <strong>{item.title}</strong>
                    <span>
                      {item.description} · {item.words.toLocaleString("en")} words
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {listing && (
          <section aria-labelledby="results-heading">
            <h2 id="results-heading">
              {q
                ? `Words matching “${q}”`
                : theme
                  ? theme.title
                  : view === "tuvavosa"
                    ? "Tuvavosa · Fijian grammar terms"
                    : view === "sayings"
                      ? "Vosavosavakaviti · sayings and idioms"
                      : "Words A to Z"}
            </h2>
            {theme && <p>{theme.description}. Theme groupings still need review.</p>}
            {view === "tuvavosa" && !q && (
              <ul className="vosa-chips" aria-label="Tuvavosa topics">
                <li>
                  <a href={pageHref({ view })} aria-current={!group ? "page" : undefined}>
                    All topics
                  </a>
                </li>
                {GRAMMAR_GROUPS.map((name) => (
                  <li key={name}>
                    <a href={pageHref({ view, group: name })} aria-current={group === name ? "page" : undefined}>
                      {name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="vosa-count" aria-live="polite">
              {listing.total.toLocaleString("en")} {listing.total === 1 ? "headword" : "headwords"} ·{" "}
              {listing.reviewed.toLocaleString("en")} reviewed
            </p>
            {listing.headwords.length ? (
              <ul className="vosa-list">
                {listing.headwords.map((word) => (
                  <li key={word.slug}>
                    <a href={`/vosa/${encodeURIComponent(word.slug)}`} className="vosa-list-word" lang="fj">
                      {word.headword}
                    </a>
                    <span className="vosa-list-meta">
                      {word.kind === "word" ? word.partOfSpeech || "Word" : EXPRESSION_KIND_NAMES[word.kind]}
                      {word.senses > 1 && ` · ${word.senses} meanings`}
                    </span>
                    <span className="vosa-list-meaning">{word.meaning || "Meaning still to be written."}</span>
                    <span className={`vosa-review ${word.reviewed ? "vosa-review-done" : "vosa-review-draft"}`}>
                      <Icon icon={word.reviewed ? BadgeCheck : CircleDashed} size={16} />
                      {word.reviewed ? "Reviewed" : "Not reviewed yet"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="vosa-empty">
                No words found. Try another spelling, or search in English.{" "}
                <a href={`/forms/suggest-word${q ? `?word=${encodeURIComponent(q)}` : ""}`}>Suggest a word</a> if it's
                missing.
              </p>
            )}
            {listing.pages > 1 && (
              <nav aria-label="Pages of results" className="vosa-pages">
                {listing.page > 1 ? (
                  <a
                    href={pageHref({ view, q, theme: theme?.id, group, page: listing.page - 1 })}
                    className="button button-soft"
                  >
                    <Icon icon={ArrowLeft} size={18} />
                    Previous
                  </a>
                ) : (
                  <span />
                )}
                <span>
                  Page {listing.page} of {listing.pages}
                </span>
                {listing.page < listing.pages ? (
                  <a
                    href={pageHref({ view, q, theme: theme?.id, group, page: listing.page + 1 })}
                    className="button button-soft"
                  >
                    Next
                    <Icon icon={ArrowRight} size={18} />
                  </a>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </section>
        )}

        <section className="vosa-help" aria-labelledby="vosa-help-heading">
          <h2 id="vosa-help-heading">
            <Icon icon={Info} size={22} />
            Help Vosa grow
          </h2>
          <p>
            Know a word that's missing, or a better meaning? Send it to the team. Every suggestion is checked before it
            joins Vosa.
          </p>
          <p className="button-row">
            <a href="/forms/suggest-word" className="button">
              <Icon icon={Plus} size={18} />
              Suggest a word
            </a>
            <a href="/forms/correct-word" className="button button-soft">
              Correct a dictionary entry
            </a>
          </p>
        </section>
      </article>
    </main>
  );
}
