/** The six primary areas of the public site (docs/phase-1a-defaults.md §5), in header order. */
export const PRIMARY_AREAS = ["learn", "voices", "discover", "connect", "ezine", "resources"] as const;
export type PrimaryArea = (typeof PRIMARY_AREAS)[number];

export const AREA_NAMES: Record<PrimaryArea, string> = {
  learn: "Learn",
  voices: "Voices",
  discover: "Discover",
  connect: "Connect",
  ezine: "E-zine",
  resources: "Resources",
};

export const isPrimaryArea = (value: string): value is PrimaryArea =>
  (PRIMARY_AREAS as readonly string[]).includes(value);

/**
 * What each area holds, and what in it isn't open yet (PUB-01: inactive services say so plainly).
 * `notYetOpen` names the services still being prepared, in the visitor's words.
 */
export const AREA_INFO: Record<PrimaryArea, { description: string; notYetOpen?: string }> = {
  learn: {
    description: "Fijian language and culture, one step at a time.",
    notYetOpen: "Videos with captions, word meanings and practice open once the first ones are reviewed.",
  },
  voices: {
    description: "Na iSema Voices: conversations with Fijians at home and abroad, each with a full transcript.",
  },
  discover: { description: "Places, history and the ways things are done." },
  connect: { description: "Classes, courses and people who teach." },
  ezine: { description: "Articles, essays and reflections." },
  resources: {
    description: "Guides and materials to use and share.",
    notYetOpen: "Downloadable guides and materials are being prepared.",
  },
};
