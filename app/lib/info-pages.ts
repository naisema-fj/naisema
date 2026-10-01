/**
 * The footer's utility pages (docs/phase-1a-defaults.md §5). Their content arrives as Pages with
 * 1a-18 (#24); until then each says plainly that it is being written (PUB-01).
 */
export const INFO_PAGES = [
  { path: "about", title: "About", purpose: "who runs Na iSema, why it exists and how it is funded" },
  {
    path: "inclusion",
    title: "Inclusion",
    purpose: "how Na iSema works to be usable by everyone, and how to tell us when it isn't",
  },
  { path: "partners", title: "Partners", purpose: "organisations Na iSema has a Partnership Agreement with" },
  { path: "contact", title: "Contact", purpose: "how to reach the Na iSema team" },
  { path: "privacy", title: "Privacy", purpose: "what Na iSema collects, why, and how to see or delete it" },
  {
    path: "community-standards",
    title: "Community standards",
    purpose: "what is welcome here, and how to report something that isn't",
  },
] as const;

export type InfoPage = (typeof INFO_PAGES)[number];
