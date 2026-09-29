import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

/** Import aliases, mirrored in tsconfig.cloudflare.json "paths" and vitest.config.ts. */
export const aliases = {
  "~db": fileURLToPath(new URL("./db", import.meta.url)),
  "~": fileURLToPath(new URL("./app", import.meta.url)),
};

export default defineConfig({
  resolve: { alias: aliases },
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), reactRouter()],
});
