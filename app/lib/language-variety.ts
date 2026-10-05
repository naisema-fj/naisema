/**
 * Language Varieties are compared exactly (a language review approves one variety), so every place
 * that accepts one writes it the same way: lower-case words joined by hyphens, like
 * "standard-fijian". Returns null when nothing usable is left.
 */
export function toLanguageVariety(input: string): string | null {
  const variety = input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return /^[a-z0-9-]{1,60}$/.test(variety) ? variety : null;
}

/** The language tag (BCP 47) for text in a Language Variety, for `lang` and caption tracks. */
const LANGUAGE_TAGS: Record<string, string> = { "standard-fijian": "fj" };

export const languageTag = (variety: string) => LANGUAGE_TAGS[variety] ?? "und";

/** A Language Variety as visitors read it. */
const LANGUAGE_NAMES: Record<string, string> = { "standard-fijian": "Fijian" };

export const languageName = (variety: string) => LANGUAGE_NAMES[variety] ?? variety;
