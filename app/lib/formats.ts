/**
 * Content Item types as visitors see them. Each type that gets a public page joins this list.
 */
export const FORMAT_NAMES = { article: "Article" } as const;

export type ContentFormat = keyof typeof FORMAT_NAMES;

export const isContentFormat = (value: string): value is ContentFormat => Object.hasOwn(FORMAT_NAMES, value);
