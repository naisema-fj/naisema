import { describe, expect, it } from "vitest";
import { readCreatorFields } from "~/lib/creator-fields";

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const each of [value].flat()) data.append(name, each);
  }
  return data;
};

const profile = {
  creatorLocation: "Taveuni",
  creatorLanguages: "Standard Fijian\nEnglish\n",
  creatorMediaType: ["music", "video"],
  creatorPortraitAssetId: "portrait-1",
  creatorSampleItemId: "item-1",
};

describe("readCreatorFields (CRE-01)", () => {
  it("reads where they are, their languages and media, their portrait and their free sample", () => {
    expect(readCreatorFields(form(profile))).toEqual({
      ok: true,
      details: {
        location: "Taveuni",
        languages: ["Standard Fijian", "English"],
        mediaTypes: ["music", "video"],
        portraitAssetId: "portrait-1",
        sampleItemId: "item-1",
      },
    });
  });

  it("keeps the location general: no street numbers or postcodes", () => {
    expect(readCreatorFields(form({ ...profile, creatorLocation: "12 Marine Drive, Suva 1234" }))).toMatchObject({
      ok: false,
      errors: { creatorLocation: expect.stringContaining("town, island or country") },
    });
  });

  it("needs at least one kind of media, a portrait and a free sample", () => {
    expect(readCreatorFields(form({ creatorLocation: "Suva", creatorMediaType: ["hologram"] }))).toMatchObject({
      ok: false,
      errors: {
        creatorMediaType: expect.any(String),
        creatorPortraitAssetId: expect.any(String),
        creatorSampleItemId: expect.any(String),
      },
    });
  });
});
