/** A Content Item's public address in an area: /{area}/{slug}. */
export const publicPath = (area: string, slug: string) => `/${area}/${slug}`;

/** A Creator Profile's address, beside Connect's other listings. */
export const creatorPath = (slug: string) => `/connect/creators/${slug}`;

/**
 * A content type's public address: /{area}/{slug}; /{slug} for a Page; /connect/creators/{slug}
 * for a Creator Profile.
 */
export const itemPath = (item: { type: string; primaryArea: string; slug: string }) =>
  item.type === "page"
    ? `/${item.slug}`
    : item.type === "creator"
      ? creatorPath(item.slug)
      : publicPath(item.primaryArea, item.slug);
