import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Memory management for large test suites (vitest 4.x config)
    fileParallelism: false, // Run test files sequentially to reduce memory pressure
    testTimeout: 30000,
    // Pass memory limit to worker processes
    forks: {
      execArgv: ["--max-old-space-size=8192"],
    },
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
