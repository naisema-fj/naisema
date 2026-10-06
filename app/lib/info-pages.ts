/**
 * The footer's utility pages (docs/phase-1a-defaults.md §5). Their content arrives as Pages with
 * 1a-18 (#24); until then each says plainly that it is being written (PUB-01).
 */
export const INFO_PAGES = [
  { path: "about", title: "About", purpose: "who runs NAISEMA, why it exists and how it is funded" },
  {
    path: "inclusion",
    title: "Inclusion",
    purpose: "how NAISEMA works to be usable by everyone, and how to tell us when it isn't",
  },
  {
    path: "accessibility",
    title: "Accessibility",
    purpose: "the known accessibility problems on NAISEMA and how to tell us about one (§6)",
  },
  { path: "partners", title: "Partners", purpose: "organisations NAISEMA has a Partnership Agreement with" },
  { path: "contact", title: "Contact", purpose: "how to reach the NAISEMA team" },
  { path: "privacy", title: "Privacy", purpose: "what NAISEMA collects, why, and how to see or delete it" },
  {
    path: "community-standards",
    title: "Community standards",
    purpose: "what is welcome here, and how to report something that isn't",
  },
] as const;

export type InfoPage = (typeof INFO_PAGES)[number];
