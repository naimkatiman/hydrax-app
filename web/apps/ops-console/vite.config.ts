import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_BASE_PATH lets the same source build for either standalone (default '/')
// or combined-deploy (e.g. '/ops-console/') where multiple portals live under one
// origin. Set at build time, NOT at runtime — Vite injects it into asset URLs.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? "/",
  server: { port: 5176, strictPort: true },
  build: { outDir: "dist", sourcemap: true },
});
