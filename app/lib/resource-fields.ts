import { latestToday } from "./calendar";

/**
 * What a Resource adds to a Content Item (docs/phase-1a-defaults.md, resource behaviour): a file
 * from the media library or an external link, and what a visitor needs to know before downloading
 * or following it. Stored in the Resource's Revision snapshot.
 */

export type ResourceSource = { kind: "file"; assetId: string } | { kind: "link"; url: string; checkedOn: string };

export type ResourceDetails = {
  source: ResourceSource;
  /** The language or Language Variety the resource is in, in words: "Standard Fijian and English". */
  language: string;
  ageGuidance: AgeGuidance;
  /** Its accessibility features, or what it lacks, in words. */
  accessibility: string;
  /** What a visitor may do with it, in words: "Free to print and share for teaching". */
  usageTerms: string;
};

export const AGE_GUIDANCE = {
  "all-ages": "All ages",
  children: "Children, with an adult",
  teens: "Teenagers and adults",
  adults: "Adults",
} as const;

export type AgeGuidance = keyof typeof AGE_GUIDANCE;

export const RESOURCE_LIMITS = { language: 100, accessibility: 500, usageTerms: 300, url: 2000 } as const;

export type ResourceField =
  | "resourceKind"
  | "resourceAssetId"
  | "resourceUrl"
  | "resourceCheckedOn"
  | "resourceLanguage"
  | "resourceAgeGuidance"
  | "resourceAccessibility"
  | "resourceUsageTerms";

export type ResourceFieldsResult =
  | { ok: true; details: ResourceDetails }
  | { ok: false; errors: Partial<Record<ResourceField, string>>; values: Partial<ResourceDetails> };

const isAgeGuidance = (value: string): value is AgeGuidance => Object.hasOwn(AGE_GUIDANCE, value);

/** Reads a Resource's fields from the content form. `today` bounds the link's last-checked date. */
export function readResourceFields(form: FormData, today = new Date()): ResourceFieldsResult {
  const errors: Partial<Record<ResourceField, string>> = {};
  const text = (name: ResourceField, limit: number, missing: string | null) => {
    const value = String(form.get(name) ?? "").trim();
    if (!value && missing) errors[name] = missing;
    else if (value.length > limit) errors[name] = `This can be at most ${limit} characters.`;
    return value;
  };

  let source: ResourceSource | null = null;
  const kind = String(form.get("resourceKind") ?? "");
  if (kind === "file") {
    const assetId = String(form.get("resourceAssetId") ?? "");
    if (!assetId) errors.resourceAssetId = "Choose the file from the media library.";
    else source = { kind: "file", assetId };
  } else if (kind === "link") {
    const url = text("resourceUrl", RESOURCE_LIMITS.url, "Enter the web address.");
    const checkedOn = String(form.get("resourceCheckedOn") ?? "").trim();
    if (url && !isSecureUrl(url)) errors.resourceUrl = "Enter a full web address starting with https://.";
    const checked = /^\d{4}-\d{2}-\d{2}$/.test(checkedOn) ? new Date(`${checkedOn}T00:00:00Z`) : null;
    if (!checked || Number.isNaN(checked.getTime())) {
      errors.resourceCheckedOn = "Enter the date you last checked the link works.";
    } else if (checkedOn > latestToday(today)) {
      errors.resourceCheckedOn = "That date is in the future.";
    }
    source = { kind: "link", url, checkedOn };
  } else {
    errors.resourceKind = "Choose whether this is a file to download or a link to another site.";
  }

  const language = text("resourceLanguage", RESOURCE_LIMITS.language, "Enter the language it is in.");
  const ageGuidance = String(form.get("resourceAgeGuidance") ?? "");
  if (!isAgeGuidance(ageGuidance)) errors.resourceAgeGuidance = "Choose who it is suitable for.";
  const accessibility = text("resourceAccessibility", RESOURCE_LIMITS.accessibility, null);
  const usageTerms = text(
    "resourceUsageTerms",
    RESOURCE_LIMITS.usageTerms,
    "Say what visitors may do with it, such as print or share it.",
  );

  if (Object.keys(errors).length || !source || !isAgeGuidance(ageGuidance)) {
    return {
      ok: false,
      errors,
      values: {
        ...(source ? { source } : {}),
        language,
        ...(isAgeGuidance(ageGuidance) ? { ageGuidance } : {}),
        accessibility,
        usageTerms,
      },
    };
  }
  return { ok: true, details: { source, language, ageGuidance, accessibility, usageTerms } };
}

function isSecureUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/** The site a link goes to, as a visitor reads it before following it: "example.org". */
export const linkHost = (url: string) => new URL(url).hostname.replace(/^www\./, "");
