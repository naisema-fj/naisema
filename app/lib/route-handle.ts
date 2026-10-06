/**
 * What a route's `handle` says about its page (docs/phase-1a-defaults.md §7), read by root.tsx and
 * entry.server.tsx: `hydrate: false` ships no client JavaScript, `video` lets the page play video
 * (its Content Security Policy allows the provider's media), `turnstile` loads Cloudflare Turnstile,
 * and `noindex` keeps it out of search engines. `hydrate` and `video` can depend on what the page
 * shows: a function of its loader data, as for a public item that is sometimes a Video.
 */
export type RouteHandle = {
  hydrate?: boolean | ((data: unknown) => boolean);
  video?: boolean | ((data: unknown) => boolean);
  turnstile?: boolean;
  noindex?: boolean;
};

const flag = (value: boolean | ((data: unknown) => boolean) | undefined, data: unknown, otherwise: boolean) =>
  typeof value === "function" ? value(data) : (value ?? otherwise);

/** Whether the page loads client JavaScript; pages do unless they opt out. */
export const pageHydrates = (handle: RouteHandle | undefined, data: unknown) => flag(handle?.hydrate, data, true);

/** Whether the page plays video. */
export const pagePlaysVideo = (handle: RouteHandle | undefined, data: unknown) => flag(handle?.video, data, false);
