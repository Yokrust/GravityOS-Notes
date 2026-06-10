import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  outputDir: "../../../test-results/e2e",
  use: {
    trace: "on-first-retry"
  }
});
