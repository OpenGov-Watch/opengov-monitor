import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Memory management for large test suites
    // Note: React Testing Library can accumulate memory during test runs.
    // All tests pass, but the worker may crash during teardown with OOM error.
    // This is a known Vitest issue (see vitest-dev/vitest#5516, #8293, #9149).
    // The test results are valid despite exit code 1.
    pool: "forks",
    fileParallelism: false, // Run test files sequentially to reduce memory pressure
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/components/data-table/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/__tests__/**",
        "src/**/*.d.ts",
      ],
      thresholds: {
        statements: 40,
        branches: 35,
        functions: 40,
        lines: 40,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
