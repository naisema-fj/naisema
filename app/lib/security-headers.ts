import { createContext, useContext } from "react";

/** The per-response CSP nonce; every inline script rendered on the server must carry it. */
export const NonceContext = createContext<string | undefined>(undefined);

export function useNonce() {
  return useContext(NonceContext);
}

export function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

export { applySecurityHeaders } from "./security-policy";
