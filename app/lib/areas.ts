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
