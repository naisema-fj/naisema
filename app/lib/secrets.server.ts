/** A secret an environment may not have set yet, which Env's generated types don't list. */
export function optionalSecret(env: Env, name: string) {
  const value = (env as unknown as Record<string, unknown>)[name];
  return typeof value === "string" && value ? value : undefined;
}
