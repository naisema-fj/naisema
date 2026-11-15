import {
  BadgeCheck,
  BookOpenText,
  CircleDashed,
  ExternalLink,
  Lightbulb,
  PencilLine,
  Puzzle,
  Quote,
  ScrollText,
  Shapes,
} from "lucide-react";
import { Fragment } from "react";
import { Icon } from "~/components/icons";
import { TableScroll } from "~/components/table-scroll";
import { formatDay } from "~/lib/rights-rules";
import {
  type Citation,
  type ExpressionDetails,
  type GrammarTable,
  searchKey,
  type UsageExample,
  vosaPath,
  vosaSlug,
} from "~/lib/vosa";
import type { WordPlayActivity } from "~/lib/vosa.server";
import sourcesData from "~/lib/vosa-data/sources.json";
import tuvavosaData from "~/lib/vosa-data/tuvavosa.json";

/**
 * Vosa's public pages, server-rendered (change note 0002). Everything reads without JavaScript;
 * the one script on an entry page (public/vosa/quiz.js) only answers a quiz choice at once.
 */

type Source = { id: string; name: string; role?: string; coverage?: string; href?: string };
const SOURCES = new Map((sourcesData as Source[]).map((source) => [source.id, source]));

const TUVAVOSA_CODES = tuvavosaData.codes as Record<string, string>;
const TUVAVOSA_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${[...tuvavosaData.names, ...Object.keys(TUVAVOSA_CODES)]
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})(?![\\p{L}\\p{N}])`,
  "giu",
);

/** Grammar terms by their search key, mapped to their Vosa address. */
export type TermLinks = Record<string, string>;

/** Text with its Tuvavosa grammar terms (and their short codes) linked to their entries. */
export function TuvavosaText({ text, terms }: { text: string; terms: TermLinks }) {
  const parts: React.ReactNode[] = [];
  let position = 0;
  for (const match of text.matchAll(TUVAVOSA_PATTERN)) {
    const index = match.index ?? 0;
    if (index > position) parts.push(text.slice(position, index));
    const name = TUVAVOSA_CODES[match[0].toLowerCase()] ?? match[0];
    const slug = terms[searchKey(name)];
    parts.push(
      slug ? (
        <a key={index} href={`/vosa/${encodeURIComponent(slug)}`} className="vosa-term" title={`${name}, in Tuvavosa`}>
          {match[0]}
        </a>
      ) : (
        match[0]
      ),
    );
    position = index + match[0].length;
  }
  if (position < text.length) parts.push(text.slice(position));
  return <>{parts}</>;
}

/** Whether an Expression is reviewed, said in words with its icon, never by colour alone. */
export function ReviewMark({ approval }: { approval: { createdAt: Date | string } | null }) {
  return approval ? (
    <span className="vosa-review vosa-review-done">
      <Icon icon={BadgeCheck} size={18} />
      Language reviewed · Standard Fijian · {formatDay(new Date(approval.createdAt))}
    </span>
  ) : (
    <span className="vosa-review vosa-review-draft">
      <Icon icon={CircleDashed} size={18} />
      Not reviewed yet
    </span>
  );
}

function sourceLink(citation: Citation) {
  const source = SOURCES.get(citation.sourceId);
  if (!source?.href) return null;
  return source.href + (citation.page ? `#page=${citation.page}` : "");
}

/** Where a meaning was found, each source with its page or section and a link where there is one. */
export function Citations({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <ul className="vosa-citations">
      {citations.map((citation) => {
        const source = SOURCES.get(citation.sourceId);
        const href = sourceLink(citation);
        const where = [
          citation.section ? `section ${citation.section}` : "",
          citation.page ? `page ${citation.page}` : "",
        ]
          .filter(Boolean)
          .join(", ");
        return (
          <li key={`${citation.sourceId}-${citation.page ?? ""}-${citation.section ?? ""}`}>
            {source?.name ?? "A source not listed"}
            {where && ` · ${where}`}
            {href && (
              <>
                {" · "}
                <a href={href} rel="noopener">
                  Open the source
                </a>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A Fijian phrase using the word, with the word picked out and its English below. */
export function Example({ example, headword }: { example: UsageExample; headword: string }) {
  // Each piece of the phrase, with its place in the phrase as its key, and whether to pick it out.
  const pieces = example.words?.length
    ? example.words.flatMap((word, index) => [
        ...(index > 0 ? [{ id: `space-${index}`, text: " ", focus: false }] : []),
        { id: `word-${index}`, text: word.text, focus: Boolean(word.focus) },
      ])
    : example.fijian.split(/(\s+)/).map((part, index) => ({
        id: `part-${index}`,
        text: part,
        focus: searchKey(part.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "")) === searchKey(headword),
      }));
  const words = pieces.map((piece) =>
    piece.focus ? <strong key={piece.id}>{piece.text}</strong> : <Fragment key={piece.id}>{piece.text}</Fragment>,
  );
  return (
    <figure className="vosa-example">
      <p lang="fj" className="vosa-example-fijian">
        {words}
        {example.words?.length ? example.punctuation : null}
      </p>
      <figcaption>{example.english}</figcaption>
    </figure>
  );
}

function Table({ table, terms }: { table: GrammarTable; terms: TermLinks }) {
  // Cells keyed by their place in the table, since the same text can appear in several.
  const columns = table.columns.map((text, index) => ({ id: `column-${index}`, text }));
  const rows = table.rows.map((cells, row) => ({
    id: `row-${row}`,
    cells: cells.map((text, index) => ({ id: `cell-${row}-${index}`, text, heading: index === 0 })),
  }));
  return (
    <figure className="vosa-table">
      <figcaption>{table.title}</figcaption>
      <TableScroll label={table.title}>
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id} scope="col">
                  <TuvavosaText text={column.text} terms={terms} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {row.cells.map((cell) =>
                  cell.heading ? (
                    <th key={cell.id} scope="row">
                      <TuvavosaText text={cell.text} terms={terms} />
                    </th>
                  ) : (
                    <td key={cell.id}>
                      <TuvavosaText text={cell.text} terms={terms} />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      {table.note && (
        <p className="vosa-table-note">
          <TuvavosaText text={table.note} terms={terms} />
        </p>
      )}
    </figure>
  );
}

/** How a word works in a phrase, or how a grammar term works: its role, marker, explanation and tables. */
export function GrammarSection({
  kind,
  headword,
  grammarNote,
  details,
  terms,
}: {
  kind: string;
  headword: string;
  grammarNote: string;
  details: ExpressionDetails;
  terms: TermLinks;
}) {
  const grammar = kind === "grammar-term";
  const has =
    grammar ||
    details.role ||
    details.marker ||
    grammarNote ||
    details.grammarExample ||
    (details.tables?.length ?? 0) > 0;
  if (!has) return null;
  const title = details.writingTerm
    ? "How this mark is used"
    : grammar
      ? "How this term works"
      : `How ${headword} works in a phrase`;
  return (
    <section className="vosa-part">
      <h3>
        <Icon icon={Shapes} size={20} />
        {title}
      </h3>
      {grammar && details.grammarCode && <p className="vosa-code">{details.grammarCode}</p>}
      {details.role && (
        <p className="vosa-role">
          {details.role.fijian ? (
            <>
              <TuvavosaText text={details.role.fijian} terms={terms} /> · {details.role.english}
            </>
          ) : (
            details.role.english
          )}
        </p>
      )}
      {details.marker && (
        <div className="vosa-marker">
          <p>
            <strong>
              {details.marker.kind}: {details.marker.forms}
            </strong>
          </p>
          {details.marker.position && (
            <p>
              <TuvavosaText text={details.marker.position} terms={terms} />
            </p>
          )}
          {details.marker.note && (
            <p>
              <TuvavosaText text={details.marker.note} terms={terms} />
            </p>
          )}
        </div>
      )}
      {grammarNote && (
        <p>
          <TuvavosaText text={grammarNote} terms={terms} />
        </p>
      )}
      {details.grammarExample && (
        <p className="vosa-recorded">
          Recorded form · <span lang="fj">{details.grammarExample}</span>
        </p>
      )}
      {details.tables?.map((table) => (
        <Table key={table.title} table={table} terms={terms} />
      ))}
    </section>
  );
}

/** Starting points for exploring the word: an insight, an example, a question and related words. */
export function ExploreSection({
  headword,
  details,
  linked,
  terms,
}: {
  headword: string;
  details: ExpressionDetails;
  linked: Record<string, string>;
  terms: TermLinks;
}) {
  const editorial = details.exploration ?? {};
  const insight = editorial.text || details.comparison || details.learnerComment || "";
  const question = editorial.question || details.curiosityQuestion || "";
  const related = [...new Set((details.relatedWords ?? []).map(vosaSlug))].filter(
    (slug) => slug !== vosaSlug(headword) && linked[slug],
  );
  if (!insight && !editorial.example && !question && !related.length) return null;
  return (
    <section className="vosa-part">
      <h3>
        <Icon icon={Lightbulb} size={20} />
        {editorial.title || `Explore ${headword}`}
      </h3>
      {insight && (
        <p>
          <TuvavosaText text={insight} terms={terms} />
        </p>
      )}
      {editorial.example && (
        <figure className="vosa-example">
          <p lang="fj" className="vosa-example-fijian">
            {editorial.example.fijian}
          </p>
          <figcaption>{editorial.example.english}</figcaption>
        </figure>
      )}
      {question && (
        <div className="vosa-wonder">
          <p className="vosa-wonder-label">Wonder about this</p>
          <p>{question}</p>
        </div>
      )}
      {related.length > 0 && (
        <p className="vosa-related">
          <span>Related Fijian words:</span>
          {related.map((slug) => (
            <a key={slug} href={`/vosa/${encodeURIComponent(slug)}`} lang="fj">
              {linked[slug]}
            </a>
          ))}
        </p>
      )}
      {details.furtherLink && (
        <p>
          <a href={details.furtherLink.href} rel="noopener noreferrer" className="vosa-out">
            {details.furtherLink.label}
            <Icon icon={ExternalLink} size={16} />
          </a>
        </p>
      )}
    </section>
  );
}

/** More about the word: other names, its scientific name and pictures elsewhere on the web. */
export function MoreSection({ details }: { details: ExpressionDetails }) {
  const images = (details.imageLinks ?? []).filter((link) => /^https?:\/\//.test(link.url));
  if (!details.variants?.length && !details.scientificName && !images.length) return null;
  return (
    <section className="vosa-part">
      <h3>
        <Icon icon={BookOpenText} size={20} />
        More about this word
      </h3>
      {details.variants?.length ? (
        <p>
          Other Fijian names on the poster: <span lang="fj">{details.variants.join(", ")}</span>
        </p>
      ) : null}
      {details.scientificName && (
        <p>
          Scientific name: <i>{details.scientificName}</i>
          {details.identificationNote && ` · ${details.identificationNote}`}
        </p>
      )}
      {images.length > 0 && (
        <p className="vosa-related">
          <span>See pictures online:</span>
          {images.map((link) => (
            <a key={link.url} href={link.url} rel="noopener noreferrer" className="vosa-out">
              {link.label}
              <Icon icon={ExternalLink} size={16} />
            </a>
          ))}
        </p>
      )}
    </section>
  );
}

/** Where to send a correction to an entry: NAISEMA's form, with the word filled in. */
export function CorrectionLink({ headword }: { headword: string }) {
  return (
    <p className="vosa-correction">
      <a href={`/forms/correct-word?word=${encodeURIComponent(headword)}`}>
        <Icon icon={PencilLine} size={18} />
        Suggest a correction
      </a>
    </p>
  );
}

/**
 * A headword's quizzes, as the apps site wrote them. Each answer is in a native disclosure, so the
 * quiz works without JavaScript; with it, choosing an option says at once whether it was right.
 */
export function Quiz({
  activities,
  headword,
  linked,
  sayings,
}: {
  activities: WordPlayActivity[];
  headword: string;
  linked: Record<string, string>;
  sayings: Record<string, { slug: string; headword: string }>;
}) {
  const self = vosaSlug(headword);
  const wordLink = (word: string | undefined) => {
    if (!word) return null;
    const slug = vosaSlug(word);
    return slug !== self && linked[slug] ? slug : null;
  };
  return (
    <>
      {activities.map((activity) => (
        <section key={activity.title} className="vosa-part vosa-quiz">
          <h3>
            <Icon icon={Puzzle} size={20} />
            {activity.title}
          </h3>
          <p>{activity.intro}</p>
          {activity.hint && (
            <details className="vosa-hint">
              <summary>Need a clue?</summary>
              <p>{activity.hint}</p>
            </details>
          )}
          <ol className="vosa-quiz-cards">
            {activity.cards.map((card) => {
              const link = wordLink(card.linkWord ?? card.word);
              const saying = card.sayingId ? sayings[card.sayingId] : null;
              const clues = (card.clues ?? []).map(wordLink).filter((slug): slug is string => Boolean(slug));
              return (
                <li
                  key={`${card.word ?? ""}|${card.question}`}
                  className="vosa-quiz-card"
                  data-hint={card.incorrectHint ?? ""}
                >
                  {card.options?.length ? (
                    <>
                      <p className="vosa-quiz-question">{card.question}</p>
                      <ul className="vosa-quiz-options">
                        {card.options.map((option) => (
                          <li key={option}>
                            <button
                              type="button"
                              className="vosa-quiz-option"
                              data-correct={option === card.correct ? "true" : "false"}
                              lang="fj"
                            >
                              {option}
                            </button>
                          </li>
                        ))}
                      </ul>
                      <p className="vosa-quiz-feedback" role="status" />
                    </>
                  ) : null}
                  <details className="vosa-quiz-answer">
                    <summary>
                      {card.options?.length ? (
                        "Show the explanation"
                      ) : (
                        <>
                          {card.word && (
                            <strong lang="fj" className="vosa-quiz-word">
                              {card.word}
                            </strong>
                          )}{" "}
                          {card.question}
                        </>
                      )}
                    </summary>
                    <p>{card.answer}</p>
                    {card.parts?.length ? (
                      <ul className="vosa-parts" aria-label="Parts of this word or phrase">
                        {card.parts.map((part) => {
                          const slug = wordLink(part.text) ?? wordLink(part.text.replace(/^-+|-+$/g, ""));
                          return (
                            <li key={`${part.text}-${part.role}`} className="vosa-part-chip">
                              {slug ? (
                                <a href={`/vosa/${encodeURIComponent(slug)}`} lang="fj">
                                  {part.text}
                                </a>
                              ) : (
                                <strong lang="fj">{part.text}</strong>
                              )}
                              <small>{part.role}</small>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                    {saying && (
                      <p>
                        <a href={vosaPath(saying.headword)}>Explore the saying: {saying.headword}</a>
                      </p>
                    )}
                    {card.cultureTerm && (
                      <p>
                        <a href="/apps/dictionary/?view=culture">Explore {card.cultureTerm} in Veiqaravi Vakavanua</a>
                      </p>
                    )}
                    {link && (
                      <p>
                        <a href={`/vosa/${encodeURIComponent(link)}`}>Open {linked[link]} in Vosa</a>
                      </p>
                    )}
                    {clues.length > 0 && (
                      <p className="vosa-related">
                        <span>Need a word clue?</span>
                        {clues.map((slug) => (
                          <a key={slug} href={`/vosa/${encodeURIComponent(slug)}`} lang="fj">
                            {linked[slug]}
                          </a>
                        ))}
                      </p>
                    )}
                  </details>
                </li>
              );
            })}
          </ol>
          {activity.after && <p>{activity.after}</p>}
          {activity.link && (
            <p>
              <a href={activity.link.href} rel="noopener noreferrer" className="vosa-out">
                {activity.link.label}
                <Icon icon={ExternalLink} size={16} />
              </a>
            </p>
          )}
        </section>
      ))}
    </>
  );
}

/** A saying's literal sense, before its meaning. */
export function LiteralLine({ literal }: { literal: string }) {
  if (!literal) return null;
  return (
    <p className="vosa-literal">
      <Icon icon={Quote} size={18} />
      <span>
        <strong>Word for word:</strong> {literal}
      </span>
    </p>
  );
}

/** The record an Expression carries from the apps site, for "Sources and review". */
export function AppsSiteLine({ details }: { details: ExpressionDetails }) {
  if (!details.appsSite) return null;
  return (
    <p className="vosa-history">
      <Icon icon={ScrollText} size={18} />
      <span>
        Brought over from Vosa's earlier collection on apps.naisema.com
        {details.appsSite.englishChecked ? ", where its English meaning had been checked" : ""}. That earlier check is
        not a NAISEMA language review.
      </span>
    </p>
  );
}
