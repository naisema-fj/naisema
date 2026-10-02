import { fijiToday, latestToday } from "./calendar";
import { AGE_GUIDANCE } from "./resource-fields";

/**
 * Providers and their Offerings (CONTEXT.md; PART-01–03): plain listings editors keep, not
 * reviewed Content Items. Anything not known is stored empty, or as "unknown", and shown as "Not
 * known"; nothing is filled in by guessing. Listing implies no partnership or endorsement.
 */

/** A listed Provider's public page. */
export const providerPath = (slug: string) => `/connect/providers/${slug}`;

export const ORGANISATION_TYPES = {
  community: "Community group",
  school: "School or college",
  university: "University",
  church: "Church",
  teacher: "Individual teacher",
  business: "Business",
  government: "Government",
  other: "Other",
  unknown: "Not known",
} as const;
export type OrganisationType = keyof typeof ORGANISATION_TYPES;

export type ProviderDetails = {
  name: string;
  description: string;
  organisationType: OrganisationType;
  /** A town, island or country, as the Provider describes itself. */
  location: string;
  website: string;
  /** How to reach them, in words: "Email enrol@…", "Facebook page Lami Language School". */
  contactRoute: string;
  /** When an editor last checked these details, YYYY-MM-DD. */
  lastCheckedOn: string;
};

export const LEVELS = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  all: "All levels",
  unknown: "Not known",
} as const;
export type Level = keyof typeof LEVELS;

export const FORMATS = {
  online: "Online, live",
  self_paced: "Online, at your own pace",
  in_person: "In person",
  hybrid: "In person and online",
  unknown: "Not known",
} as const;
export type OfferingFormat = keyof typeof FORMATS;

export const AGE_SUITABILITY = { ...AGE_GUIDANCE, unknown: "Not known" } as const;
export type AgeSuitability = keyof typeof AGE_SUITABILITY;

/** How a visitor gets to an Offering: exactly one per Offering (PART-02). */
export const ACCESS_MODES = {
  external_link: "On the Provider's website",
  enquiry: "Ask the Provider",
  referral: "Through a Na iSema referral",
  authorised_embed: "Shared by Na iSema with the Provider's authorisation",
  licensed_native: "On Na iSema, under licence",
} as const;
export type AccessMode = keyof typeof ACCESS_MODES;

/** Access modes that need a current Partnership Agreement: Na iSema shows or hosts the Provider's work. */
export const PARTNER_ONLY_MODES: readonly AccessMode[] = ["authorised_embed", "licensed_native"];

export const HANDLED_BY = { provider: "The Provider", naisema: "Na iSema", unknown: "Not known" } as const;
export type HandledBy = keyof typeof HANDLED_BY;

export const COST_KINDS = { free: "Free", paid: "Paid", unknown: "Not known" } as const;
export type CostKind = keyof typeof COST_KINDS;

export type Cost = { kind: "free" } | { kind: "paid"; amount: string; currency: string } | { kind: "unknown" };

export type OfferingAccess =
  | { mode: "external_link" | "authorised_embed"; url: string }
  | { mode: "enquiry" }
  | { mode: "referral"; note: string }
  | { mode: "licensed_native"; contentItemId: string };

export type OfferingDetails = {
  title: string;
  summary: string;
  /** The language or Language Variety taught, in words. */
  languageVariety: string;
  level: Level;
  ageSuitability: AgeSuitability;
  accessibility: string;
  format: OfferingFormat;
  cost: Cost;
  /** YYYY-MM-DD, or empty when ongoing or not known. */
  startsOn: string;
  endsOn: string;
  access: OfferingAccess;
  enrolmentBy: HandledBy;
  supportBy: HandledBy;
};

export const LISTING_LIMITS = { name: 200, text: 2000, short: 300, url: 2000 } as const;

type Errors = Record<string, string>;
type Result<T> = { ok: true; details: T } | { ok: false; errors: Errors };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value: string) => DATE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());

function reader(form: FormData) {
  const errors: Errors = {};
  const text = (name: string, limit: number, missing?: string) => {
    const value = String(form.get(name) ?? "").trim();
    if (!value && missing) errors[name] = missing;
    else if (value.length > limit) errors[name] = `This can be at most ${limit} characters.`;
    return value;
  };
  const choice = <T extends string>(name: string, options: Record<T, string>, fallback: T, label: string): T => {
    const value = String(form.get(name) ?? "") || fallback;
    if (!Object.hasOwn(options, value)) {
      errors[name] = `Choose ${label} from the list.`;
      return fallback;
    }
    return value as T;
  };
  const url = (name: string, missing?: string) => {
    const value = text(name, LISTING_LIMITS.url, missing);
    if (value && !isSecureUrl(value)) errors[name] = "Enter a full web address starting with https://.";
    return value;
  };
  return { errors, text, choice, url };
}

/** Reads a Provider from its form. `today` bounds the last-checked date. */
export function readProviderFields(form: FormData, today = new Date()): Result<ProviderDetails> {
  const { errors, text, choice, url } = reader(form);
  const name = text("name", LISTING_LIMITS.name, "Enter the Provider's name.");
  const description = text("description", LISTING_LIMITS.text);
  const organisationType = choice<OrganisationType>(
    "organisationType",
    ORGANISATION_TYPES,
    "unknown",
    "the kind of organisation",
  );
  const location = text("location", LISTING_LIMITS.short);
  const website = url("website");
  const contactRoute = text("contactRoute", LISTING_LIMITS.short);
  const lastCheckedOn = text("lastCheckedOn", 10, "Enter the date you last checked these details.");
  if (lastCheckedOn && !isDate(lastCheckedOn)) errors.lastCheckedOn = "Enter the date you last checked these details.";
  else if (lastCheckedOn > latestToday(today)) errors.lastCheckedOn = "That date is in the future.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    details: { name, description, organisationType, location, website, contactRoute, lastCheckedOn },
  };
}

/** Reads an Offering from its form. */
export function readOfferingFields(form: FormData): Result<OfferingDetails> {
  const { errors, text, choice, url } = reader(form);
  const title = text("title", LISTING_LIMITS.name, "Enter the Offering's name.");
  const summary = text("summary", LISTING_LIMITS.text);
  const languageVariety = text("languageVariety", LISTING_LIMITS.short);
  const level = choice<Level>("level", LEVELS, "unknown", "a level");
  const ageSuitability = choice<AgeSuitability>("ageSuitability", AGE_SUITABILITY, "unknown", "who it suits");
  const accessibility = text("accessibility", LISTING_LIMITS.text);
  const format = choice<OfferingFormat>("format", FORMATS, "unknown", "a format");

  const costKind = choice<CostKind>("costKind", COST_KINDS, "unknown", "the cost");
  let cost: Cost = { kind: costKind === "paid" ? "unknown" : costKind };
  if (costKind === "paid") {
    const amount = text("costAmount", 20, "Enter the amount.");
    const currency = text("costCurrency", 3, "Enter the currency, like AUD.").toUpperCase();
    if (amount && !/^\d+(\.\d{1,2})?$/.test(amount)) errors.costAmount = "Enter the amount as a number, like 120.";
    if (currency && !/^[A-Z]{3}$/.test(currency))
      errors.costCurrency = "Enter the three-letter currency code, like AUD.";
    cost = { kind: "paid", amount, currency };
  }

  const startsOn = text("startsOn", 10);
  const endsOn = text("endsOn", 10);
  if (startsOn && !isDate(startsOn)) errors.startsOn = "Enter the start as a date.";
  if (endsOn && !isDate(endsOn)) errors.endsOn = "Enter the end as a date.";
  else if (startsOn && endsOn && endsOn < startsOn) errors.endsOn = "It can't end before it starts.";

  const mode = String(form.get("accessMode") ?? "");
  let access: OfferingAccess = { mode: "enquiry" };
  if (mode === "external_link" || mode === "authorised_embed") {
    access = { mode, url: url("accessUrl", "Enter the web address visitors go to.") };
  } else if (mode === "referral") {
    access = { mode, note: text("accessNote", LISTING_LIMITS.short, "Say how Na iSema refers people.") };
  } else if (mode === "licensed_native") {
    const contentItemId = text("accessContentItemId", 100, "Choose the Na iSema item it is on.");
    access = { mode, contentItemId };
  } else if (mode !== "enquiry") errors.accessMode = "Choose how visitors get to it.";

  const enrolmentBy = choice<HandledBy>("enrolmentBy", HANDLED_BY, "unknown", "who handles enrolment");
  const supportBy = choice<HandledBy>("supportBy", HANDLED_BY, "unknown", "who handles support");

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    details: {
      title,
      summary,
      languageVariety,
      level,
      ageSuitability,
      accessibility,
      format,
      cost,
      startsOn,
      endsOn,
      access,
      enrolmentBy,
      supportBy,
    },
  };
}

/** How a Provider or Offering is shown: listed or not, sponsored by whom, featured and why. */
export type ListingFlags = { listed: boolean; sponsoredBy: string | null; featureRationale: string | null };

/**
 * Reads a listing's flags. Sponsorship is always disclosed where the listing is shown, and an
 * editorial feature needs its selection rationale recorded (PUB-04), which is shown with it.
 */
export function readListingFlags(form: FormData): { ok: true; flags: ListingFlags } | { ok: false; errors: Errors } {
  const errors: Errors = {};
  const sponsoredBy = String(form.get("sponsoredBy") ?? "").trim();
  if (sponsoredBy.length > LISTING_LIMITS.short)
    errors.sponsoredBy = `This can be at most ${LISTING_LIMITS.short} characters.`;
  const featured = form.get("featured") === "on";
  const featureRationale = String(form.get("featureRationale") ?? "").trim();
  if (featured && !featureRationale) errors.featureRationale = "Say why it is featured; visitors see this.";
  else if (featureRationale.length > LISTING_LIMITS.short) {
    errors.featureRationale = `This can be at most ${LISTING_LIMITS.short} characters.`;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    flags: {
      listed: form.get("listed") === "on",
      sponsoredBy: sponsoredBy || null,
      featureRationale: featured ? featureRationale : null,
    },
  };
}

/**
 * Who sponsors what a visitor sees, disclosed wherever it is shown (PUB-04): an Offering's own
 * sponsor and its Provider's. Null when nobody does.
 */
export function sponsorsText(...sponsors: (string | null)[]) {
  const named = [...new Set(sponsors.filter((sponsor): sponsor is string => Boolean(sponsor)))];
  return named.length ? `Sponsored by ${named.join(" and ")}.` : null;
}

/** A submitted form's fields, to show it again as it was when it is refused. */
export const formValues = (form: FormData) =>
  Object.fromEntries([...form].map(([key, value]) => [key, String(value)])) as Record<string, string>;

/** The errors of every refused part of a listing form, together. */
export const listingErrors = (...results: ({ ok: true } | { ok: false; errors: Errors })[]) =>
  Object.assign({}, ...results.map((result) => (result.ok ? {} : result.errors))) as Errors;

/** A cost as visitors read it. */
export function costText(cost: Cost) {
  if (cost.kind === "free") return "Free";
  if (cost.kind === "paid") return `${cost.currency} ${cost.amount}`;
  return "Cost not known";
}

/** A recorded Partnership Agreement, as the Partner rule needs it. */
export type AgreementFacts = { startsOn: string; endsOn: string | null; endedAt: Date | null };

export type AgreementDetails = { reference: string; startsOn: string; endsOn: string | null };

/** Reads a Partnership Agreement from its form: where the signed copy is kept, its first and last days. */
export function readAgreementFields(form: FormData): Result<AgreementDetails> {
  const { errors, text } = reader(form);
  const reference = text("reference", LISTING_LIMITS.short, "Say where the signed agreement is kept.");
  const startsOn = text("startsOn", 10, "Enter the day it starts.");
  const endsOn = text("endsOn", 10);
  if (startsOn && !isDate(startsOn)) errors.startsOn = "Enter the day it starts.";
  if (endsOn && !isDate(endsOn)) errors.endsOn = "Enter its last day as a date.";
  else if (endsOn && endsOn < startsOn) errors.endsOn = "It can't end before it starts.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, details: { reference, startsOn, endsOn: endsOn || null } };
}

/**
 * Whether a Provider is a Partner right now (PART-03): an agreement has started, hasn't passed its
 * last day and hasn't been ended early. Agreement days are Fiji's. Only then is "Partner" shown.
 */
export function isPartner(agreements: AgreementFacts[], now = new Date()) {
  const day = fijiToday(now);
  return agreements.some(
    (agreement) =>
      !agreement.endedAt && agreement.startsOn <= day && (agreement.endsOn === null || day <= agreement.endsOn),
  );
}

export type OfferingFilters = {
  format: OfferingFormat | null;
  cost: "free" | "paid" | null;
  access: AccessMode | null;
  /** Words to find in the language taught. */
  language: string;
};

/** The filters a visitor chose on the Offerings listing, from its address. */
export function offeringFilters(params: URLSearchParams): OfferingFilters {
  const format = params.get("format") ?? "";
  const cost = params.get("cost") ?? "";
  const access = params.get("access") ?? "";
  return {
    format: format !== "unknown" && Object.hasOwn(FORMATS, format) ? (format as OfferingFormat) : null,
    cost: cost === "free" || cost === "paid" ? cost : null,
    access: Object.hasOwn(ACCESS_MODES, access) ? (access as AccessMode) : null,
    language: (params.get("language") ?? "").trim().slice(0, 100),
  };
}

function isSecureUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}
