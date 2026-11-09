import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyAccessJwt } from "~/lib/staff.server";

const TEAM = "naisema.cloudflareaccess.com";
const AUD = "test-audience";

const encode = (value: unknown) =>
  btoa(typeof value === "string" ? value : JSON.stringify(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

async function keyPair(kid: string) {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  return { privateKey: pair.privateKey, jwk: { ...jwk, kid } };
}

async function sign(privateKey: CryptoKey, kid: string, claims: Record<string, unknown>) {
  const head = `${encode({ alg: "RS256", kid })}.${encode(claims)}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(head));
  return `${head}.${encode(String.fromCharCode(...new Uint8Array(signature)))}`;
}

afterEach(() => vi.unstubAllGlobals());

describe("the Cloudflare Access JWT", () => {
  it("names the staff member only when Access signed it for this application and it hasn't expired", async () => {
    const { privateKey, jwk } = await keyPair(`kid-${crypto.randomUUID()}`);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ keys: [jwk] })),
    );
    const now = Date.now();
    const claims = {
      aud: [AUD],
      email: "Editor@Naisema.test",
      iss: `https://${TEAM}`,
      exp: Math.floor(now / 1000) + 600,
    };

    expect(await verifyAccessJwt(await sign(privateKey, jwk.kid, claims), TEAM, AUD, now)).toBe("editor@naisema.test");
    expect(
      await verifyAccessJwt(await sign(privateKey, jwk.kid, { ...claims, aud: ["another-app"] }), TEAM, AUD, now),
    ).toBeNull();
    expect(
      await verifyAccessJwt(await sign(privateKey, jwk.kid, { ...claims, iss: "https://elsewhere" }), TEAM, AUD, now),
    ).toBeNull();
    expect(
      await verifyAccessJwt(
        await sign(privateKey, jwk.kid, { ...claims, exp: Math.floor(now / 1000) - 1 }),
        TEAM,
        AUD,
        now,
      ),
    ).toBeNull();
  });

  it("refuses a token signed by any other key, or altered after signing", async () => {
    const access = await keyPair(`kid-${crypto.randomUUID()}`);
    const forger = await keyPair(access.jwk.kid);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ keys: [access.jwk] })),
    );
    const claims = {
      aud: AUD,
      email: "editor@naisema.test",
      iss: `https://${TEAM}`,
      exp: Math.floor(Date.now() / 1000) + 600,
    };
    expect(await verifyAccessJwt(await sign(forger.privateKey, access.jwk.kid, claims), TEAM, AUD)).toBeNull();
    const genuine = await sign(access.privateKey, access.jwk.kid, claims);
    const [head, , signature] = genuine.split(".");
    const altered = `${head}.${encode({ ...claims, email: "admin@naisema.test" })}.${signature}`;
    expect(await verifyAccessJwt(altered, TEAM, AUD)).toBeNull();
    expect(await verifyAccessJwt("not-a-jwt", TEAM, AUD)).toBeNull();
  });
});
