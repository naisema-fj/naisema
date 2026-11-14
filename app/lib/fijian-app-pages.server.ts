import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NoticeField, TurnstileField } from "~/components/public/form-fields";
import bodyParts from "~/fijian-apps/pages/body-parts.html?raw";
import dictionary from "~/fijian-apps/pages/dictionary.html?raw";
import lessons from "~/fijian-apps/pages/lessons.html?raw";
import pronunciation from "~/fijian-apps/pages/pronunciation.html?raw";
import translation from "~/fijian-apps/pages/translation.html?raw";
import valeVakaviti from "~/fijian-apps/pages/vale-vakaviti.html?raw";
import waqaVakaviti from "~/fijian-apps/pages/waqa-vakaviti.html?raw";
import { APP_PAGE_PATHS, type AppPageKey, type FijianAppKey } from "./fijian-apps";

/**
 * The Fijian apps' pages, brought over from apps.naisema.com as previews (docs/decision-log.md,
 * "The Fijian apps join NAISEMA"). Each is the apps site's own markup in app/fijian-apps/pages,
 * served at the same place under /apps/ that it had on the apps site, so the relative addresses in
 * its markup, styles and scripts still find their files in public/apps. React renders the page on
 * the server and never hydrates it; the page's own script files run instead (`selfScripts`).
 *
 * Nothing on these pages is published content: every entry, lesson and term keeps the review
 * state the apps site gave it, and what visitors send goes through NAISEMA's forms as Submissions.
 */

type AppPage = {
  title: string;
  description: string;
  app: FijianAppKey;
  body: string;
  /** Style sheets, relative to the page, in order. */
  styles: string[];
  /** Script files, relative to the page, run in order once the page is read. */
  scripts: string[];
  /** Whether the page asks for corrections, as the apps site's "open to correction" note did. */
  correctable: boolean;
};

/** Where a form on the page needs the privacy notice and Turnstile's check put in. */
export const FORM_CHECK_MARK = "<!--naisema:form-check-->";

const PAGES: Record<AppPageKey, AppPage> = {
  dictionary: {
    title: "Vosa, the Fijian dictionary",
    description: "Fijian words in context, with meanings, Tuvavosa, examples, and sayings from Fiji.",
    app: "vosa",
    body: dictionary,
    styles: ["styles.css", "senses.css", "naisema-theme.css", "fiji-skin.css", "icavuti.css"],
    scripts: [
      "data.js",
      "grammar-contrasts.js",
      "explorations.js",
      "word-play.js",
      "grammar-inquiries.js",
      "relationship-inquiries.js",
      "context-inquiries.js",
      "analysis-inquiries.js",
      "everyday-inquiries.js",
      "field-inquiries.js",
      "batch-20261105-inquiries.js",
      "viti-house-inquiries.js",
      "marine-food-inquiries.js",
      "../language.js",
      "culture-guide.js",
      "community-editor.js",
      "icavuti.js",
      "app.js",
    ],
    correctable: true,
  },
  pronunciation: {
    title: "Fijian pronunciation library",
    description: "Learn Fijian letter sounds with voice recordings. Tap any letter to listen.",
    app: "vosa",
    body: pronunciation,
    styles: ["style.css"],
    scripts: ["app.js"],
    correctable: false,
  },
  lessons: {
    title: "Language lessons",
    description: "Explore NAISEMA language lessons and choose where to begin.",
    app: "lessons",
    body: lessons,
    styles: ["../styles.css", "styles.css"],
    scripts: [],
    correctable: true,
  },
  "body-parts": {
    title: "Body words and possession",
    description: "A lesson preview: explore Fijian body words, recall them, then learn body-part possession.",
    app: "lessons",
    body: bodyParts,
    styles: ["styles.css", "vibrant.css"],
    scripts: ["lesson.js"],
    correctable: true,
  },
  "vale-vakaviti": {
    title: "Explore a vale vakaviti",
    description: "A design preview: an inquiry into the parts of a vale vakaviti.",
    app: "lessons",
    body: valeVakaviti,
    styles: ["styles.css"],
    scripts: ["parts-data.js", "app.js"],
    correctable: true,
  },
  "waqa-vakaviti": {
    title: "Explore a drua",
    description: "A design preview: explore a drua by choosing a point and questioning the source clues.",
    app: "lessons",
    body: waqaVakaviti,
    styles: ["styles.css", "styles-v4.css", "inquiries.css", "language.css"],
    scripts: ["scenes-data.js", "lexicon-data.js", "app.js", "language.js", "inquiry-builder.js", "lexicon.js"],
    correctable: true,
  },
  translation: {
    title: "Follow the water: community translation",
    description: "Explore the water cycle and sketch Fijian expressions for each idea.",
    app: "translation",
    body: translation,
    styles: ["../styles.css", "styles.css"],
    scripts: ["app.js"],
    correctable: true,
  },
};

/** The page served at a path, written with its closing slash as the apps site wrote it. */
export function findAppPage(pathname: string) {
  const key = (Object.keys(APP_PAGE_PATHS) as AppPageKey[]).find((page) => APP_PAGE_PATHS[page] === pathname);
  return key ? { key, ...PAGES[key] } : null;
}

const at = (path: string, href: string) => new URL(href, `https://naisema.invalid${path}`).pathname;

const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** The way between the apps, as the apps site showed it above each app. */
function appSwitcher(current: FijianAppKey, path: string) {
  const links: [string, string, FijianAppKey | null][] = [
    ["/apps/#apps", "All apps", null],
    [APP_PAGE_PATHS.dictionary, "Vosa dictionary", "vosa"],
    [APP_PAGE_PATHS.lessons, "Language lessons", "lessons"],
    [APP_PAGE_PATHS.translation, "Community translation", "translation"],
  ];
  const items = links
    .map(([href, label, app]) => {
      const here = href === path ? ' aria-current="page"' : app === current ? ' aria-current="true"' : "";
      return `<a href="${href}"${here}>${label}</a>`;
    })
    .join("");
  return `<nav class="app-switcher" aria-label="Apps navigation"><a class="app-back" href="/apps/#apps"><span aria-hidden="true">←</span> All apps</a><details class="app-menu"><summary><span aria-hidden="true">☰</span> Apps menu</summary><div class="app-menu-list">${items}</div></details></nav>`;
}

/**
 * The apps site's "open to correction" note, which its script added to the end of the page. Its
 * form now lives on NAISEMA's correction form, which knows the page it came from.
 */
function correctionNote(path: string) {
  const href = `/forms/page-correction?page=${encodeURIComponent(path)}`;
  return `<aside id="naisema-correctable-inquiry" class="naisema-correctable-inquiry" aria-labelledby="naisema-correctable-title"><span class="naisema-correctable-mark" aria-hidden="true">?</span><div><h2 id="naisema-correctable-title">An inquiry open to correction</h2><p>The information on this page is our current interpretation of the resources we have investigated. It may be incomplete or mistaken. Feedback from Fijian speakers, communities, and people who practise this knowledge may lead us to correct or expand it.</p><p>If you offer a correction, please identify the word, image, or explanation, its place and context, and the source or knowledge holder we should consult. Share community knowledge only with appropriate permission.</p><p class="naisema-correction-action"><a class="naisema-correction-link" href="${escapeHtml(href)}">Suggest a correction</a></p></div></aside>`;
}

/** NAISEMA's privacy notice and Turnstile's check, as every public form has them. */
const formCheck = (siteKey: string) =>
  renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      createElement(NoticeField, { values: {}, errors: {} }),
      createElement(TurnstileField, { siteKey }),
    ),
  );

/** What the page needs: its markup with NAISEMA's parts put in, and its files at their addresses. */
export function renderAppPage(page: NonNullable<ReturnType<typeof findAppPage>>, siteKey: string) {
  const path = APP_PAGE_PATHS[page.key];
  let body = page.body;
  const turnstile = body.includes(FORM_CHECK_MARK);
  if (turnstile) body = body.replace(FORM_CHECK_MARK, formCheck(siteKey));
  if (page.correctable) body = body.replace(/<\/main>/, `${correctionNote(path)}</main>`);
  return {
    key: page.key,
    title: page.title,
    description: page.description,
    turnstile,
    html: appSwitcher(page.app, path) + body,
    // The apps' navigation styles come after the page's own, as on the apps site, where they win.
    styles: [
      ...page.styles.map((href) => at(path, href)),
      "/apps/app-navigation.css",
      ...(page.correctable ? ["/apps/assets/correctable-inquiry.css"] : []),
      "/apps/naisema-embed.css",
    ],
    scripts: page.scripts.map((src) => at(path, src)),
  };
}
