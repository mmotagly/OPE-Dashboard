import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Minimal config for pure-logic tests (validation schemas, transition
 * graphs) — no DOM/React rendering needed yet, so no jsdom environment.
 * The alias mirrors tsconfig.json's "@/*" -> "./src/*".
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
