import { describe, expect, it } from "vitest";
import {
  costText,
  isPartner,
  offeringFilters,
  readListingFlags,
  readOfferingFields,
  readProviderFields,
  sponsorsText,
} from "~/lib/listing-fields";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};
const today = new Date("2026-10-01T09:00:00Z");

describe("readProviderFields (PART-01)", () => {
  it("reads a Provider, keeping what isn't known empty rather than guessing", () => {
    expect(readProviderFields(form({ name: "Lami Language School", lastCheckedOn: "2026-09-30" }), today)).toEqual({
      ok: true,
      details: {
        name: "Lami Language School",
        description: "",
        organisationType: "unknown",
        location: "",
        website: "",
        contactRoute: "",
        lastCheckedOn: "2026-09-30",
      },
    });
  });

  it("needs a name, a secure website if any, and the date its details were last checked", () => {
    const result = readProviderFields(
      form({ website: "http://lami.example", organisationType: "spaceship", lastCheckedOn: "2026-10-03" }),
      today,
    );

    expect(result).toMatchObject({
      ok: false,
      errors: {
        name: expect.any(String),
        website: expect.stringContaining("https://"),
        organisationType: expect.any(String),
        lastCheckedOn: expect.stringContaining("future"),
      },
    });
  });
});

const offering = {
  title: "Conversational Fijian, evenings",
  accessMode: "external_link",
  accessUrl: "https://lami.example/enrol",
  costKind: "paid",
  costAmount: "120",
  costCurrency: "aud",
};

describe("readOfferingFields (PART-02)", () => {
  it("reads an Offering with exactly one access mode and its cost", () => {
    const result = readOfferingFields(form(offering));

    expect(result).toMatchObject({
      ok: true,
      details: {
        title: "Conversational Fijian, evenings",
        level: "unknown",
        format: "unknown",
        ageSuitability: "unknown",
        cost: { kind: "paid", amount: "120", currency: "AUD" },
        access: { mode: "external_link", url: "https://lami.example/enrol" },
        enrolmentBy: "unknown",
        supportBy: "unknown",
        startsOn: "",
        endsOn: "",
      },
    });
  });

  it("needs what each access mode needs, and nothing it doesn't use", () => {
    const linkWithout = readOfferingFields(form({ ...offering, accessUrl: "" }));
    const native = readOfferingFields(
      form({ ...offering, accessMode: "licensed_native", accessUrl: "", accessContentItemId: "item-1" }),
    );
    const unknownMode = readOfferingFields(form({ ...offering, accessMode: "carrier_pigeon" }));

    expect(linkWithout).toMatchObject({ ok: false, errors: { accessUrl: expect.any(String) } });
    expect(native).toMatchObject({
      ok: true,
      details: { access: { mode: "licensed_native", contentItemId: "item-1" } },
    });
    expect(unknownMode).toMatchObject({ ok: false, errors: { accessMode: expect.any(String) } });
  });

  it("needs an amount and a three-letter currency for a paid Offering, and an end no earlier than its start", () => {
    const result = readOfferingFields(
      form({ ...offering, costAmount: "lots", costCurrency: "dollars", startsOn: "2026-11-01", endsOn: "2026-10-01" }),
    );

    expect(result).toMatchObject({
      ok: false,
      errors: { costAmount: expect.any(String), costCurrency: expect.any(String), endsOn: expect.any(String) },
    });
  });
});

describe("readListingFlags (PART-03, PUB-04)", () => {
  it("reads whether it is listed, who sponsors it and why editors feature it", () => {
    expect(
      readListingFlags(
        form({ listed: "on", sponsoredBy: " Vodafone Fiji ", featured: "on", featureRationale: "Free." }),
      ),
    ).toEqual({ ok: true, flags: { listed: true, sponsoredBy: "Vodafone Fiji", featureRationale: "Free." } });
    expect(readListingFlags(form({}))).toEqual({
      ok: true,
      flags: { listed: false, sponsoredBy: null, featureRationale: null },
    });
  });

  it("won't feature anything without saying why", () => {
    expect(readListingFlags(form({ featured: "on" }))).toMatchObject({
      ok: false,
      errors: { featureRationale: expect.any(String) },
    });
  });
});

describe("sponsorsText", () => {
  it("names every sponsor once, or nothing when nobody sponsors it", () => {
    expect(sponsorsText("Vodafone Fiji", null)).toBe("Sponsored by Vodafone Fiji.");
    expect(sponsorsText("Vodafone Fiji", "Fiji Airways")).toBe("Sponsored by Vodafone Fiji and Fiji Airways.");
    expect(sponsorsText("Vodafone Fiji", "Vodafone Fiji")).toBe("Sponsored by Vodafone Fiji.");
    expect(sponsorsText(null, null)).toBeNull();
  });
});

describe("costText", () => {
  it("says what it costs, or that nobody knows yet", () => {
    expect(costText({ kind: "free" })).toBe("Free");
    expect(costText({ kind: "paid", amount: "120", currency: "AUD" })).toBe("AUD 120");
    expect(costText({ kind: "unknown" })).toBe("Cost not known");
  });
});

describe("isPartner (PART-03)", () => {
  const agreement = (startsOn: string, endsOn: string | null, endedAt: Date | null = null) => ({
    startsOn,
    endsOn,
    endedAt,
  });

  it("is true only while a recorded Partnership Agreement is in force", () => {
    expect(isPartner([], today)).toBe(false);
    expect(isPartner([agreement("2026-01-01", null)], today)).toBe(true);
    expect(isPartner([agreement("2026-11-01", null)], today)).toBe(false);
    expect(isPartner([agreement("2025-01-01", "2026-06-30")], today)).toBe(false);
    expect(isPartner([agreement("2026-01-01", "2026-10-01")], today)).toBe(true);
    expect(isPartner([agreement("2026-01-01", null, new Date("2026-09-01"))], today)).toBe(false);
  });
});

describe("offeringFilters", () => {
  it("reads the filters a visitor chose, ignoring anything unknown", () => {
    expect(
      offeringFilters(new URLSearchParams("format=online&cost=free&access=external_link&language=Standard%20Fijian")),
    ).toEqual({ format: "online", cost: "free", access: "external_link", language: "Standard Fijian" });
    expect(offeringFilters(new URLSearchParams("format=teleport&cost=cheap&access=x"))).toEqual({
      format: null,
      cost: null,
      access: null,
      language: "",
    });
  });
});
