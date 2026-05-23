import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./apps/operator-web/src")
    }
  },
  test: {
    environment: "node",
    include: ["apps/**/*.test.ts", "apps/**/*.test.tsx", "packages/**/*.test.ts"],
    testTimeout: 20_000,
    coverage: {
      provider: "v8"
    }
  }
});
