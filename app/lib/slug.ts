/** A URL slug from a title: lower-case ASCII letters and digits joined by hyphens. */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return slug || "untitled";
}

/** The first of `base`, `base-2`, `base-3`… that `taken` doesn't already hold. */
export function firstFreeSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/**
 * Slugs an area's own pages use, which no Content Item in that area may take: Connect lists
 * Providers, their Offerings and Creators at /connect/providers, /connect/offerings and
 * /connect/creators.
 */
export const RESERVED_SLUGS: Readonly<Record<string, readonly string[]>> = {
  connect: ["providers", "offerings", "creators"],
};

export const isReservedSlug = (area: string, slug: string) => (RESERVED_SLUGS[area] ?? []).includes(slug);
