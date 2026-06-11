import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    // Namespaced Font Awesome (free) icon packs, so a consumer's only dependency
    // is the kit: `import { faTent } from "@troop10rwc/ui/icons/solid"`.
    "icons/solid": "src/icons-solid.ts",
    "icons/regular": "src/icons-regular.ts",
    "icons/brands": "src/icons-brands.ts",
  },
  format: ["esm"],
  dts: true,
  target: "es2022",
  sourcemap: true,
  clean: true,
  // React is a peer dependency — never bundle it (a second copy breaks hooks).
  external: ["react", "react-dom", "react/jsx-runtime"],
  // theme.css / fonts.css are shipped as-is (see package.json "files"/"exports"),
  // not bundled — the consuming app's Vite pipeline handles them.
});
