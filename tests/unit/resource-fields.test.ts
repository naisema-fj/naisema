import { describe, expect, it } from "vitest";
import { readResourceFields } from "~/lib/resource-fields";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

const common = {
  resourceLanguage: "Standard Fijian and English",
  resourceAgeGuidance: "all-ages",
  resourceAccessibility: "Tagged PDF with headings; large print.",
  resourcePermittedUse: "Free to print and share for teaching. Not for sale.",
};
const today = new Date("2026-10-01T09:00:00Z");

describe("readResourceFields", () => {
  it("reads a downloadable file", () => {
    const result = readResourceFields(form({ ...common, resourceKind: "file", resourceAssetId: "asset-1" }), today);

    expect(result).toEqual({
      ok: true,
      details: {
        source: { kind: "file", assetId: "asset-1" },
        language: "Standard Fijian and English",
        ageGuidance: "all-ages",
        accessibility: "Tagged PDF with headings; large print.",
        permittedUse: "Free to print and share for teaching. Not for sale.",
      },
    });
  });

  it("reads an external link with the date it was last checked", () => {
    const result = readResourceFields(
      form({
        ...common,
        resourceKind: "link",
        resourceUrl: "https://example.org/guide",
        resourceCheckedOn: "2026-09-30",
      }),
      today,
    );

    expect(result).toMatchObject({
      ok: true,
      details: { source: { kind: "link", url: "https://example.org/guide", checkedOn: "2026-09-30" } },
    });
  });

  it("needs a secure web address, checked no later than today", () => {
    const insecure = readResourceFields(
      form({ ...common, resourceKind: "link", resourceUrl: "http://example.org", resourceCheckedOn: "2026-09-30" }),
      today,
    );
    const script = readResourceFields(
      form({ ...common, resourceKind: "link", resourceUrl: "javascript:alert(1)", resourceCheckedOn: "2026-09-30" }),
      today,
    );
    const future = readResourceFields(
      form({ ...common, resourceKind: "link", resourceUrl: "https://example.org", resourceCheckedOn: "2026-10-02" }),
      today,
    );

    expect(insecure).toMatchObject({ ok: false, errors: { resourceUrl: expect.stringContaining("https://") } });
    expect(script).toMatchObject({ ok: false, errors: { resourceUrl: expect.any(String) } });
    expect(future).toMatchObject({ ok: false, errors: { resourceCheckedOn: expect.stringContaining("future") } });
  });

  it("needs what a visitor reads before downloading: language, age guidance and permitted use", () => {
    const result = readResourceFields(form({ resourceKind: "file", resourceAssetId: "asset-1" }), today);

    expect(result).toMatchObject({
      ok: false,
      errors: {
        resourceLanguage: expect.any(String),
        resourceAgeGuidance: expect.any(String),
        resourcePermittedUse: expect.any(String),
      },
    });
  });

  it("needs a file or a link", () => {
    expect(readResourceFields(form({ ...common }), today)).toMatchObject({
      ok: false,
      errors: { resourceKind: expect.any(String) },
    });
    expect(readResourceFields(form({ ...common, resourceKind: "file" }), today)).toMatchObject({
      ok: false,
      errors: { resourceAssetId: expect.any(String) },
    });
  });
});
