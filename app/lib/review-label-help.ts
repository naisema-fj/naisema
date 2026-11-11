/**
 * What each public Review Label means, in a visitor's words, for the "What's this?" help beside
 * the labels and the guide at /how-it-works. The labels themselves are generated only from real
 * Review Approvals (reviewLabels in app/lib/content-rules.ts); this only explains them, so a
 * label added there without an entry here shows no explanation rather than a wrong one.
 */
const MEANINGS = [
  {
    startsWith: "Language reviewed",
    name: "Language reviewed",
    meaning: "someone who knows that form of Fijian checked the language, on the date shown.",
  },
  {
    startsWith: "Cultural context reviewed",
    name: "Cultural context reviewed",
    meaning: "a person with standing to speak for that knowledge approved how it is told.",
  },
  {
    startsWith: "Opinion",
    name: "Opinion",
    meaning: "this is a personal view or experience, not a settled account.",
  },
] as const;

export type LabelMeaning = { name: string; meaning: string };

/** Every meaning, for the guide. */
export const ALL_LABEL_MEANINGS: readonly LabelMeaning[] = MEANINGS;

/** The meanings of just the labels an item shows, once each, in the order shown. */
export function meaningsOfLabels(labels: readonly string[]): LabelMeaning[] {
  const found: LabelMeaning[] = [];
  for (const label of labels) {
    const match = MEANINGS.find((entry) => label.startsWith(entry.startsWith));
    if (match && !found.includes(match)) found.push(match);
  }
  return found;
}
