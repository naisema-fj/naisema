/**
 * What a Creator Profile adds to a Content Item (CRE-01; CONTEXT.md, Creator): where the Creator
 * is, at a level that can't find their door; the languages and kinds of media they work in; a
 * consented portrait from the media library; and one free sample of their work, a Na iSema item.
 * Their chosen public name is the item's title and their biography its body.
 */

export const MEDIA_TYPES = {
  video: "Video",
  audio: "Audio and podcasts",
  music: "Music",
  writing: "Writing",
  photography: "Photography",
  art: "Art",
  craft: "Craft",
  teaching: "Teaching",
} as const;
export type MediaType = keyof typeof MEDIA_TYPES;

export type CreatorDetails = {
  /** A town, island or country. */
  location: string;
  languages: string[];
  mediaTypes: MediaType[];
  /** A media library image; it needs its own Rights Record, the consent of the person shown. */
  portraitAssetId: string;
  /** One published Na iSema item, free to everyone, showing their work. */
  sampleItemId: string;
};

export const CREATOR_LIMITS = { location: 100, language: 60, languages: 10 } as const;

export type CreatorField =
  | "creatorLocation"
  | "creatorLanguages"
  | "creatorMediaType"
  | "creatorPortraitAssetId"
  | "creatorSampleItemId";

export type CreatorFieldsResult =
  | { ok: true; details: CreatorDetails }
  | { ok: false; errors: Partial<Record<CreatorField, string>>; values: Partial<CreatorDetails> };

const isMediaType = (value: string): value is MediaType => Object.hasOwn(MEDIA_TYPES, value);

export function readCreatorFields(form: FormData): CreatorFieldsResult {
  const errors: Partial<Record<CreatorField, string>> = {};
  const field = (name: CreatorField) => String(form.get(name) ?? "").trim();

  const location = field("creatorLocation");
  if (!location) errors.creatorLocation = "Enter where they are: a town, island or country.";
  else if (location.length > CREATOR_LIMITS.location) {
    errors.creatorLocation = `This can be at most ${CREATOR_LIMITS.location} characters.`;
  } else if (/\d/.test(location)) {
    // Numbers mean a street address or postcode, which could lead someone to their door.
    errors.creatorLocation = "Give only a town, island or country, without numbers.";
  }

  const languages = field("creatorLanguages")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (languages.length > CREATOR_LIMITS.languages) {
    errors.creatorLanguages = `List at most ${CREATOR_LIMITS.languages} languages.`;
  } else if (languages.some((language) => language.length > CREATOR_LIMITS.language)) {
    errors.creatorLanguages = `Each language can be at most ${CREATOR_LIMITS.language} characters.`;
  }

  const chosen = form.getAll("creatorMediaType").map(String);
  const mediaTypes = chosen.filter(isMediaType);
  if (!mediaTypes.length || mediaTypes.length !== chosen.length) {
    errors.creatorMediaType = "Choose the kinds of media they work in.";
  }

  const portraitAssetId = field("creatorPortraitAssetId");
  if (!portraitAssetId) errors.creatorPortraitAssetId = "Choose their portrait from the media library.";
  const sampleItemId = field("creatorSampleItemId");
  if (!sampleItemId) errors.creatorSampleItemId = "Choose the free sample of their work.";

  const values = { location, languages, mediaTypes, portraitAssetId, sampleItemId };
  if (Object.keys(errors).length) return { ok: false, errors, values };
  return { ok: true, details: values };
}
