import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@gravity/application": fileURLToPath(
        new URL("./packages/application/src/index.ts", import.meta.url)
      ),
      "@gravity/domain": fileURLToPath(
        new URL("./packages/domain/src/index.ts", import.meta.url)
      ),
      "@gravity/testkit": fileURLToPath(
        new URL("./packages/testkit/src/index.ts", import.meta.url)
      )
    }
  },
  test: {
    include: [
      "apps/desktop/tests/**/*.test.ts",
      "packages/domain/tests/**/*.test.ts",
      "packages/application/tests/**/*.test.ts",
      "packages/adapters/tests/**/*.test.ts"
    ],
    environment: "node",
    coverage: {
      provider: "v8"
    }
  }
});
