import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
      // `server-only` throws outside a React Server environment.
      "server-only": path.join(import.meta.dirname, "tests/stubs/empty.ts"),
    },
  },
  test: { include: ["tests/**/*.test.ts"] },
});
