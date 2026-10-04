/** A staff page's full address on this environment's admin host, for links in staff email. */
export function adminUrl(env: Env, path: string) {
  const scheme = env.ADMIN_HOSTNAME.endsWith("localhost") ? "http" : "https";
  return `${scheme}://${env.ADMIN_HOSTNAME}${path}`;
}
