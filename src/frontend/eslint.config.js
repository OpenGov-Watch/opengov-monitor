import tseslint from "typescript-eslint";

export default tseslint.config(
  // Base TypeScript config
  ...tseslint.configs.recommended,

  // Ignore patterns
  {
    ignores: ["dist/**", "node_modules/**", "*.config.*"],
  },

  // Project rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // Prevent new `any` usage - warn for now, track existing violations
      "@typescript-eslint/no-explicit-any": "warn",

      // Allow unused vars prefixed with underscore
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  }
);
