/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// The site is a static Solid SPA that plays the sound designs from source. The
// generator's export folder is served as Vite's publicDir: `pnpm build:sounds`
// writes export/ and `vite build` copies it into dist/ as it stands, so the
// deployed site also serves the very files the game imports
// (docs/site/catalog-site.md).
export default defineConfig({
  plugins: [solid()],
  publicDir: "export",
  build: { target: "es2020", chunkSizeWarningLimit: 1200 },
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
