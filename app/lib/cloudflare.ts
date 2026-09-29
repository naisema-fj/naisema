import { createContext } from "react-router";

/** The Worker's bindings and execution context, available to every loader and action. */
export const cloudflareContext = createContext<{ env: Env; ctx: ExecutionContext }>();
