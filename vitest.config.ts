import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["apps/**/*.test.ts", "apps/**/*.test.tsx", "packages/**/*.test.ts"],
    testTimeout: 20_000,
    coverage: {
      provider: "v8"
    }
  }
});
