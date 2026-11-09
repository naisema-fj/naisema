/**
 * Caching for public pages (ADR-0015): browsers revalidate every time and nothing is kept at the
 * edge, so eligibility is decided on every request and a withdrawal takes effect at once.
 */
export const publicHeaders = () => ({ "Cache-Control": "no-cache" });

/** Pages that must never be kept anywhere: previews, staff pages, form results. */
export const PRIVATE_NO_STORE = "private, no-store";
