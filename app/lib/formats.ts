import { CONTENT_TYPE_NAMES, type ContentType, isContentType } from "./content-types";

/** Content Item types as visitors see them, for search filters and listings. */
export const FORMAT_NAMES = CONTENT_TYPE_NAMES;

export type ContentFormat = ContentType;

export const isContentFormat = isContentType;
