import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  target: "es2022",
  platform: "neutral", // workerd: no node builtins; rely on WebCrypto/fetch globals
  sourcemap: true,
  clean: true,
  // hono (peer) and @troop10rwc/shared (dep) are externalized by tsup by default.
});
