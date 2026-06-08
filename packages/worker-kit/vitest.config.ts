import { defineConfig } from "vitest/config";

// Tests run in Node 22 against the kit's source directly. WebCrypto and fetch
// are globals in Node 22 (same as in the workerd runtime), so no shim is needed.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 5000,
  },
});
