import type { FormKey } from "./forms";

/**
 * The Fijian apps (apps.naisema.com), shown on NAISEMA at /apps. The apps site stays live on its own
 * host. Its material isn't served from NAISEMA until it has been through NAISEMA's own review,
 * so each app here says plainly where it is and what still has to happen (PUB-01). What
 * people send about an app comes in through NAISEMA's forms as a Submission and is never published
 * from there.
 */

export const APPS_SITE = "https://apps.naisema.com";

export type FijianApp = {
  key: string;
  name: string;
  summary: string;
  /** Where the app runs now, on the apps site. */
  href: string;
  /** What is still needed before it is part of NAISEMA, in the visitor's words. */
  notYetOpen: string;
  /** Where its reviewed part is on NAISEMA, once there is one. */
  onNaisema?: string;
  /** The forms that send something about this app to the team. */
  forms: FormKey[];
};

export const FIJIAN_APPS: FijianApp[] = [
  {
    key: "vosa",
    name: "Vosa, the Fijian dictionary",
    summary:
      "Fijian and English words, themes, grammar terms (Tuvavosa), proverbs and idioms (Vosavosavakaviti), a guide to veiqaravi vakavanua and icavuti by place.",
    href: `${APPS_SITE}/dictionary/`,
    notYetOpen:
      "Vosa is a learning guide, not an official dictionary. Its entries come to NAISEMA once each is reviewed.",
    forms: ["suggest-word", "correct-word"],
  },
  {
    key: "lessons",
    name: "Language lessons",
    summary:
      "Short interactive lessons: body words and possession, and inquiries into a drua (canoe) and a vale vakaviti (house).",
    href: `${APPS_SITE}/lessons/`,
    notYetOpen: "The lessons are previews. Their Fijian wording is waiting for a qualified speaker's review.",
    forms: [],
  },
  {
    key: "translation",
    name: "Community translation",
    summary:
      "Explore an idea, like the water cycle, and propose how it could be said in Fijian, with the reasons your wording fits.",
    href: `${APPS_SITE}/translation/`,
    notYetOpen: "This is a design preview. No Fijian term shown there has been approved yet.",
    forms: ["suggest-translation"],
  },
];
