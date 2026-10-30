/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// The site is a static Solid SPA. Its data is the generator's export folder,
// served as Vite's publicDir: `pnpm build:music` writes export/ and `vite
// build` copies it into dist/ as it stands, so the deployed site serves the very
// files the game would import (docs/site/catalog-site.md).
export default defineConfig({
  plugins: [solid()],
  publicDir: "export",
  build: { target: "es2020", chunkSizeWarningLimit: 1200 },
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
