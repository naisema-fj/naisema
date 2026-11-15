import type { FormKey } from "./forms";

/**
 * The Fijian apps, first built on apps.naisema.com and now part of NAISEMA under /apps
 * (docs/decision-log.md, "The Fijian apps join NAISEMA"). They are previews: every dictionary
 * entry, lesson and term keeps the review state the apps site gave it and says so on the page
 * (PUB-01). None of it is a Content Item, so none of it carries a Review Label. What people send
 * about an app comes in through NAISEMA's forms as a Submission and is never published from there.
 */

/** The apps, as the apps site grouped them. */
export type FijianAppKey = "vosa" | "lessons" | "translation";

/** Each app page, at the address it had on the apps site, under /apps/ (app/lib/fijian-app-pages.server.ts). */
export const APP_PAGE_PATHS = {
  dictionary: "/apps/dictionary/",
  pronunciation: "/apps/dictionary/pronunciation/",
  lessons: "/apps/lessons/",
  "body-parts": "/apps/lessons/body-parts/",
  "vale-vakaviti": "/apps/vale-vakaviti/",
  "waqa-vakaviti": "/apps/waqa-vakaviti/",
  translation: "/apps/translation/",
} as const;

export type AppPageKey = keyof typeof APP_PAGE_PATHS;

export type FijianApp = {
  key: FijianAppKey;
  name: string;
  /** What kind of app it is, under its name. */
  kind: string;
  summary: string;
  /** Where the app opens. */
  href: string;
  /** How far along it is, in the visitor's words. */
  state: string;
  /** What visitors should know before relying on it. */
  caution: string;
  /** The words on its link. */
  open: string;
  /** The forms that send something about this app to the team. */
  forms: FormKey[];
};

export const FIJIAN_APPS: FijianApp[] = [
  {
    key: "vosa",
    name: "Vosa",
    kind: "Fijian dictionary",
    summary: "Search Fijian and English words, themes, grammar terms and sayings in the existing Vosa collection.",
    href: "/vosa",
    state: "Being reviewed",
    caution:
      "Vosa is a learning guide, not an official dictionary. Each entry says whether our Language Reviewer has checked it yet.",
    open: "Open the dictionary",
    forms: ["suggest-word", "correct-word"],
  },
  {
    key: "lessons",
    name: "Language learning",
    kind: "Lessons",
    summary: "Meet the body words, hide the labels, and unlock a first lesson on possession.",
    href: APP_PAGE_PATHS.lessons,
    state: "Lesson preview",
    caution: "The lessons are previews. Their Fijian wording is waiting for a qualified speaker's review.",
    open: "Explore lessons",
    forms: [],
  },
  {
    key: "translation",
    name: "Community translation",
    kind: "Design preview",
    summary: "Explore an idea, compare possible Fijian expressions and explain why they fit.",
    href: APP_PAGE_PATHS.translation,
    state: "Design preview",
    caution: "No Fijian term shown there has been approved yet.",
    open: "View page design",
    forms: ["suggest-translation"],
  },
];
