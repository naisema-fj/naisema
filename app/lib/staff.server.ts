import { eq } from "drizzle-orm";
import { staff as staffTable } from "~db/schema";
import { getDb } from "./db.server";
import { can, type Permission, type Staff } from "./roles";

/**
 * Who a staff request comes from (ADR-0015). Cloudflare Access stands in front of the admin host
 * and lets through only the addresses on its allowlist, after an emailed one-time code. Every
 * request then carries Access's signed JWT, which is checked here against the team's public keys
 * and the application's audience tag before the `staff` table is asked for that person's roles.
 * So a request that slipped past Access, or a person removed from the table, gets nothing.
 *
 * Development and tests have no Access: there, and only there, the X-Dev-Staff-Email header names
 * the person.
 */

type AccessEnv = Env & { ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string };

export const DEV_STAFF_HEADER = "X-Dev-Staff-Email";

type Jwk = JsonWebKey & { kid: string };
let keyCache: { team: string; fetchedAt: number; keys: Map<string, CryptoKey> } | null = null;

const base64url = (text: string) => {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

async function accessKeys(team: string, refresh: boolean) {
  if (!refresh && keyCache?.team === team && Date.now() - keyCache.fetchedAt < 3_600_000) return keyCache.keys;
  const response = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Access keys unavailable (${response.status})`);
  const { keys } = (await response.json()) as { keys: Jwk[] };
  const imported = new Map<string, CryptoKey>();
  for (const key of keys) {
    imported.set(
      key.kid,
      await crypto.subtle.importKey("jwk", key, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]),
    );
  }
  keyCache = { team, fetchedAt: Date.now(), keys: imported };
  return imported;
}

/** The email address a valid Access JWT vouches for, or null. */
export async function verifyAccessJwt(token: string, team: string, audience: string, now = Date.now()) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(base64url(parts[0]))) as { alg?: string; kid?: string };
    const claims = JSON.parse(new TextDecoder().decode(base64url(parts[1]))) as {
      aud?: string | string[];
      email?: string;
      exp?: number;
      nbf?: number;
      iss?: string;
    };
    if (header.alg !== "RS256" || !header.kid) return null;
    let key = (await accessKeys(team, false)).get(header.kid);
    // Access rotates its keys; a key we haven't seen yet means fetching them again, once.
    if (!key) key = (await accessKeys(team, true)).get(header.kid);
    if (!key) return null;
    const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64url(parts[2]), signed))) return null;
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(audience)) return null;
    if (claims.iss !== `https://${team}`) return null;
    if (!claims.exp || claims.exp * 1000 < now) return null;
    if (claims.nbf && claims.nbf * 1000 > now + 60_000) return null;
    return typeof claims.email === "string" ? claims.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** The email address the request is from, as Access (or, in development, the header) says. */
async function requestEmail(env: AccessEnv, request: Request) {
  if (env.ENVIRONMENT === "development" && !env.ACCESS_TEAM_DOMAIN) {
    return request.headers.get(DEV_STAFF_HEADER)?.trim().toLowerCase() || null;
  }
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  return verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
}

/** The signed-in staff member, or null if the request isn't from an active one. */
export async function getStaff(env: Env, request: Request): Promise<Staff | null> {
  const email = await requestEmail(env, request);
  if (!email) return null;
  const row = await getDb(env.DB).query.staff.findFirst({ where: eq(staffTable.email, email) });
  if (!row?.active) return null;
  return { email: row.email, name: row.name, roles: row.roles, languageVariety: row.languageVariety };
}

/** The signed-in staff member, who must hold `permission` when one is named; otherwise a 403. */
export async function requireStaff(env: Env, request: Request, permission?: Permission): Promise<Staff> {
  const person = await getStaff(env, request);
  if (!person) {
    throw new Response("Your address isn't on NAISEMA's staff list. Ask an administrator to add you.", {
      status: 403,
    });
  }
  if (permission && !can(person, permission)) {
    throw new Response("Your roles don't allow this page.", { status: 403 });
  }
  return person;
}
